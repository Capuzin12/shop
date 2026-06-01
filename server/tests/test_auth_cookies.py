import sys
from pathlib import Path

from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import Settings  # noqa: E402
from services.helpers import _extract_token_from_request  # noqa: E402


def test_auth_cookie_name_is_not_allowed_to_conflate_refresh_cookie():
    settings = Settings(AUTH_COOKIE_NAME="refresh_token", _env_file=None)

    assert settings.auth_cookie_name == "access_token"  # nosec B101
    assert settings.refresh_cookie_name == "refresh_token"  # nosec B101


def test_request_token_extraction_uses_access_cookie(monkeypatch):
    monkeypatch.setattr("services.helpers.settings.auth_cookie_name", "access_token")

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/admin/analytics/customers",
            "headers": [(b"cookie", b"access_token=access.jwt; refresh_token=refresh.raw")],
        }
    )

    assert _extract_token_from_request(request, None) == "access.jwt"  # nosec B101
