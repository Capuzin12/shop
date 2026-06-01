from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from models import (
    Inventory,
    InventoryMovement,
    MovementType,
    Notification,
    NotificationType,
    Product,
    Wishlist,
    User,
)
from routers.deps import get_current_warehouse_user, get_db
from services.inventory import create_low_stock_notifications
from services.serializers import serialize_inventory_summary

from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(tags=["inventory"])


@router.get("/api/inventory")
def get_inventory(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
    q: str | None = None,
):
    query = select(Inventory).options(selectinload(Inventory.product))
    if q:
        normalized = f"%{str(q).strip().lower()}%"
        query = (
            query
            .join(Product, Inventory.product_id == Product.id)
            .where(
                or_(
                    func.lower(Product.name).like(normalized),
                    func.lower(Product.sku).like(normalized),
                    func.lower(func.coalesce(Inventory.location, "")).like(normalized),
                )
            )
        )
    return [serialize_inventory_summary(item) for item in db.scalars(query.order_by(Inventory.updated_at.desc())).all()]


@router.put("/api/inventory/{inventory_id}")
def update_inventory(
    inventory_id: int,
    inventory_data: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    db_inventory = db.get(Inventory, inventory_id)
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    try:
        old_quantity = db_inventory.quantity
        for key, value in inventory_data.items():
            setattr(db_inventory, key, value)
        quantity_changed = "quantity" in inventory_data and int(db_inventory.quantity or 0) != int(old_quantity or 0)
        if "quantity" in inventory_data:
            min_alert = db_inventory.min_quantity_alert or db_inventory.min_quantity
            if old_quantity >= min_alert and db_inventory.quantity < min_alert:
                create_low_stock_notifications(db, [db_inventory])
            if old_quantity == 0 and db_inventory.quantity > 0:
                subscribers = db.scalars(select(Wishlist).where(Wishlist.product_id == db_inventory.product_id)).all()
                for subscription in subscribers:
                    db.add(Notification(
                        user_id=subscription.user_id,
                        type=NotificationType.system,
                        title="Товар знову в наявності",
                        message=f"Товар '{db_inventory.product.name}' знову доступний для замовлення.",
                        target_path=f"/product/{db_inventory.product_id}",
                        target_product_id=db_inventory.product_id,
                    ))
            if quantity_changed:
                db.add(
                    InventoryMovement(
                        product_id=db_inventory.product_id,
                        type=MovementType.adjustment,
                        quantity=int(db_inventory.quantity or 0) - int(old_quantity or 0),
                        quantity_before=int(old_quantity or 0),
                        quantity_after=int(db_inventory.quantity or 0),
                        note="Ручна зміна залишку через редагування складу",
                        created_by=getattr(current_user, "id", None),
                    )
                )
        db.commit()
        db.refresh(db_inventory)
        return serialize_inventory_summary(db_inventory)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/api/inventory/{inventory_id}/adjust")
def adjust_inventory(
    inventory_id: int,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    db_inventory = db.get(Inventory, inventory_id)
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    try:
        delta = int(payload.get("delta", 0))
    except Exception:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DELTA", "message": "delta must be integer"})

    movement_type_raw = str(payload.get("movement_type", "receipt") or "receipt")
    note = str(payload.get("note", "") or "").strip()[:500] or None

    if delta == 0:
        raise HTTPException(status_code=400, detail={"code": "ZERO_DELTA", "message": "Зміна кількості не може бути 0"})

    # movement type normalization
    try:
        movement_type = MovementType(movement_type_raw)
    except ValueError:
        movement_type = MovementType.adjustment

    # write_off should always reduce
    if movement_type == MovementType.write_off and delta > 0:
        delta = -delta

    quantity_before = int(db_inventory.quantity or 0)
    quantity_after = quantity_before + delta

    if quantity_after < 0:
        raise HTTPException(status_code=400, detail={
            "code": "INSUFFICIENT_STOCK",
            "message": f"Недостатньо товару. На складі: {quantity_before}, намагаєтесь списати: {abs(delta)}",
        })

    if db_inventory.max_quantity and quantity_after > db_inventory.max_quantity:
        raise HTTPException(status_code=400, detail={
            "code": "EXCEEDS_MAX_QUANTITY",
            "message": f"Перевищено максимальний запас: {db_inventory.max_quantity}",
        })

    # apply change and create movement
    try:
        db_inventory.quantity = quantity_after

        movement = InventoryMovement(
            product_id=db_inventory.product_id,
            type=movement_type,
            quantity=delta,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            note=note,
            created_by=getattr(current_user, "id", None),
        )
        db.add(movement)

        # notify low stock if crossed threshold
        min_alert = db_inventory.min_quantity_alert or db_inventory.min_quantity
        if quantity_before >= min_alert and quantity_after < min_alert:
            create_low_stock_notifications(db, [db_inventory])

        db.commit()
        db.refresh(db_inventory)
        return serialize_inventory_summary(db_inventory)
    except SQLAlchemyError:
        db.rollback()
        raise


@router.get("/api/inventory/{inventory_id}/movements")
def get_inventory_movements(
    inventory_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
    limit: int = 20,
    offset: int = 0,
):
    db_inventory = db.get(Inventory, inventory_id)
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    movements = db.scalars(
        select(InventoryMovement)
        .where(InventoryMovement.product_id == db_inventory.product_id)
        .options(selectinload(InventoryMovement.product))
        .order_by(InventoryMovement.created_at.desc())
        .offset(offset)
        .limit(min(limit, 100))
    ).all()

    total = db.scalar(
        select(func.count(InventoryMovement.id)).where(InventoryMovement.product_id == db_inventory.product_id)
    ) or 0

    return {
        "items": [
            {
                "id": m.id,
                "type": m.type.value if hasattr(m.type, "value") else str(m.type),
                "quantity": m.quantity,
                "quantity_before": m.quantity_before,
                "quantity_after": m.quantity_after,
                "note": m.note,
                "created_by": m.created_by,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in movements
        ],
        "total": int(total),
        "limit": limit,
        "offset": offset,
    }


@router.get("/api/inventory/movements/recent")
def get_recent_movements(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
    limit: int = 50,
):
    stmt = select(
        InventoryMovement.id,
        InventoryMovement.type,
        InventoryMovement.quantity,
        InventoryMovement.quantity_before,
        InventoryMovement.quantity_after,
        InventoryMovement.note,
        InventoryMovement.created_by,
        InventoryMovement.created_at,
        Product.name.label("product_name"),
        Product.sku.label("product_sku"),
        User.first_name.label("created_by_first_name"),
        User.last_name.label("created_by_last_name"),
    ).select_from(InventoryMovement)
    stmt = stmt.join(Product, Product.id == InventoryMovement.product_id).outerjoin(User, User.id == InventoryMovement.created_by)
    stmt = stmt.order_by(InventoryMovement.created_at.desc()).limit(min(limit, 100))

    rows = db.execute(stmt).mappings().all()

    return [
        {
            "id": row["id"],
            "type": row["type"].value if hasattr(row["type"], "value") else str(row["type"]),
            "quantity": row["quantity"],
            "quantity_before": row["quantity_before"],
            "quantity_after": row["quantity_after"],
            "note": row["note"],
            "product_name": row["product_name"],
            "product_sku": row["product_sku"],
            "created_by_name": f"{row['created_by_first_name'] or ''} {row['created_by_last_name'] or ''}".strip() or "Система",
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]

