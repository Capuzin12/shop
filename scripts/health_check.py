"""
Post-deploy health check utility.

Checks:
- /health/live
- /health/ready
- /api/stats

Supports:
- retry logic
- latency threshold
- rolling window error-rate gate
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from typing import List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class EndpointResult:
    endpoint: str
    ok: bool
    status_code: int
    latency_ms: float
    error: str | None = None


def request_json(url: str, timeout: float) -> EndpointResult:
    started = time.time()
    req = Request(url, method="GET")
    try:
        with urlopen(req, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
            latency_ms = (time.time() - started) * 1000
            data = json.loads(payload) if payload else {}
            return EndpointResult(
                endpoint=url,
                ok=200 <= response.status < 300,
                status_code=response.status,
                latency_ms=latency_ms,
                error=None if data is not None else "Empty JSON response",
            )
    except HTTPError as exc:
        latency_ms = (time.time() - started) * 1000
        return EndpointResult(url, False, int(exc.code), latency_ms, str(exc))
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        latency_ms = (time.time() - started) * 1000
        return EndpointResult(url, False, 0, latency_ms, str(exc))


def check_once(base_url: str, timeout: float, max_latency_ms: float) -> List[EndpointResult]:
    endpoints = ["/health/live", "/health/ready", "/api/stats"]
    results: List[EndpointResult] = []

    for endpoint in endpoints:
        url = f"{base_url.rstrip('/')}{endpoint}"
        result = request_json(url, timeout=timeout)
        if result.ok and result.latency_ms > max_latency_ms:
            result.ok = False
            result.error = (
                f"Latency too high ({result.latency_ms:.2f}ms > {max_latency_ms:.2f}ms)"
            )
        results.append(result)

    return results


def run_checks(
    base_url: str,
    timeout: float,
    retries: int,
    retry_delay: float,
    max_latency_ms: float,
) -> bool:
    for attempt in range(1, retries + 1):
        results = check_once(base_url, timeout, max_latency_ms)
        failed = [item for item in results if not item.ok]

        print(f"Attempt {attempt}/{retries}")
        for item in results:
            status = "OK" if item.ok else "FAIL"
            print(
                f"[{status}] {item.endpoint} "
                f"status={item.status_code} latency={item.latency_ms:.2f}ms"
                + (f" error={item.error}" if item.error else "")
            )

        if not failed:
            return True

        if attempt < retries:
            time.sleep(retry_delay)

    return False


def run_window_gate(
    base_url: str,
    timeout: float,
    interval_seconds: int,
    window_seconds: int,
    max_latency_ms: float,
    max_error_rate: float,
) -> bool:
    total_rounds = max(1, window_seconds // max(1, interval_seconds))
    failures = 0

    for round_no in range(1, total_rounds + 1):
        print(f"Window check {round_no}/{total_rounds}")
        passed = run_checks(
            base_url=base_url,
            timeout=timeout,
            retries=1,
            retry_delay=0,
            max_latency_ms=max_latency_ms,
        )
        if not passed:
            failures += 1

        if round_no < total_rounds:
            time.sleep(interval_seconds)

    error_rate = (failures / total_rounds) * 100
    print(
        f"Window summary: failures={failures}/{total_rounds}, "
        f"error_rate={error_rate:.2f}% (threshold={max_error_rate:.2f}%)"
    )
    return error_rate <= max_error_rate


def main() -> int:
    parser = argparse.ArgumentParser(description="Run post-deploy health checks")
    parser.add_argument("--base-url", required=True, help="Base URL, e.g. https://staging.example.com")
    parser.add_argument("--timeout", type=float, default=5.0, help="Request timeout in seconds")
    parser.add_argument("--retries", type=int, default=3, help="Retry attempts for one check run")
    parser.add_argument("--retry-delay", type=float, default=2.0, help="Delay between retries")
    parser.add_argument("--max-latency-ms", type=float, default=1000.0, help="Per-endpoint latency threshold")
    parser.add_argument("--window-seconds", type=int, default=0, help="If >0, run continuous window gate")
    parser.add_argument("--interval-seconds", type=int, default=10, help="Interval between window rounds")
    parser.add_argument("--max-error-rate", type=float, default=1.0, help="Allowed window error rate in percent")
    args = parser.parse_args()

    ok = run_checks(
        base_url=args.base_url,
        timeout=args.timeout,
        retries=args.retries,
        retry_delay=args.retry_delay,
        max_latency_ms=args.max_latency_ms,
    )

    if ok and args.window_seconds > 0:
        ok = run_window_gate(
            base_url=args.base_url,
            timeout=args.timeout,
            interval_seconds=args.interval_seconds,
            window_seconds=args.window_seconds,
            max_latency_ms=args.max_latency_ms,
            max_error_rate=args.max_error_rate,
        )

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

