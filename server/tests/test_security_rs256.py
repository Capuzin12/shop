import asyncio
import sys
from pathlib import Path

from starlette.requests import Request
from starlette.responses import Response

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import security  # noqa: E402


def test_request_middleware_uses_resolved_public_key_for_rs256(monkeypatch):
    captured = {}

    monkeypatch.setattr(security.settings, "jwt_algorithm", "RS256", raising=False)
    monkeypatch.setattr(security.settings, "jwt_public_key", None, raising=False)
    monkeypatch.setattr(
        type(security.settings),
        "resolved_jwt_public_key",
        property(lambda _self: "resolved-public-key"),
    )

    def fake_decode(token, key, algorithms):
        captured["token"] = token
        captured["key"] = key
        captured["algorithms"] = algorithms
        return {"sub": "demo@example.com"}

    monkeypatch.setattr("jose.jwt.decode", fake_decode)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/me",
        "headers": [(b"authorization", b"Bearer sample-token")],
    }
    request = Request(scope)

    async def call_next(_request):
        return Response("ok", status_code=200)

    response = asyncio.run(security.add_request_id_middleware(request, call_next))

    assert response.status_code == 200  # nosec B101
    assert captured["token"] == "sample-token"  # nosec B101
    assert captured["key"] == "resolved-public-key"  # nosec B101
    assert captured["algorithms"] == ["RS256"]  # nosec B101
