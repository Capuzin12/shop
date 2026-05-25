from datetime import datetime, timedelta, timezone
import re

from fastapi import HTTPException
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import select

from config import settings
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


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

