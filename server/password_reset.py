"""
Password reset module for BuildShop API.
Uses Resend (https://resend.com) for transactional email delivery.

Setup:
    pip install resend

Environment variables (add to server/.env):
    RESEND_API_KEY=re_RA5QNkFq_...        # Your Resend API key
    RESEND_FROM_EMAIL=noreply@yourdomain.com  # Verified sender domain in Resend
    FRONTEND_URL=http://localhost:5173    # Or your production frontend URL
    PASSWORD_RESET_TTL_MINUTES=30        # Token expiry (default 30 min)
"""

import hashlib
import hmac
import os
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

import resend
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from logging_config import get_logger
from models import User
from security import limiter

logger = get_logger(__name__)

router = APIRouter(tags=["auth"])

# ---------------------------------------------------------------------------
# Configuration — read from environment, never hardcoded
# ---------------------------------------------------------------------------

RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "BuildShop <noreply@buildshop.ua>")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
RESET_TTL_MINUTES: int = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "30"))

# Simple in-memory token store.
# For production at scale, replace with Redis or a DB table (see PasswordResetToken
# model at the bottom of this file for a SQLAlchemy alternative).
_reset_tokens: dict[str, dict] = {}
# { token: { "user_id": int, "email": str, "expires_at": datetime, "used": bool } }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _generate_reset_token() -> str:
    """Generate a 48-char URL-safe random token."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(48))


def _hash_token(token: str) -> str:
    """Hash the token before storing so raw tokens aren't in memory."""
    return hashlib.sha256(token.encode()).hexdigest()


def _store_token(token: str, user_id: int, email: str) -> None:
    hashed = _hash_token(token)
    # Remove any previous tokens for the same email
    to_delete = [k for k, v in _reset_tokens.items() if v.get("email") == email]
    for k in to_delete:
        del _reset_tokens[k]
    _reset_tokens[hashed] = {
        "user_id": user_id,
        "email": email,
        "expires_at": datetime.utcnow() + timedelta(minutes=RESET_TTL_MINUTES),
        "used": False,
    }


def _consume_token(token: str) -> Optional[dict]:
    """
    Validate and consume a reset token.
    Returns the token data on success, None if invalid/expired/used.
    """
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


# ---------------------------------------------------------------------------
# Email sending via Resend
# ---------------------------------------------------------------------------

def _send_reset_email(to_email: str, token: str, first_name: str = "") -> bool:
    """
    Send a password-reset email using the Resend API.
    Returns True on success, False on any delivery failure.
    """
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY is not configured — cannot send reset email")
        return False

    resend.api_key = RESEND_API_KEY
    reset_url = f"{FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    greeting = f"Привіт, {first_name}!" if first_name else "Привіт!"

    html_body = f"""
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Скидання пароля — BuildShop</title>
</head>
<body style="margin:0;padding:0;background:#f1ebe1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px;">
              <span style="font-size:22px;font-weight:900;letter-spacing:0.2em;color:#fbbf24;">BUILDSHOP</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#0f172a;">Скидання пароля</h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">{greeting}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#475569;">
                Ми отримали запит на скидання пароля для вашого акаунту <strong>{to_email}</strong>.
                Натисніть кнопку нижче, щоб встановити новий пароль.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="{reset_url}"
                       style="display:inline-block;background:#0f172a;color:#fbbf24;text-decoration:none;
                              padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;
                              letter-spacing:0.02em;">
                      Скинути пароль
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                Якщо кнопка не працює, скопіюйте це посилання у браузер:<br>
                <a href="{reset_url}" style="color:#d97706;word-break:break-all;">{reset_url}</a>
              </p>
              <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                Посилання дійсне протягом <strong>{RESET_TTL_MINUTES} хвилин</strong>.
                Якщо ви не надсилали цей запит — просто проігноруйте лист. Ваш пароль не зміниться.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                © {datetime.utcnow().year} BuildShop — будівельні матеріали онлайн
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    text_body = (
        f"{greeting}\n\n"
        f"Ми отримали запит на скидання пароля для {to_email}.\n\n"
        f"Перейдіть за посиланням (дійсне {RESET_TTL_MINUTES} хв):\n{reset_url}\n\n"
        "Якщо ви не надсилали цей запит — проігноруйте цей лист.\n\n"
        "— Команда BuildShop"
    )

    try:
        params: resend.Emails.SendParams = {
            "from": RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": "Скидання пароля — BuildShop",
            "html": html_body,
            "text": text_body,
        }
        result = resend.Emails.send(params)
        logger.info(
            "Password reset email sent",
            extra={"resend_id": result.get("id"), "to": to_email},
        )
        return True
    except Exception as exc:
        logger.error(
            "Failed to send password reset email via Resend",
            extra={"error": str(exc), "to": to_email},
        )
        return False


# ---------------------------------------------------------------------------
# Password strength validation (mirrors frontend rules)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/api/auth/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Request a password-reset link.

    Always returns 200 with a generic message regardless of whether the
    email exists in the database — this prevents user enumeration attacks.
    """
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))

    if user and user.is_active:
        token = _generate_reset_token()
        _store_token(token, user.id, user.email)
        sent = _send_reset_email(user.email, token, user.first_name)
        if not sent:
            # Log the failure but still return 200 to avoid leaking info
            logger.warning(
                "Reset email delivery failed — user will not receive link",
                extra={"user_id": user.id},
            )

    # Always the same response — never reveal whether email exists
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
    db: Session = Depends(get_db),
):
    """
    Consume a reset token and set a new password.
    """
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

    from main import get_password_hash  # avoid circular import at module level
    user.password_hash = get_password_hash(body.new_password)
    db.add(user)
    db.commit()

    logger.info("Password reset successful", extra={"user_id": user.id})
    return {"message": "Пароль успішно змінено. Тепер ви можете увійти з новим паролем."}


@router.get("/api/auth/validate-reset-token")
async def validate_reset_token(token: str):
    """
    Check if a reset token is still valid (called by frontend before showing the form).
    Returns 200 with valid=true/false — does NOT consume the token.
    """
    token = str(token or "").strip()
    hashed = _hash_token(token)
    data = _reset_tokens.get(hashed)

    if not data or data["used"] or datetime.utcnow() > data["expires_at"]:
        return {"valid": False}
    return {"valid": True, "expires_in_minutes": int((data["expires_at"] - datetime.utcnow()).total_seconds() / 60)}
