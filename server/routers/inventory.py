from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from models import Inventory, Notification, NotificationType, Product, Wishlist
from routers.deps import get_current_warehouse_user, get_db
from services.inventory import create_low_stock_notifications
from services.serializers import serialize_inventory_summary

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
        db.commit()
        db.refresh(db_inventory)
        return serialize_inventory_summary(db_inventory)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

