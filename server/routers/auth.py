from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
import re

from config import settings
from logging_config import get_logger, set_user_id
from routers.deps import get_current_active_user, get_db
from security import limiter
from services.auth import authenticate_user, create_access_token
from services.serializers import serialize_user_summary

router = APIRouter(tags=["auth"])
logger = get_logger(__name__)


@router.post("/token")
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f"Failed login attempt for {form_data.username}", extra={"username": form_data.username})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    set_user_id(user.id)
    logger.info(f"User {user.email} logged in", extra={"user_id": user.id, "email": user.email})

    access_token_expires = timedelta(minutes=settings.jwt_access_ttl_min)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)},
        expires_delta=access_token_expires,
    )
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=access_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=int(access_token_expires.total_seconds()),
        path="/",
        domain=None,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(key=settings.auth_cookie_name, path="/")
    return {"ok": True}


@router.get("/api/me")
def get_current_user_info(current_user: Annotated = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        "customer_group_id": current_user.customer_group_id,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.patch("/api/me")
def update_current_user_info(
    user_data: dict,
    db: Annotated = Depends(get_db),
    current_user: Annotated = Depends(get_current_active_user),
):
    allowed_fields = {"phone", "first_name", "last_name"}
    payload = {key: value for key, value in (user_data or {}).items() if key in allowed_fields}

    def _clean_text(value, max_len: int = 100) -> str:
        return str(value or "").strip()[:max_len]

    if "first_name" in payload:
        first_name = _clean_text(payload.get("first_name"), 100)
        if not first_name:
            raise HTTPException(status_code=400, detail={"code": "INVALID_FIRST_NAME", "field": "first_name", "message": "Ім'я не може бути порожнім"})
        current_user.first_name = first_name

    if "last_name" in payload:
        last_name = _clean_text(payload.get("last_name"), 100)
        if not last_name:
            raise HTTPException(status_code=400, detail={"code": "INVALID_LAST_NAME", "field": "last_name", "message": "Прізвище не може бути порожнім"})
        current_user.last_name = last_name

    if "phone" in payload:
        raw_phone = str(payload.get("phone") or "").strip()
        if raw_phone == "":
            current_user.phone = None
        else:
            normalized = re.sub(r"[^\d+]", "", raw_phone)
            if normalized.startswith("00"):
                normalized = f"+{normalized[2:]}"
            if not normalized.startswith("+") and normalized.startswith("0") and len(normalized) == 10:
                normalized = f"+38{normalized}"
            if not re.match(r"^\+?\d{10,15}$", normalized):
                raise HTTPException(status_code=400, detail={"code": "INVALID_PHONE", "field": "phone", "message": "Номер телефону має бути у форматі +380XXXXXXXXX"})
            current_user.phone = normalized

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return serialize_user_summary(current_user)
