from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
import re
from sqlalchemy.orm import Session

from config import settings
from logging_config import get_logger, set_user_id
from models import User, RefreshToken
from routers.deps import get_current_active_user, get_db
from security import limiter
from services.auth import authenticate_user, create_access_token, create_refresh_token, verify_refresh_token, revoke_refresh_token_by_raw, _hash_token, revoke_all_user_refresh_tokens
from sqlalchemy import select
from services.serializers import serialize_user_summary

router = APIRouter(tags=["auth"])
logger = get_logger(__name__)


@router.post("/token")
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
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

    # Create refresh token and store hash server-side; send raw refresh token in HttpOnly cookie
    raw_refresh, rt_row = create_refresh_token(db, user, ip=request.client.host if request.client else None, device=request.headers.get("User-Agent"))
    refresh_max_age = int(timedelta(minutes=settings.jwt_refresh_ttl_min).total_seconds())
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=raw_refresh,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=refresh_max_age,
        path="/",
        domain=None,
    )

    return {"access_token": access_token, "token_type": "bearer"}  #nosec B105


@router.post("/api/logout")
def logout(request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    # Revoke refresh token if present
    raw = request.cookies.get(settings.auth_cookie_name)
    if raw:
        try:
            revoke_refresh_token_by_raw(db, raw)
        except Exception:  #nosec B110
            pass
    response.delete_cookie(key=settings.auth_cookie_name, path="/")
    return {"ok": True}


@router.post("/token/refresh")
@limiter.limit("10/minute")
def refresh_access_token(request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    """Rotate refresh token and issue new access token. """
    raw = request.cookies.get(settings.auth_cookie_name)
    if not raw:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    row = verify_refresh_token(db, raw)
    if not row:
        # possible reuse / invalid token
        try:
            token_hash = _hash_token(raw)
            suspect = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
            if suspect:
                # token was found but revoked -> token reuse detected: revoke all user's tokens
                revoke_all_user_refresh_tokens(db, suspect.user_id)
        except Exception:  #nosec B110
            pass
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # rotate: create new refresh token and mark old as revoked/replaced
    user = db.scalar(select(User).where(User.id == row.user_id))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token user")

    # revoke old
    try:
        row.revoked = True
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()

    raw_new, new_row = create_refresh_token(db, user, ip=request.client.host if request.client else None, device=request.headers.get("User-Agent"))

    # set new cookie
    refresh_max_age = int(timedelta(minutes=settings.jwt_refresh_ttl_min).total_seconds())
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=raw_new,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=refresh_max_age,
        path="/",
        domain=None,
    )

    # issue new access token
    access_token_expires = timedelta(minutes=settings.jwt_access_ttl_min)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}  #nosec B105


@router.get("/api/me")
def get_current_user_info(current_user: Annotated[User, Depends(get_current_active_user)]):
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
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
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
