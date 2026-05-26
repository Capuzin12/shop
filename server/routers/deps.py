from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import text, select

from config import settings
from database import DATABASE_URL, SessionLocal
from models import User, UserRole
from services.helpers import _extract_token_from_request

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

_schema_patched = False


def ensure_runtime_schema(db: Session):
    global _schema_patched
    if _schema_patched:
        return
    if not DATABASE_URL.startswith("sqlite"):
        _schema_patched = True
        return

    table_info = db.execute(text("PRAGMA table_info(notifications)")).all()
    existing_columns = {row[1] for row in table_info}
    statements = []
    if "target_path" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_path TEXT")
    if "target_product_id" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_product_id INTEGER")
    if "target_inventory_id" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_inventory_id INTEGER")
    if "target_order_id" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_order_id INTEGER")

    if statements:
        for sql in statements:
            db.execute(text(sql))
        db.commit()

    table_info = db.execute(text("PRAGMA table_info(client_errors)")).all()
    if not table_info:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS client_errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                path TEXT,
                message TEXT NOT NULL,
                stack TEXT,
                component_stack TEXT,
                request_id TEXT,
                user_agent TEXT,
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON client_errors(created_at)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_client_errors_user_id ON client_errors(user_id)"))
        db.commit()

    _schema_patched = True


def get_db():
    db = SessionLocal()
    try:
        ensure_runtime_schema(db)
        yield db
    finally:
        db.close()


def can_manage_catalog(role: UserRole) -> bool:
    return role in (UserRole.admin, UserRole.content_manager, UserRole.manager)


def can_manage_warehouse(role: UserRole) -> bool:
    return role in (UserRole.admin, UserRole.warehouse_manager, UserRole.manager)


def can_manage_sales(role: UserRole) -> bool:
    return role in (UserRole.admin, UserRole.sales_processor, UserRole.manager)


async def get_current_user(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    raw_token = _extract_token_from_request(request, token)
    if not raw_token:
        raise credentials_exception
    try:
        algo = settings.jwt_algorithm or 'HS256'
        if algo.startswith('RS'):
            pub = settings.resolved_jwt_public_key
            if not pub:
                raise credentials_exception
            payload = jwt.decode(raw_token, pub, algorithms=[algo])
        else:
            payload = jwt.decode(raw_token, settings.secret_key, algorithms=[algo])
        email: str = payload.get("sub")
        token_role: str | None = payload.get("role")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise credentials_exception
    if token_role and token_role != (user.role.value if hasattr(user.role, "value") else str(user.role)):
        raise credentials_exception
    return user


async def get_optional_user(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
):
    raw_token = _extract_token_from_request(request, token)
    if not raw_token:
        return None
    try:
        algo = settings.jwt_algorithm or 'HS256'
        if algo.startswith('RS'):
            pub = settings.resolved_jwt_public_key
            if not pub:
                return None
            payload = jwt.decode(raw_token, pub, algorithms=[algo])
        else:
            payload = jwt.decode(raw_token, settings.secret_key, algorithms=[algo])
    except JWTError:
        return None
    email: str | None = payload.get("sub")
    if not email:
        return None
    return db.scalar(select(User).where(User.email == email))


async def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_staff_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role not in (
        UserRole.admin,
        UserRole.manager,
        UserRole.content_manager,
        UserRole.warehouse_manager,
        UserRole.sales_processor,
    ):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_catalog_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if not can_manage_catalog(current_user.role):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_warehouse_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if not can_manage_warehouse(current_user.role):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_sales_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if not can_manage_sales(current_user.role):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

