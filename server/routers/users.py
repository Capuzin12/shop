from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from models import CustomerGroup, User, UserRole
from routers.deps import get_current_admin_user, get_db
from schemas.auth import UserCreateRequest
from security import limiter
from services.auth import get_password_hash, validate_password_strength
from services.serializers import serialize_user_summary

router = APIRouter(tags=["users"])


@router.get("/api/users")
def get_users(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_admin_user),
):
    users = db.scalars(select(User).options(selectinload(User.customer_group))).all()
    return [serialize_user_summary(user) for user in users]


@router.post("/api/users")
@limiter.limit("10/minute")
def create_user(
    request: Request,
    user: UserCreateRequest,
    db: Annotated[Session, Depends(get_db)],
):
    existing = db.scalar(select(User).where(User.email == user.email))
    if existing:
        raise HTTPException(status_code=409, detail={"code": "EMAIL_EXISTS", "message": "Користувач з таким email вже існує"})
    validate_password_strength(user.password)
    new_user = User(
        email=user.email.strip().lower(),
        password_hash=get_password_hash(user.password),
        first_name=str(user.first_name).strip()[:100],
        last_name=str(user.last_name).strip()[:100],
        phone=str(user.phone).strip()[:20] if user.phone else None,
        role=UserRole.customer,
        is_active=True,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "EMAIL_EXISTS", "message": "Користувач з таким email вже існує"})
    db.refresh(new_user)
    return {"message": "User created", "user": {"email": new_user.email, "first_name": new_user.first_name}}


@router.put("/api/users/{user_id}")
def update_user(
    user_id: int,
    user_data: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_admin_user),
):
    db_user = db.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if "email" in user_data:
        new_email = str(user_data.get("email", "")).strip()
        if new_email and new_email != db_user.email:
            existing_user = db.scalar(select(User).where(User.email == new_email))
            if existing_user:
                raise HTTPException(status_code=400, detail={"code": "EMAIL_DUPLICATE", "message": "Цей email вже використовується іншим користувачем"})
    for key, value in user_data.items():
        if key not in {"email", "first_name", "last_name", "phone", "role", "is_active", "password"}:
            continue
        if key == "password":
            if not value:
                continue
            validate_password_strength(str(value))
            key, value = "password_hash", get_password_hash(value)
        elif key == "role":
            try:
                value = UserRole(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid user role")
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return serialize_user_summary(db_user)


@router.get("/api/users/{user_id}/public")
def get_public_user_profile(user_id: int, db: Annotated[Session, Depends(get_db)]):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "Користувача не знайдено"})
    return {"id": user.id, "first_name": user.first_name, "last_name": user.last_name, "role": user.role.value if hasattr(user.role, "value") else str(user.role)}


@router.patch("/api/users/{user_id}/customer-group")
def assign_user_customer_group(
    user_id: int,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_admin_user),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "Користувача не знайдено"})
    group_id = (payload or {}).get("customer_group_id")
    if group_id in (None, ""):
        user.customer_group_id = None
    else:
        try:
            parsed = int(group_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail={"code": "INVALID_GROUP_ID", "message": "Некоректний id групи"})
        group = db.get(CustomerGroup, parsed)
        if not group:
            raise HTTPException(status_code=404, detail={"code": "CUSTOMER_GROUP_NOT_FOUND", "message": "Групу не знайдено"})
        user.customer_group_id = group.id
    db.commit()
    db.refresh(user)
    return serialize_user_summary(user)

