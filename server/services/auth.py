from datetime import datetime, timedelta, timezone
import re
import secrets
import hashlib
import uuid
from typing import Optional, Tuple

from fastapi import HTTPException
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import select

from config import settings
from models import User
from models.user import RefreshToken

# Use Argon2 as preferred scheme but keep bcrypt for existing users until they re-hash
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def authenticate_user(db: Session, email: str, password: str):
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    # add issued at and jti for revocation/tracing
    jti = str(uuid.uuid4())
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), "jti": jti})
    # choose signing key based on algorithm
    algo = settings.jwt_algorithm or 'HS256'
    if algo.startswith('RS'):
        # Expect PEM private key in settings.jwt_private_key
        private = settings.jwt_private_key
        if not private:
            raise RuntimeError('JWT private key not configured for RS* algorithm')
        encoded_jwt = jwt.encode(to_encode, private, algorithm=algo)
    else:
        encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=algo)
    return encoded_jwt


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def create_refresh_token(db: Session, user: User, ip: Optional[str] = None, device: Optional[str] = None) -> Tuple[str, RefreshToken]:
    """Create a new refresh token, persist its hash and return the raw token and DB row."""
    raw = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_refresh_ttl_min)
    rt = RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires, device_info=device, ip_address=ip)
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return raw, rt


def revoke_refresh_token(db: Session, token_hash: str) -> None:
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row:
        row.revoked = True
        db.add(row)
        db.commit()


def revoke_refresh_token_by_raw(db: Session, raw_token: str) -> None:
    try:
        token_hash = _hash_token(raw_token)
    except Exception:
        return
    revoke_refresh_token(db, token_hash)


def revoke_all_user_refresh_tokens(db: Session, user_id: int) -> None:
    rows = db.scalars(select(RefreshToken).where(RefreshToken.user_id == user_id)).all()
    for r in rows:
        r.revoked = True
        db.add(r)
    db.commit()


def verify_refresh_token(db: Session, raw_token: str) -> Optional[RefreshToken]:
    if not raw_token:
        return None
    token_hash = _hash_token(raw_token)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if not row:
        return None
    # check expiry and revoked
    if row.revoked or (row.expires_at and row.expires_at < datetime.now(timezone.utc)):
        return None
    return row


def validate_password_strength(password: str) -> None:
    pwd = str(password or "")
    min_len = settings.min_password_length

    if len(pwd) < min_len:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": f"Пароль має містити щонайменше {min_len} символів",
            },
        )

    if not re.search(r"[A-Z]", pwd):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Пароль має містити хоча б одну велику літеру",
            },
        )

    if not re.search(r"[a-z]", pwd):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Пароль має містити хоча б одну малу літеру",
            },
        )

    if not re.search(r"\d", pwd):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Пароль має містити хоча б одну цифру",
            },
        )

    if not re.search(r"[^A-Za-z0-9]", pwd):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Пароль має містити хоча б один спецсимвол (!@#$%^&*)",
            },
        )

    if re.search(r"(.)\1{2,}", pwd):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Пароль не може містити три однакові символи поспіль",
            },
        )

    common_patterns = ["password", "12345", "qwerty", "abc123", "admin", "user"]
    if any(pattern in pwd.lower() for pattern in common_patterns):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Пароль містить часто використовану послідовність. Будь ласка, виберіть більш складний пароль",
            },
        )

