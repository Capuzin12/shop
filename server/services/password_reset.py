import hashlib
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional
from config import settings

_reset_tokens: dict[str, dict] = {}


def _generate_reset_token() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(48))


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _store_token(token: str, user_id: int, email: str) -> None:
    hashed = _hash_token(token)
    to_delete = [k for k, v in _reset_tokens.items() if v.get("email") == email]
    for k in to_delete:
        del _reset_tokens[k]
    _reset_tokens[hashed] = {
        "user_id": user_id,
        "email": email,
        "expires_at": datetime.utcnow() + timedelta(minutes=settings.password_reset_ttl_minutes),
        "used": False,
    }


def _consume_token(token: str) -> Optional[dict]:
    hashed = _hash_token(token)
    data = _reset_tokens.get(hashed)
    if not data:
        return None
    if data["used"]:
        return None
    if datetime.utcnow() > data["expires_at"]:
        del _reset_tokens[hashed]
        return None
    data["used"] = True
    return data

