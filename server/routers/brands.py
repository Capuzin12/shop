from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import Brand
from routers.deps import get_current_catalog_user, get_db
from services.serializers import serialize_brand

router = APIRouter(tags=["brands"])


def _normalize_brand_payload(payload: dict, *, require_basic: bool) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_BRAND_PAYLOAD", "message": "Некоректний формат бренду"})

    normalized: dict = {}
    for key in ("name", "slug", "description", "country", "logo_url", "website_url", "is_active"):
        if key not in payload:
            continue
        value = payload.get(key)
        if key == "is_active":
            normalized[key] = bool(value)
        else:
            cleaned = str(value or "").strip()
            if key in {"name", "slug"} and cleaned == "":
                raise HTTPException(status_code=400, detail={"code": "INVALID_BRAND_FIELD", "field": key, "message": "Поле не може бути порожнім"})
            normalized[key] = cleaned if cleaned else None

    if require_basic:
        for field in ("name", "slug"):
            if normalized.get(field) in (None, ""):
                raise HTTPException(status_code=400, detail={"code": "INVALID_BRAND_FIELD", "field": field, "message": "Поле обов'язкове"})
    return normalized


@router.get("/api/brands")
def get_brands(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    brands = db.scalars(select(Brand).order_by(Brand.name.asc())).all()
    return [serialize_brand(brand) for brand in brands]


@router.get("/api/brands/{brand_id}")
def get_brand(
    brand_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail={"code": "BRAND_NOT_FOUND", "message": "Бренд не знайдено"})
    return serialize_brand(brand)


@router.post("/api/brands")
def create_brand(
    brand: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    normalized = _normalize_brand_payload(brand, require_basic=True)
    new_brand = Brand(**normalized)
    db.add(new_brand)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "BRAND_EXISTS", "message": "Бренд з таким slug вже існує"})
    db.refresh(new_brand)
    return serialize_brand(new_brand)


@router.put("/api/brands/{brand_id}")
def update_brand(
    brand_id: int,
    brand: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    db_brand = db.get(Brand, brand_id)
    if not db_brand:
        raise HTTPException(status_code=404, detail={"code": "BRAND_NOT_FOUND", "message": "Бренд не знайдено"})
    normalized = _normalize_brand_payload(brand, require_basic=False)
    for key, value in normalized.items():
        setattr(db_brand, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "BRAND_EXISTS", "message": "Бренд з таким slug вже існує"})
    db.refresh(db_brand)
    return serialize_brand(db_brand)


@router.delete("/api/brands/{brand_id}")
def delete_brand(
    brand_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    db_brand = db.get(Brand, brand_id)
    if not db_brand:
        raise HTTPException(status_code=404, detail={"code": "BRAND_NOT_FOUND", "message": "Бренд не знайдено"})
    db.delete(db_brand)
    db.commit()
    return {"message": "Бренд видалено"}

