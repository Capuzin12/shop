import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, TypedDict, cast
from config import settings


class ResetTokenData(TypedDict):
    user_id: int
    email: str
    expires_at: datetime
    used: bool


_reset_tokens: dict[str, ResetTokenData] = {}


def _generate_reset_token() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(48))


def _hash_token(token: str) -> str:
    digest = hashlib.sha256()
    digest.update(token.encode())
    return digest.hexdigest()


def _store_token(token: str, user_id: int, email: str) -> None:
    hashed = _hash_token(token)
    to_delete = [k for k, v in _reset_tokens.items() if v.get("email") == email]
    for k in to_delete:
        del _reset_tokens[k]
    _reset_tokens[hashed] = {
        "user_id": user_id,
        "email": email,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_ttl_minutes),
        "used": False,
    }


def _consume_token(token: str) -> Optional[dict]:
    hashed = _hash_token(token)
    data = _reset_tokens.get(hashed)
    if not data:
        return None
    if data["used"]:
        return None
    if datetime.now(timezone.utc) > data["expires_at"]:
        del _reset_tokens[hashed]
        return None
    typed_data = cast(ResetTokenData, data)
    typed_data["used"] = True
    return typed_data

