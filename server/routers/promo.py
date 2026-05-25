from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import DiscountType, PromoCode
from routers.deps import get_current_active_user, get_current_catalog_user, get_db
from services.helpers import _parse_optional_datetime, _parse_optional_float_field, _parse_optional_int_field
from services.orders import validate_promo_code
from services.serializers import serialize_promo_code

router = APIRouter(tags=["promo"])


def _normalize_promo_code_payload(payload: dict, *, require_basic: bool) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_PAYLOAD", "message": "Некоректний формат промокоду"})

    normalized: dict = {}
    for key in ("code", "description", "discount_type", "discount_value", "min_order_amount", "max_uses", "used_count", "valid_from", "valid_until", "is_active"):
        if key not in payload:
            continue
        value = payload.get(key)
        if key == "is_active":
            normalized[key] = bool(value)
        elif key == "discount_type":
            try:
                normalized[key] = DiscountType(str(value))
            except ValueError:
                raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_FIELD", "field": key, "message": "Некоректний тип знижки"})
        elif key in {"discount_value", "min_order_amount"}:
            parsed = _parse_optional_float_field(value, key, allow_none=False)
            if key == "discount_value" and parsed < 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_FIELD", "field": key, "message": "Значення знижки не може бути від'ємним"})
            if key == "min_order_amount" and parsed < 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_FIELD", "field": key, "message": "Мінімальна сума не може бути від'ємною"})
            normalized[key] = parsed
        elif key in {"max_uses", "used_count"}:
            parsed = _parse_optional_int_field(value, key)
            normalized[key] = parsed if parsed is not None else None
        elif key in {"valid_from", "valid_until"}:
            normalized[key] = _parse_optional_datetime(value)
        else:
            cleaned = str(value or "").strip()
            if key == "code" and cleaned == "":
                raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_FIELD", "field": key, "message": "Поле не може бути порожнім"})
            normalized[key] = cleaned if cleaned else None

    if require_basic:
        for field in ("code", "discount_type", "discount_value"):
            if normalized.get(field) in (None, ""):
                raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_FIELD", "field": field, "message": "Поле обов'язкове"})
    return normalized


@router.get("/api/promo-codes")
def get_promo_codes(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    promo_codes = db.scalars(select(PromoCode).order_by(PromoCode.created_at.desc())).all()
    return [serialize_promo_code(promo) for promo in promo_codes]


@router.post("/api/promo-codes/validate")
def validate_promo_code_endpoint(
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_active_user),
):
    return validate_promo_code(payload, db, current_user)


@router.get("/api/promo-codes/{promo_code_id}")
def get_promo_code(
    promo_code_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    promo_code = db.get(PromoCode, promo_code_id)
    if not promo_code:
        raise HTTPException(status_code=404, detail={"code": "PROMO_NOT_FOUND", "message": "Промокод не знайдено"})
    return serialize_promo_code(promo_code)


@router.post("/api/promo-codes")
def create_promo_code(
    promo_code: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    normalized = _normalize_promo_code_payload(promo_code, require_basic=True)
    new_promo_code = PromoCode(**normalized)
    db.add(new_promo_code)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "PROMO_EXISTS", "message": "Промокод з таким кодом вже існує"})
    db.refresh(new_promo_code)
    return serialize_promo_code(new_promo_code)


@router.put("/api/promo-codes/{promo_code_id}")
def update_promo_code(
    promo_code_id: int,
    promo_code: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    db_promo_code = db.get(PromoCode, promo_code_id)
    if not db_promo_code:
        raise HTTPException(status_code=404, detail={"code": "PROMO_NOT_FOUND", "message": "Промокод не знайдено"})
    normalized = _normalize_promo_code_payload(promo_code, require_basic=False)
    for key, value in normalized.items():
        setattr(db_promo_code, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "PROMO_EXISTS", "message": "Промокод з таким кодом вже існує"})
    db.refresh(db_promo_code)
    return serialize_promo_code(db_promo_code)


@router.delete("/api/promo-codes/{promo_code_id}")
def delete_promo_code(
    promo_code_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    db_promo_code = db.get(PromoCode, promo_code_id)
    if not db_promo_code:
        raise HTTPException(status_code=404, detail={"code": "PROMO_NOT_FOUND", "message": "Промокод не знайдено"})
    db.delete(db_promo_code)
    db.commit()
    return {"message": "Промокод видалено"}

