from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Supplier
from routers.deps import get_current_catalog_user, get_db
from services.serializers import serialize_supplier

router = APIRouter(tags=["suppliers"])


def _normalize_supplier_payload(payload: dict, *, require_basic: bool) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_SUPPLIER_PAYLOAD", "message": "Некоректний формат постачальника"})

    normalized: dict = {}
    for key in ("name", "contact_name", "phone", "email", "address", "payment_terms", "notes", "is_active"):
        if key not in payload:
            continue
        value = payload.get(key)
        if key == "is_active":
            normalized[key] = bool(value)
        else:
            cleaned = str(value or "").strip()
            if key == "name" and cleaned == "":
                raise HTTPException(status_code=400, detail={"code": "INVALID_SUPPLIER_FIELD", "field": key, "message": "Поле не може бути порожнім"})
            normalized[key] = cleaned if cleaned else None

    if require_basic and normalized.get("name") in (None, ""):
        raise HTTPException(status_code=400, detail={"code": "INVALID_SUPPLIER_FIELD", "field": "name", "message": "Поле обов'язкове"})
    return normalized


@router.get("/api/suppliers")
def get_suppliers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    suppliers = db.scalars(select(Supplier).order_by(Supplier.name.asc())).all()
    return [serialize_supplier(supplier) for supplier in suppliers]


@router.get("/api/suppliers/{supplier_id}")
def get_supplier(
    supplier_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail={"code": "SUPPLIER_NOT_FOUND", "message": "Постачальника не знайдено"})
    return serialize_supplier(supplier)


@router.post("/api/suppliers")
def create_supplier(
    supplier: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    normalized = _normalize_supplier_payload(supplier, require_basic=True)
    new_supplier = Supplier(**normalized)
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return serialize_supplier(new_supplier)


@router.put("/api/suppliers/{supplier_id}")
def update_supplier(
    supplier_id: int,
    supplier: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    db_supplier = db.get(Supplier, supplier_id)
    if not db_supplier:
        raise HTTPException(status_code=404, detail={"code": "SUPPLIER_NOT_FOUND", "message": "Постачальника не знайдено"})
    normalized = _normalize_supplier_payload(supplier, require_basic=False)
    for key, value in normalized.items():
        setattr(db_supplier, key, value)
    db.commit()
    db.refresh(db_supplier)
    return serialize_supplier(db_supplier)


@router.delete("/api/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_catalog_user),
):
    db_supplier = db.get(Supplier, supplier_id)
    if not db_supplier:
        raise HTTPException(status_code=404, detail={"code": "SUPPLIER_NOT_FOUND", "message": "Постачальника не знайдено"})
    db.delete(db_supplier)
    db.commit()
    return {"message": "Постачальника видалено"}

