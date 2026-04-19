"""
BuildShop E2E rehearsal suite (Phase 6).

Scenarios:
1) Register -> Login -> Browse -> Add to Cart -> Checkout
2) Admin flow: Create Product -> Set Inventory -> View Orders
3) Error scenarios: bad login, low stock, network failures

This script combines:
- UI navigation timing checks via Playwright (optional, if installed)
- API flow checks via urllib (no extra runtime dependency)

Usage examples:
  python scripts/e2e_tests.py --frontend-url http://localhost --api-url http://localhost
  python scripts/e2e_tests.py --skip-ui

Exit code:
  0 - all required checks passed
  1 - at least one required check failed
"""

from __future__ import annotations

import argparse
import json
import random
import string
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: str
    duration_ms: float = 0.0


@dataclass
class RunSummary:
    checks: list[CheckResult] = field(default_factory=list)

    def add(self, result: CheckResult) -> None:
        self.checks.append(result)

    @property
    def failed(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.ok]

    def print_report(self) -> None:
        print("\n=== BuildShop E2E Report ===")
        for check in self.checks:
            status = "PASS" if check.ok else "FAIL"
            print(f"[{status}] {check.name} ({check.duration_ms:.1f}ms) - {check.details}")
        print(f"\nTotal checks: {len(self.checks)}")
        print(f"Passed: {len(self.checks) - len(self.failed)}")
        print(f"Failed: {len(self.failed)}")


class ApiClient:
    def __init__(self, api_url: str, timeout: float = 10.0):
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        form_encoded: bool = False,
    ) -> tuple[int, dict[str, Any] | str, float]:
        url = f"{self.api_url}{path}"
        req_headers = {"Accept": "application/json"}
        if headers:
            req_headers.update(headers)

        payload = None
        if body is not None:
            if form_encoded:
                payload = urllib.parse.urlencode(body).encode("utf-8")
                req_headers["Content-Type"] = "application/x-www-form-urlencoded"
            else:
                payload = json.dumps(body).encode("utf-8")
                req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url=url, method=method.upper(), headers=req_headers, data=payload)
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                latency_ms = (time.perf_counter() - started) * 1000
                try:
                    return response.status, json.loads(raw) if raw else {}, latency_ms
                except json.JSONDecodeError:
                    return response.status, raw, latency_ms
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8") if hasattr(exc, "read") else ""
            latency_ms = (time.perf_counter() - started) * 1000
            try:
                data = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                data = raw
            return int(exc.code), data, latency_ms

    def register_user(self, user: dict[str, str]) -> tuple[int, dict[str, Any] | str, float]:
        return self._request("POST", "/api/users", body=user)

    def login(self, email: str, password: str) -> tuple[int, dict[str, Any] | str, float]:
        return self._request("POST", "/token", body={"username": email, "password": password}, form_encoded=True)

    def get(self, path: str, token: str | None = None) -> tuple[int, dict[str, Any] | str, float]:
        headers = {"Authorization": f"Bearer {token}"} if token else None
        return self._request("GET", path, headers=headers)

    def post(self, path: str, body: dict[str, Any], token: str | None = None) -> tuple[int, dict[str, Any] | str, float]:
        headers = {"Authorization": f"Bearer {token}"} if token else None
        return self._request("POST", path, body=body, headers=headers)

    def put(self, path: str, body: dict[str, Any], token: str | None = None) -> tuple[int, dict[str, Any] | str, float]:
        headers = {"Authorization": f"Bearer {token}"} if token else None
        return self._request("PUT", path, body=body, headers=headers)


def random_email(prefix: str = "e2e") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}_{suffix}@example.com"


def assert_sla(latency_ms: float, max_latency_ms: float) -> bool:
    return latency_ms <= max_latency_ms


def run_ui_timing_checks(frontend_url: str, summary: RunSummary, max_page_load_ms: float) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # pragma: no cover
        summary.add(CheckResult(
            name="UI Timing (Playwright)",
            ok=False,
            details=(
                "Playwright not available. Install and browsers with: "
                "pip install playwright && playwright install chromium. "
                f"Error: {exc}"
            ),
            duration_ms=0,
        ))
        return

    routes = ["/", "/register", "/login", "/catalog", "/cart", "/checkout"]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        for route in routes:
            started = time.perf_counter()
            try:
                page.goto(f"{frontend_url.rstrip('/')}{route}", wait_until="domcontentloaded", timeout=15000)
                duration_ms = (time.perf_counter() - started) * 1000
                summary.add(CheckResult(
                    name=f"UI page load {route}",
                    ok=assert_sla(duration_ms, max_page_load_ms),
                    details=f"Load time {duration_ms:.1f}ms (threshold {max_page_load_ms:.1f}ms)",
                    duration_ms=duration_ms,
                ))
            except Exception as exc:
                duration_ms = (time.perf_counter() - started) * 1000
                summary.add(CheckResult(
                    name=f"UI page load {route}",
                    ok=False,
                    details=f"Navigation failed: {exc}",
                    duration_ms=duration_ms,
                ))

        context.close()
        browser.close()


def scenario_customer_flow(api: ApiClient, summary: RunSummary, max_api_latency_ms: float) -> None:
    user_email = random_email("customer")
    password = "TestPass123!"
    user_payload = {
        "email": user_email,
        "password": password,
        "first_name": "E2E",
        "last_name": "Customer",
        "phone": "+380501112233",
    }

    status, data, latency = api.register_user(user_payload)
    summary.add(CheckResult(
        name="Scenario1 Register",
        ok=status in (200, 201),
        details=f"HTTP {status}",
        duration_ms=latency,
    ))

    status, data, latency = api.login(user_email, password)
    token = data.get("access_token") if isinstance(data, dict) else None
    summary.add(CheckResult(
        name="Scenario1 Login",
        ok=status == 200 and bool(token),
        details=f"HTTP {status}, token={'yes' if token else 'no'}",
        duration_ms=latency,
    ))

    status, data, latency = api.get("/api/products?limit=5", token=token)
    products = data.get("products", []) if isinstance(data, dict) else []
    first_product_id = products[0].get("id") if products else None
    summary.add(CheckResult(
        name="Scenario1 Browse Catalog",
        ok=status == 200 and bool(first_product_id),
        details=f"HTTP {status}, products={len(products)}",
        duration_ms=latency,
    ))

    if token and first_product_id:
        status, _, latency = api.post("/api/cart/items", {"product_id": first_product_id, "quantity": 1}, token=token)
        summary.add(CheckResult(
            name="Scenario1 Add To Cart",
            ok=status in (200, 201),
            details=f"HTTP {status}",
            duration_ms=latency,
        ))

        order_payload = {
            "contact_name": "E2E Customer",
            "contact_phone": "+380501112233",
            "contact_email": user_email,
            "delivery_city": "Kyiv",
            "delivery_address": "Khreshchatyk 1",
            "delivery_method": "nova_poshta",
            "payment_method": "card",
            "items": [{"product_id": first_product_id, "quantity": 1}],
        }
        status, _, latency = api.post("/api/orders", order_payload, token=token)
        summary.add(CheckResult(
            name="Scenario1 Checkout",
            ok=status in (200, 201),
            details=f"HTTP {status}",
            duration_ms=latency,
        ))

    for check_name, path in [
        ("API SLA /token", "/token"),
        ("API SLA /api/products", "/api/products?limit=1"),
    ]:
        if path == "/token":
            status, _, latency = api.login(user_email, password)
        else:
            status, _, latency = api.get(path, token=token)
        summary.add(CheckResult(
            name=check_name,
            ok=(status == 200 and assert_sla(latency, max_api_latency_ms)),
            details=f"HTTP {status}, {latency:.1f}ms (threshold {max_api_latency_ms:.1f}ms)",
            duration_ms=latency,
        ))


def scenario_admin_flow(api: ApiClient, summary: RunSummary) -> None:
    # Admin credentials are optional; scenario is skipped if unavailable.
    parser_hint = "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD env vars"
    import os

    admin_email = os.getenv("E2E_ADMIN_EMAIL")
    admin_password = os.getenv("E2E_ADMIN_PASSWORD")
    if not admin_email or not admin_password:
        summary.add(CheckResult("Scenario2 Admin Login", False, f"Skipped. {parser_hint}", 0))
        return

    status, data, latency = api.login(admin_email, admin_password)
    token = data.get("access_token") if isinstance(data, dict) else None
    summary.add(CheckResult(
        name="Scenario2 Admin Login",
        ok=status == 200 and bool(token),
        details=f"HTTP {status}",
        duration_ms=latency,
    ))
    if not token:
        return

    sku = "E2E-" + "".join(random.choice(string.digits) for _ in range(6))
    product_payload = {
        "name": f"E2E Product {sku}",
        "slug": f"e2e-{sku.lower()}",
        "sku": sku,
        "description": "E2E rehearsal product",
        "price": 99,
        "category_id": 1,
        "brand_id": 1,
        "is_active": True,
    }
    status, product_data, latency = api.post("/api/products", product_payload, token=token)
    product_id = product_data.get("id") if isinstance(product_data, dict) else None
    summary.add(CheckResult(
        name="Scenario2 Create Product",
        ok=status in (200, 201),
        details=f"HTTP {status}",
        duration_ms=latency,
    ))

    status, inventory_data, latency = api.get("/api/inventory", token=token)
    inventory_id = None
    if isinstance(inventory_data, list):
        for item in inventory_data:
            if item.get("product_id") == product_id:
                inventory_id = item.get("id")
                break
    if inventory_id:
        status, _, latency = api.put(f"/api/inventory/{inventory_id}", {"quantity": 25}, token=token)
        summary.add(CheckResult(
            name="Scenario2 Set Inventory",
            ok=status in (200, 201),
            details=f"HTTP {status}",
            duration_ms=latency,
        ))
    else:
        summary.add(CheckResult(
            name="Scenario2 Set Inventory",
            ok=False,
            details="Inventory record for created product not found",
            duration_ms=latency,
        ))

    status, _, latency = api.get("/api/orders", token=token)
    summary.add(CheckResult(
        name="Scenario2 View Orders",
        ok=status == 200,
        details=f"HTTP {status}",
        duration_ms=latency,
    ))


def scenario_error_cases(api: ApiClient, summary: RunSummary) -> None:
    # 1) bad login
    status, _, latency = api.login("wrong-user@example.com", "wrong-password")
    summary.add(CheckResult(
        name="Scenario3 Bad Login",
        ok=status == 401,
        details=f"Expected 401, got {status}",
        duration_ms=latency,
    ))

    # 2) low stock by forcing huge quantity through order API
    user_email = random_email("errcase")
    password = "TestPass123!"
    api.register_user({
        "email": user_email,
        "password": password,
        "first_name": "Err",
        "last_name": "Case",
        "phone": "+380501234567",
    })
    status, token_data, _ = api.login(user_email, password)
    token = token_data.get("access_token") if isinstance(token_data, dict) else None
    status, products_data, _ = api.get("/api/products?limit=1", token=token)
    products = products_data.get("products", []) if isinstance(products_data, dict) else []
    product_id = products[0].get("id") if products else None

    if token and product_id:
        status, _, latency = api.post(
            "/api/orders",
            {
                "contact_name": "Err Case",
                "contact_phone": "+380501234567",
                "contact_email": user_email,
                "delivery_city": "Kyiv",
                "delivery_address": "Err street",
                "delivery_method": "nova_poshta",
                "payment_method": "card",
                "items": [{"product_id": product_id, "quantity": 999999}],
            },
            token=token,
        )
        summary.add(CheckResult(
            name="Scenario3 Low Stock",
            ok=status in (400, 409),
            details=f"Expected 400/409, got {status}",
            duration_ms=latency,
        ))

    # 3) network error
    broken_api = ApiClient("http://127.0.0.1:65534", timeout=1.0)
    started = time.perf_counter()
    try:
        broken_api.get("/api/products")
        ok = False
        details = "Expected network failure, request unexpectedly succeeded"
    except Exception as exc:  # pragma: no cover
        ok = True
        details = f"Network failure captured: {exc}"
    latency = (time.perf_counter() - started) * 1000
    summary.add(CheckResult("Scenario3 Network Error", ok, details, latency))


def main() -> int:
    parser = argparse.ArgumentParser(description="BuildShop E2E rehearsal script")
    parser.add_argument("--frontend-url", default="http://localhost", help="Frontend base URL")
    parser.add_argument("--api-url", default="http://localhost", help="API base URL")
    parser.add_argument("--skip-ui", action="store_true", help="Skip Playwright UI timing checks")
    parser.add_argument("--max-page-load-ms", type=float, default=3000.0)
    parser.add_argument("--max-api-latency-ms", type=float, default=500.0)
    args = parser.parse_args()

    summary = RunSummary()
    api = ApiClient(args.api_url)

    if not args.skip_ui:
        run_ui_timing_checks(args.frontend_url, summary, args.max_page_load_ms)

    scenario_customer_flow(api, summary, args.max_api_latency_ms)
    scenario_admin_flow(api, summary)
    scenario_error_cases(api, summary)

    summary.print_report()
    return 0 if not summary.failed else 1


if __name__ == "__main__":
    raise SystemExit(main())

