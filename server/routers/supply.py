from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models import Product, Supplier, SupplyOrder, SupplyOrderItem
from routers.deps import get_current_warehouse_user, get_db
from services.helpers import _parse_optional_datetime, generate_invoice_number

router = APIRouter(tags=["supply"])


@router.get("/api/warehouse/supply-orders")
def get_supply_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    orders = db.scalars(select(SupplyOrder).options(selectinload(SupplyOrder.items), selectinload(SupplyOrder.supplier)).order_by(SupplyOrder.created_at.desc())).all()
    return [{
        "id": order.id,
        "supplier_id": order.supplier_id,
        "supplier_name": order.supplier.name if order.supplier else None,
        "invoice_number": order.invoice_number,
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "total_amount": order.total_amount,
        "notes": order.notes,
        "ordered_at": order.ordered_at.isoformat() if order.ordered_at else None,
        "expected_at": order.expected_at.isoformat() if order.expected_at else None,
        "received_at": order.received_at.isoformat() if order.received_at else None,
        "created_by": order.created_by,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items_count": len(order.items) if order.items else 0,
    } for order in orders]


@router.get("/api/warehouse/supply-orders/{order_id}")
def get_supply_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    order = db.scalar(select(SupplyOrder).where(SupplyOrder.id == order_id).options(selectinload(SupplyOrder.items), selectinload(SupplyOrder.supplier)))
    if not order:
        raise HTTPException(status_code=404, detail={"code": "SUPPLY_ORDER_NOT_FOUND", "message": "Поставку не знайдено"})
    return {
        "id": order.id,
        "supplier_id": order.supplier_id,
        "supplier_name": order.supplier.name if order.supplier else None,
        "invoice_number": order.invoice_number,
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "total_amount": order.total_amount,
        "notes": order.notes,
        "ordered_at": order.ordered_at.isoformat() if order.ordered_at else None,
        "expected_at": order.expected_at.isoformat() if order.expected_at else None,
        "received_at": order.received_at.isoformat() if order.received_at else None,
        "created_by": order.created_by,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [{
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else "Unknown",
            "product_sku": item.product.sku if item.product else None,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item.total_price,
        } for item in (order.items or [])],
    }


@router.post("/api/warehouse/supply-orders", status_code=status.HTTP_201_CREATED)
def create_supply_order(
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    supplier_id = int((payload or {}).get("supplier_id", 0))
    if supplier_id <= 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SUPPLIER_ID", "message": "Вкажіть постачальника"})
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail={"code": "SUPPLIER_NOT_FOUND", "message": "Постачальника не знайдено"})
    invoice_number = generate_invoice_number(supplier_id)
    if db.scalar(select(SupplyOrder).where(SupplyOrder.invoice_number == invoice_number)):
        invoice_number = generate_invoice_number(supplier_id)
    order = SupplyOrder(
        supplier_id=supplier_id,
        invoice_number=invoice_number,
        status="draft" if hasattr("draft", "value") else "draft",
        total_amount=0,
        notes=str((payload or {}).get("notes") or "").strip() or None,
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {
        "id": order.id,
        "supplier_id": order.supplier_id,
        "supplier_name": supplier.name,
        "invoice_number": order.invoice_number,
        "status": order.status,
        "total_amount": order.total_amount,
        "notes": order.notes,
        "created_by": order.created_by,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@router.put("/api/warehouse/supply-orders/{order_id}", status_code=status.HTTP_200_OK)
def update_supply_order(
    order_id: int,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    order = db.get(SupplyOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "SUPPLY_ORDER_NOT_FOUND", "message": "Поставку не знайдено"})
    if "status" in (payload or {}):
        order.status = str((payload or {}).get("status"))
    if "ordered_at" in (payload or {}):
        order.ordered_at = _parse_optional_datetime((payload or {}).get("ordered_at"))
    if "expected_at" in (payload or {}):
        order.expected_at = _parse_optional_datetime((payload or {}).get("expected_at"))
    if "received_at" in (payload or {}):
        order.received_at = _parse_optional_datetime((payload or {}).get("received_at"))
    if "notes" in (payload or {}):
        order.notes = str((payload or {}).get("notes") or "").strip() or None
    db.commit()
    db.refresh(order)
    return {
        "id": order.id,
        "supplier_id": order.supplier_id,
        "invoice_number": order.invoice_number,
        "status": order.status,
        "total_amount": order.total_amount,
        "notes": order.notes,
        "ordered_at": order.ordered_at.isoformat() if order.ordered_at else None,
        "expected_at": order.expected_at.isoformat() if order.expected_at else None,
        "received_at": order.received_at.isoformat() if order.received_at else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@router.delete("/api/warehouse/supply-orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supply_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    order = db.scalar(select(SupplyOrder).where(SupplyOrder.id == order_id).options(selectinload(SupplyOrder.items)))
    if not order:
        raise HTTPException(status_code=404, detail={"code": "SUPPLY_ORDER_NOT_FOUND", "message": "Поставку не знайдено"})
    for item in order.items or []:
        db.delete(item)
    db.delete(order)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/api/warehouse/supply-orders/{order_id}/items", status_code=status.HTTP_201_CREATED)
def add_supply_order_item(
    order_id: int,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    order = db.get(SupplyOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "SUPPLY_ORDER_NOT_FOUND", "message": "Поставку не знайдено"})
    product_id = int((payload or {}).get("product_id", 0))
    if product_id <= 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_ID", "message": "Вкажіть товар"})
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    try:
        quantity = int((payload or {}).get("quantity", 1))
        unit_price = float((payload or {}).get("unit_price", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_QUANTITY_OR_PRICE", "message": "Кількість та ціна мають бути числами"})
    if quantity <= 0 or unit_price < 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_VALUES", "message": "Перевірте кількість та ціну"})
    item = SupplyOrderItem(supply_order_id=order.id, product_id=product_id, quantity=quantity, unit_price=unit_price)
    db.add(item)
    order.total_amount = float(order.total_amount or 0) + (quantity * unit_price)
    db.add(order)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "supply_order_id": item.supply_order_id,
        "product_id": item.product_id,
        "product_name": product.name,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "total_price": item.total_price,
    }


@router.delete("/api/warehouse/supply-orders/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_supply_order_item(
    order_id: int,
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    order = db.get(SupplyOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "SUPPLY_ORDER_NOT_FOUND", "message": "Поставку не знайдено"})
    item = db.get(SupplyOrderItem, item_id)
    if not item or item.supply_order_id != order_id:
        raise HTTPException(status_code=404, detail={"code": "ITEM_NOT_FOUND", "message": "Позицію не знайдено"})
    order.total_amount = float(order.total_amount or 0) - item.total_price
    db.add(order)
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
