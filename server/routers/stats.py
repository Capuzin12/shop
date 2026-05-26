from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from config import settings
from logging_config import get_logger, get_request_id
from models import Category, ClientError, Order, Product, User, UserRole
from routers.deps import get_current_admin_user, get_db, get_optional_user
from security import limiter
from services.auth import get_password_hash

router = APIRouter(tags=["stats"])
logger = get_logger(__name__)


@router.get("/")
def read_root():
    return {"message": "BuildShop API", "docs": "/docs", "hint": "Після init_db + seed доступні лічильники в /api/stats"}


@router.get("/health/live")
def health_live():
    return {"ok": True}


@router.get("/health/ready")
def health_ready(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"ok": True}


@router.get("/api/feature-flags")
def get_feature_flags(current_user: Annotated[User | None, Depends(get_optional_user)] = None):
    is_staff = bool(current_user and current_user.role in {UserRole.admin, UserRole.manager, UserRole.content_manager, UserRole.sales_processor, UserRole.warehouse_manager})
    return {"flags": {"experimentalCatalogSuggestions": True, "enhancedErrorReporting": True, "apiRetryFor5xx": True, "staffDiagnosticsPanel": is_staff}}


@router.post("/api/errors", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def create_client_error(request: Request, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated[User | None, Depends(get_optional_user)] = None):
    message = str((payload or {}).get("message") or "").strip()
    if len(message) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "INVALID_CLIENT_ERROR", "message": "Повідомлення помилки занадто коротке"})
    client_error = ClientError(
        user_id=current_user.id if current_user else None,
        path=str((payload or {}).get("path") or "")[:255],
        message=message[:500],
        stack=str((payload or {}).get("stack") or "")[:8000],
        component_stack=str((payload or {}).get("component_stack") or "")[:8000],
        request_id=str((payload or {}).get("request_id") or get_request_id() or "")[:64],
        user_agent=str((payload or {}).get("user_agent") or request.headers.get("user-agent") or "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(client_error)
    db.commit()
    db.refresh(client_error)
    short_code = f"FE-{client_error.id:06d}"
    logger.warning("Client UI error captured", extra={"client_error_id": client_error.id, "error_code": short_code, "path": client_error.path, "request_id": client_error.request_id, "user_id": current_user.id if current_user else None})
    return {"ok": True, "error_code": short_code, "id": client_error.id}


@router.get("/api/stats")
def api_stats(db: Annotated[Session, Depends(get_db)]):
    return {
        "categories": db.scalar(select(func.count()).select_from(Category)) or 0,
        "products": db.scalar(select(func.count()).select_from(Product)) or 0,
        "orders": db.scalar(select(func.count()).select_from(Order)) or 0,
    }


@router.get("/api/debug/reset-admin-password")
def reset_admin_password(payload: dict | None = None, db: Annotated[Session, Depends(get_db)] = None):
    if settings.environment not in ("development", "dev", "local"):
        raise HTTPException(status_code=403, detail="This debug endpoint is only available in development")
    test_password = "Admin123!@#"  #nosec B105
    admin = db.scalar(select(User).where(User.email == "admin@budmart.ua"))
    if not admin:
        raise HTTPException(status_code=404, detail="Admin user not found")
    admin.password_hash = get_password_hash(test_password)
    admin.is_active = True
    db.add(admin)
    db.commit()
    logger.info("Admin password reset in debug mode")
    return {"ok": True, "message": "Admin password reset successfully", "credentials": {"email": "admin@budmart.ua", "password": test_password, "note": "Debug only"}}
