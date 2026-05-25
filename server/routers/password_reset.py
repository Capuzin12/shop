from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from logging_config import get_logger
from models import User
from routers.deps import get_db
from schemas.password_reset import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from security import limiter
from services.auth import get_password_hash
from services.email import _send_reset_email
from services.password_reset import _consume_token, _generate_reset_token, _hash_token, _store_token, _reset_tokens

router = APIRouter(tags=["auth"])
logger = get_logger(__name__)


def _validate_new_password(password: str) -> None:
    import re
    pwd = str(password or "")
    min_len = getattr(settings, "min_password_length", 12)
    if len(pwd) < min_len:
        raise HTTPException(
            status_code=400,
            detail={"code": "WEAK_PASSWORD", "message": f"Пароль має містити щонайменше {min_len} символів"},
        )
    if not re.search(r"[A-Z]", pwd):
        raise HTTPException(
            status_code=400,
            detail={"code": "WEAK_PASSWORD", "message": "Пароль має містити хоча б одну велику літеру"},
        )
    if not re.search(r"[a-z]", pwd):
        raise HTTPException(
            status_code=400,
            detail={"code": "WEAK_PASSWORD", "message": "Пароль має містити хоча б одну малу літеру"},
        )
    if not re.search(r"\d", pwd):
        raise HTTPException(
            status_code=400,
            detail={"code": "WEAK_PASSWORD", "message": "Пароль має містити хоча б одну цифру"},
        )
    if not re.search(r"[^A-Za-z0-9]", pwd):
        raise HTTPException(
            status_code=400,
            detail={"code": "WEAK_PASSWORD", "message": "Пароль має містити хоча б один спецсимвол (!@#$%^&*)"},
        )


@router.post(
    "/api/auth/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))

    if user and user.is_active:
        token = _generate_reset_token()
        _store_token(token, user.id, user.email)
        sent = _send_reset_email(user.email, token, user.first_name)
        if not sent:
            logger.warning(
                "Reset email delivery failed — user will not receive link",
                extra={"user_id": user.id},
            )

    return {"message": "Якщо акаунт з таким email існує, ви отримаєте лист із посиланням для скидання пароля."}


@router.post(
    "/api/auth/reset-password",
    response_model=ResetPasswordResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
):
    token = str(body.token or "").strip()
    if not token:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TOKEN", "message": "Токен скидання не вказано"},
        )

    token_data = _consume_token(token)
    if not token_data:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_OR_EXPIRED_TOKEN",
                "message": "Посилання недійсне або вже використане. Запросіть нове.",
            },
        )

    _validate_new_password(body.new_password)

    user = db.get(User, token_data["user_id"])
    if not user or not user.is_active:
        raise HTTPException(
            status_code=400,
            detail={"code": "USER_NOT_FOUND", "message": "Акаунт не знайдено"},
        )

    user.password_hash = get_password_hash(body.new_password)
    db.add(user)
    db.commit()

    logger.info("Password reset successful", extra={"user_id": user.id})
    return {"message": "Пароль успішно змінено. Тепер ви можете увійти з новим паролем."}


@router.get("/api/auth/validate-reset-token")
async def validate_reset_token(token: str):
    token = str(token or "").strip()
    hashed = _hash_token(token)
    data = _reset_tokens.get(hashed)

    if not data or data["used"] or datetime.utcnow() > data["expires_at"]:
        return {"valid": False}
    return {"valid": True, "expires_in_minutes": int((data["expires_at"] - datetime.utcnow()).total_seconds() / 60)}
