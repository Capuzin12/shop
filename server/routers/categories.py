from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import cast

from models import Category
from routers.deps import get_current_catalog_user, get_db
from services.helpers import _parse_optional_int_field
from services.serializers import serialize_category

router = APIRouter(tags=["categories"])


def _normalize_category_payload(payload: dict, *, require_basic: bool) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_CATEGORY_PAYLOAD", "message": "Некоректний формат категорії"})

    normalized: dict = {}
    field_map = {
        "parent_id": ("int", True),
        "name": ("text", False),
        "slug": ("text", False),
        "description": ("text", True),
        "icon": ("text", True),
        "image_url": ("text", True),
        "sort_order": ("int", True),
        "is_active": ("bool", True),
    }
    for key, (kind, nullable) in field_map.items():
        if key not in payload:
            continue
        value = payload.get(key)
        if kind == "int":
            parsed = _parse_optional_int_field(value, key)
            if parsed is None:
                normalized[key] = None
            elif key == "sort_order":
                normalized[key] = parsed
            elif parsed <= 0:
                normalized[key] = None
            else:
                normalized[key] = parsed
        elif kind == "bool":
            normalized[key] = bool(value)
        else:
            cleaned = str(value or "").strip()
            if key in {"name", "slug"} and cleaned == "":
                raise HTTPException(status_code=400, detail={"code": "INVALID_CATEGORY_FIELD", "field": key, "message": "Поле не може бути порожнім"})
            normalized[key] = cleaned if cleaned else None

    if require_basic:
        for field in ("name", "slug"):
            if normalized.get(field) in (None, ""):
                raise HTTPException(status_code=400, detail={"code": "INVALID_CATEGORY_FIELD", "field": field, "message": "Поле обов'язкове"})
    return normalized


@router.get("/api/categories")
def get_categories(db: Annotated[Session, Depends(get_db)], active_only: bool = True):
    query = select(Category)
    if active_only:
        query = query.where(Category.is_active == True)
    categories = db.scalars(query.order_by(Category.sort_order.asc(), Category.name.asc())).all()
    return [serialize_category(cast(Category, category)) for category in categories]


@router.get("/api/categories/{category_id}")
def get_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[object, Depends(get_current_catalog_user)],
):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Категорію не знайдено"})
    return serialize_category(cast(Category, category))


@router.post("/api/categories")
def create_category(
    category: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[object, Depends(get_current_catalog_user)],
):
    normalized = _normalize_category_payload(category, require_basic=True)
    new_category = Category(**normalized)
    db.add(new_category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "CATEGORY_EXISTS", "message": "Категорія з таким slug вже існує"})
    db.refresh(new_category)
    return serialize_category(new_category)


@router.put("/api/categories/{category_id}")
def update_category(
    category_id: int,
    category: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[object, Depends(get_current_catalog_user)],
):
    db_category = db.get(Category, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Категорію не знайдено"})
    normalized = _normalize_category_payload(category, require_basic=False)
    for key, value in normalized.items():
        setattr(db_category, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "CATEGORY_EXISTS", "message": "Категорія з таким slug вже існує"})
    db.refresh(db_category)
    return serialize_category(cast(Category, db_category))


@router.delete("/api/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[object, Depends(get_current_catalog_user)],
):
    db_category = db.get(Category, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Категорію не знайдено"})
    db.delete(db_category)
    db.commit()
    return {"message": "Категорію видалено"}

