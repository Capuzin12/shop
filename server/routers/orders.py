from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from logging_config import get_logger, get_request_id, set_user_id
from models import Inventory, MovementType, Notification, NotificationType, Order, OrderItem, OrderMessage, OrderStatus, User, UserRole
from routers.deps import can_manage_sales, get_current_active_user, get_current_admin_user, get_current_sales_user, get_db
from security import limiter
from services.helpers import _to_iso_or_none, generate_tracking_number
from services.inventory import restock_order_items
from services.orders import create_order, get_order_status_ua
from services.serializers import serialize_order_message, serialize_order_summary

router = APIRouter(tags=["orders"])
logger = get_logger(__name__)
ORDER_STATUS_FLOW = {
    OrderStatus.new: {OrderStatus.processing, OrderStatus.cancelled},
    OrderStatus.processing: {OrderStatus.shipped, OrderStatus.cancelled},
    OrderStatus.shipped: {OrderStatus.delivered, OrderStatus.picked_up, OrderStatus.refunded},
    OrderStatus.delivered: {OrderStatus.refunded},
    OrderStatus.picked_up: {OrderStatus.refunded},
    OrderStatus.cancelled: set(),
    OrderStatus.refunded: set(),
}


def _get_orders_fallback_rows(db: Session, current_user: User):
    orders_query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if not can_manage_sales(current_user.role):
        orders_query = orders_query.where(Order.user_id == current_user.id)
    orders = db.scalars(orders_query).all()
    order_ids = [int(order.id) for order in orders if order.id is not None]
    items_by_order = {}
    if order_ids:
        for item in db.scalars(select(OrderItem).where(OrderItem.order_id.in_(order_ids)).order_by(OrderItem.id.asc())).all():
            items_by_order.setdefault(int(item.order_id), []).append({"id": item.id, "product_id": item.product_id, "product_name": item.product_name, "product_sku": item.product_sku, "quantity": item.quantity, "unit_price": item.unit_price})
    return [{
        "id": order.id,
        "user_id": order.user_id,
        "contact_name": order.contact_name,
        "contact_phone": order.contact_phone,
        "contact_email": order.contact_email,
        "delivery_city": order.delivery_city,
        "delivery_address": order.delivery_address,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "subtotal": order.subtotal,
        "delivery_cost": order.delivery_cost,
        "discount": order.discount,
        "total": order.total,
        "delivery_method": order.delivery_method.value if hasattr(order.delivery_method, "value") else order.delivery_method,
        "payment_method": order.payment_method.value if hasattr(order.payment_method, "value") else order.payment_method,
        "payment_status": order.payment_status.value if hasattr(order.payment_status, "value") else order.payment_status,
        "created_at": _to_iso_or_none(order.created_at),
        "updated_at": _to_iso_or_none(order.updated_at),
        "items": items_by_order.get(int(order.id), []),
    } for order in orders]


def _get_serialized_orders_for_query(db: Session, query):
    orders = db.scalars(query).all()
    return [serialize_order_summary(order) for order in orders]


def parse_order_status(value) -> OrderStatus:
    if isinstance(value, OrderStatus):
        return value
    try:
        return OrderStatus(str(value))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid order status")


def ensure_status_transition_allowed(old_status: OrderStatus, new_status: OrderStatus):
    if old_status == new_status:
        return
    if new_status not in ORDER_STATUS_FLOW.get(old_status, set()):
        raise HTTPException(status_code=400, detail={"code": "INVALID_STATUS_TRANSITION", "message": f"Перехід зі статусу '{old_status.value}' у '{new_status.value}' неможливий"})


@router.get("/api/orders")
def get_orders(db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_active_user)):
    query = select(Order).where(Order.user_id == current_user.id).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    try:
        return _get_serialized_orders_for_query(db, query)
    except Exception:
        return _get_orders_fallback_rows(db, current_user)


@router.get("/api/staff/orders")
def get_staff_orders(db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_sales_user)):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    try:
        return _get_serialized_orders_for_query(db, query)
    except Exception:
        return _get_orders_fallback_rows(db, current_user)


@router.get("/api/orders/{order_id}")
def get_order(order_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_active_user)):
    try:
        order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if not can_manage_sales(current_user.role) and order.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        return serialize_order_summary(order)
    except HTTPException:
        raise
    except Exception:
        matched = next((item for item in _get_orders_fallback_rows(db, current_user) if int(item.get("id", 0)) == int(order_id)), None)
        if not matched:
            raise HTTPException(status_code=404, detail="Order not found")
        return matched


@router.post("/api/orders")
@limiter.limit("10/minute")
def create_order_endpoint(request: Request, order_data: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_active_user)):
    return create_order(order_data, db, current_user)


@router.put("/api/orders/{order_id}")
@limiter.limit("30/minute")
def update_order(request: Request, order_id: int, order_data: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_sales_user)):
    from audit_log import create_audit_log, create_order_status_change_audit
    set_user_id(current_user.id)
    db_order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        old_status, new_status = parse_order_status(db_order.status), parse_order_status(db_order.status)
        if "status" in order_data:
            new_status = parse_order_status(order_data.get("status"))
            ensure_status_transition_allowed(old_status, new_status)
            db_order.status = new_status
        if old_status == OrderStatus.picked_up and new_status != OrderStatus.refunded:
            raise HTTPException(status_code=400, detail={"code": "ORDER_LOCKED", "message": "Замовлення зі статусом 'Забрано' можна лише повернути."})
        for key, value in order_data.items():
            if key in {"tracking_number", "admin_note", "payment_status", "delivery_method", "payment_method"}:
                if old_status != OrderStatus.picked_up:
                    setattr(db_order, key, value)
        if old_status != new_status and new_status == OrderStatus.shipped and not db_order.tracking_number:
            db_order.tracking_number = generate_tracking_number()
        if old_status != new_status and new_status == OrderStatus.cancelled:
            restock_order_items(db, db_order, note_prefix="Скасування замовлення")
            create_audit_log(db, current_user.id, "status_change", "order", order_id, {"from": old_status.value, "to": new_status.value}, request=request)
        if old_status != new_status and db_order.user_id is None and db_order.contact_email:
            linked_user = db.scalar(select(User).where(User.email == db_order.contact_email))
            if linked_user:
                db_order.user_id = linked_user.id
        if old_status != new_status and db_order.user_id is not None:
            db.add(Notification(user_id=db_order.user_id, type=NotificationType.order_status, title=f"Статус замовлення #{db_order.id} змінено", message=f"Ваше замовлення #{db_order.id} змінило статус з '{get_order_status_ua(old_status.value)}' на '{get_order_status_ua(new_status.value)}'", target_path="/profile", target_order_id=db_order.id))
            create_order_status_change_audit(db, current_user.id, order_id, old_status.value, new_status.value, request=request)
        db.commit()
        db.refresh(db_order)
        return serialize_order_summary(db_order)
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error("Error updating order", extra={"order_id": order_id, "error": str(error)})
        raise


@router.post("/api/orders/{order_id}/cancel")
def cancel_order(order_id: int, payload: dict | None, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_active_user)):
    order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id and not can_manage_sales(current_user.role):
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        old_status = parse_order_status(order.status)
        if old_status not in (OrderStatus.new, OrderStatus.processing):
            raise HTTPException(status_code=400, detail={"code": "CANCEL_NOT_ALLOWED", "message": "Скасування доступне лише для замовлень зі статусом 'Нове' або 'В обробці'."})
        reason = str((payload or {}).get("reason") or "").strip()
        if reason:
            order.admin_note = f"{order.admin_note + chr(10) if order.admin_note else ''}Скасовано клієнтом: {reason[:300]}"
        order.status = OrderStatus.cancelled
        restock_order_items(db, order, note_prefix="Скасування клієнтом")
        staff_users = db.scalars(select(User).where(User.role.in_([UserRole.admin, UserRole.sales_processor, UserRole.manager]), User.is_active == True)).all()
        for staff in staff_users:
            db.add(Notification(user_id=staff.id, type=NotificationType.order_status, title=f"Клієнт скасував замовлення #{order.id}", message=f"Замовлення #{order.id} скасовано клієнтом {current_user.first_name} {current_user.last_name}.", target_path="/manager?tab=orders", target_order_id=order.id))
        db.commit()
        db.refresh(order)
        return serialize_order_summary(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.get("/api/orders/{order_id}/messages")
def get_order_messages(order_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_active_user), limit: int = 100, offset: int = 0):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_manage_sales(current_user.role) and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    messages = db.scalars(select(OrderMessage).where(OrderMessage.order_id == order_id).options(selectinload(OrderMessage.sender)).order_by(OrderMessage.created_at.desc()).offset(max(offset, 0)).limit(min(max(limit, 1), 200))).all()
    return {"order_id": order_id, "messages": [serialize_order_message(message) for message in reversed(messages)], "limit": min(max(limit, 1), 200), "offset": max(offset, 0)}


@router.post("/api/orders/{order_id}/messages")
@limiter.limit("30/minute")
def create_order_message(request: Request, order_id: int, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_active_user)):
    set_user_id(current_user.id)
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_manage_sales(current_user.role) and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        body = str((payload or {}).get("body") or "").strip()
        if len(body) < 2:
            raise HTTPException(status_code=400, detail={"code": "INVALID_MESSAGE", "message": "Повідомлення має містити щонайменше 2 символи"})
        message = OrderMessage(order_id=order.id, sender_id=current_user.id, body=body[:1200], is_from_staff=can_manage_sales(current_user.role))
        db.add(message)
        db.flush()
        recipient_ids = [order.user_id] if message.is_from_staff and order.user_id else ([] if message.is_from_staff else [user.id for user in db.scalars(select(User).where(User.role.in_([UserRole.admin, UserRole.sales_processor, UserRole.manager]), User.is_active == True)).all()])
        for recipient_id in recipient_ids:
            if recipient_id != current_user.id:
                db.add(Notification(user_id=recipient_id, type=NotificationType.system, title=f"Нове повідомлення по замовленню #{order.id}", message=body[:180], target_path="/profile" if not message.is_from_staff else "/manager?tab=orders", target_order_id=order.id))
        db.commit()
        message = db.scalar(select(OrderMessage).where(OrderMessage.id == message.id).options(selectinload(OrderMessage.sender)))
        return serialize_order_message(message)
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error("Error creating order message", extra={"order_id": order_id, "error": str(error), "request_id": get_request_id()})
        raise

