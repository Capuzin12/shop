from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from models import Inventory, Notification
from routers.deps import can_manage_sales, get_current_active_user, get_current_warehouse_user, get_db
from services.helpers import _to_iso_or_none
from services.inventory import create_low_stock_notifications
from services.serializers import _serialize_notification

router = APIRouter(tags=["notifications"])


def _get_notifications_fallback_rows(db: Session, current_user, limit: int, offset: int):
    safe_limit = min(max(int(limit or 100), 1), 200)
    safe_offset = max(int(offset or 0), 0)
    rows = db.execute(
        text(
            """
            SELECT id, user_id, type, title, message, target_path, target_product_id,
                   target_inventory_id, target_order_id, is_read, created_at
            FROM notifications
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"user_id": current_user.id, "limit": safe_limit, "offset": safe_offset},
    ).mappings().all()
    total = db.scalar(text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id"), {"user_id": current_user.id}) or 0
    items = []
    for row in rows:
        items.append({
            "id": row.get("id"),
            "user_id": row.get("user_id"),
            "type": str(row.get("type") or "system"),
            "title": row.get("title"),
            "message": row.get("message"),
            "target_path": row.get("target_path")
            or ("/manager?tab=orders" if row.get("target_order_id") and can_manage_sales(current_user.role) else "/profile" if row.get("target_order_id") else "/notifications"),
            "target_product_id": row.get("target_product_id"),
            "target_inventory_id": row.get("target_inventory_id"),
            "target_order_id": row.get("target_order_id"),
            "is_read": bool(row.get("is_read")),
            "created_at": _to_iso_or_none(row.get("created_at")),
        })
    return {"items": items, "total": int(total), "limit": safe_limit, "offset": safe_offset}


@router.get("/api/notifications")
def get_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_active_user),
    limit: int = 100,
    offset: int = 0,
):
    try:
        safe_limit = min(max(int(limit or 100), 1), 200)
        safe_offset = max(int(offset or 0), 0)
        notifications = db.scalars(
            select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).offset(safe_offset).limit(safe_limit)
        ).all()
        total = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == current_user.id)) or 0
        return {"items": [_serialize_notification(item, current_user) for item in notifications], "total": int(total), "limit": safe_limit, "offset": safe_offset}
    except Exception:
        return _get_notifications_fallback_rows(db, current_user, limit, offset)


@router.put("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_active_user),
):
    notification = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id))
    if not notification:
        raise HTTPException(status_code=404, detail={"code": "NOTIFICATION_NOT_FOUND", "message": "Сповіщення не знайдено"})
    notification.is_read = True
    db.commit()
    return {"id": notification.id, "is_read": True}


@router.get("/api/notifications/check-low-stock")
def check_low_stock(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_warehouse_user),
):
    inventory_items = db.scalars(select(Inventory).options(selectinload(Inventory.product))).all()
    low_stock = [
        item for item in inventory_items
        if int(item.quantity or 0) < int((item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity) or 0)
    ]
    create_low_stock_notifications(db, low_stock)
    return {"count": len(low_stock)}

