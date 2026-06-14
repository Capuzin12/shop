import re
from typing import Any, cast

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from logging_config import get_logger, get_request_id
from models import (
    Cart,
    CartItem,
    DeliveryMethod,
    Inventory,
    InventoryMovement,
    MovementType,
    Notification,
    NotificationType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    PromoCode,
    Product,
    User,
    UserRole,
    PaymentStatus,
)
from services.helpers import normalize_order_items_payload, parse_positive_quantity
from services.inventory import create_low_stock_notifications
from services.pricing import resolve_effective_product_price
from services.serializers import serialize_promo_code

logger = get_logger(__name__)

DELIVERY_RULES = {
    DeliveryMethod.nova_poshta: {
        "base_cost": 90.0,
        "free_from": 4000.0,
        "address_label": "Відділення або поштомат",
        "city_required": True,
        "address_required": True,
        "allowed_payments": {PaymentMethod.card, PaymentMethod.card_online, PaymentMethod.cash, PaymentMethod.bank_transfer},
    },
    DeliveryMethod.ukrposhta: {
        "base_cost": 60.0,
        "free_from": 3000.0,
        "address_label": "Відділення Укрпошти",
        "city_required": True,
        "address_required": True,
        "allowed_payments": {PaymentMethod.card, PaymentMethod.card_online, PaymentMethod.bank_transfer},
    },
    DeliveryMethod.courier: {
        "base_cost": 250.0,
        "free_from": 6000.0,
        "address_label": "Повна адреса доставки",
        "city_required": True,
        "address_required": True,
        "allowed_payments": {PaymentMethod.card, PaymentMethod.card_online, PaymentMethod.cash, PaymentMethod.bank_transfer},
    },
    DeliveryMethod.pickup: {
        "base_cost": 0.0,
        "free_from": 0.0,
        "address_label": "Точка самовивозу",
        "city_required": False,
        "address_required": False,
        "allowed_payments": {PaymentMethod.card, PaymentMethod.card_online, PaymentMethod.cash},
    },
}

PICKUP_LOCATION_CITY = "Київ"
PICKUP_LOCATION_ADDRESS = "Самовивіз: головний склад BuildShop, вул. Промислова, 12"


def _find_promo_code_by_code(db: Session, code: str | None) -> PromoCode | None:
    normalized = str(code or "").strip()
    if not normalized:
        return None
    return db.scalar(select(PromoCode).where(func.lower(PromoCode.code) == normalized.lower()))


def get_order_status_ua(status_value: str) -> str:
    status_map = {
        "new": "Нове",
        "processing": "В обробці",
        "shipped": "Відправлено",
        "delivered": "Доставлено",
        "picked_up": "Забрано",
        "cancelled": "Скасовано",
        "refunded": "Повернено",
    }
    return status_map.get(status_value, status_value)


def can_user_review_product(db: Session, user_id: int, product_id: int) -> bool:
    eligible_statuses = [OrderStatus.delivered, OrderStatus.picked_up]
    return db.scalar(
        select(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.user_id == user_id,
            OrderItem.product_id == product_id,
            Order.status.in_(eligible_statuses),
        )
    ) is not None


def validate_promo_code(payload: dict, db: Session, current_user: User):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_PAYLOAD", "message": "Некоректний формат перевірки промокоду"})

    code = str(payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PROMO_CODE", "field": "code", "message": "Вкажіть промокод"})

    order_amount_raw = payload.get("order_amount", 0)
    try:
        order_amount = float(order_amount_raw or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_ORDER_AMOUNT", "field": "order_amount", "message": "Сума замовлення має бути числом"})
    if order_amount < 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_ORDER_AMOUNT", "field": "order_amount", "message": "Сума замовлення не може бути від'ємною"})

    promo = _find_promo_code_by_code(db, code)
    if not promo:
        return {"valid": False, "message": "Промокод не знайдено", "discount": 0.0, "promo": None}

    is_valid, message = promo.is_valid(order_amount)
    discount = round(promo.calculate_discount(order_amount), 2) if is_valid else 0.0
    return {
        "valid": is_valid,
        "message": message,
        "discount": discount,
        "promo": serialize_promo_code(promo),
    }


def create_order(order_data: dict, db: Session, current_user: User):
    if not isinstance(order_data, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_ORDER_PAYLOAD", "message": "Некоректний формат замовлення"})

    def _clean_text(value, max_len: int = 255) -> str:
        text = str(value or "").strip()
        return text[:max_len]

    def _normalize_phone(value: str) -> str:
        raw = str(value or "").strip()
        cleaned = re.sub(r"[^\d+]", "", raw)
        if cleaned.startswith("00"):
            cleaned = f"+{cleaned[2:]}"
        if not cleaned.startswith("+") and cleaned.startswith("0") and len(cleaned) == 10:
            cleaned = f"+38{cleaned}"
        return cleaned

    def _parse_non_negative(name: str, value, default: float = 0.0) -> float:
        if value in (None, ""):
            return default
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail={"code": "INVALID_NUMERIC_FIELD", "field": name, "message": f"Поле {name} має бути числом"})
        if parsed < 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_NUMERIC_FIELD", "field": name, "message": f"Поле {name} не може бути від'ємним"})
        return parsed

    items_raw = order_data.get("items")
    items_data = normalize_order_items_payload(cast(list[dict], items_raw))

    contact_name = _clean_text(order_data.get("contact_name"), 200)
    if not contact_name:
        fallback_name = " ".join(part for part in [current_user.first_name, current_user.last_name] if part).strip()
        contact_name = fallback_name or _clean_text(current_user.email.split("@")[0], 200)
    if len(contact_name) < 2:
        raise HTTPException(status_code=400, detail={"code": "INVALID_CONTACT_NAME", "field": "contact_name", "message": "Вкажіть коректне ім'я отримувача"})

    contact_phone = _normalize_phone(str(order_data.get("contact_phone") or ""))
    if not contact_phone:
        contact_phone = _normalize_phone(str(current_user.phone or ""))
    if not re.match(r"^\+?\d{10,15}$", contact_phone):
        raise HTTPException(status_code=400, detail={"code": "INVALID_CONTACT_PHONE", "field": "contact_phone", "message": "Вкажіть коректний номер телефону"})

    contact_email = _clean_text(order_data.get("contact_email"), 255) or _clean_text(current_user.email, 255)
    if contact_email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", contact_email):
        raise HTTPException(status_code=400, detail={"code": "INVALID_CONTACT_EMAIL", "field": "contact_email", "message": "Email має некоректний формат"})

    delivery_method_input = order_data.get("delivery_method") or DeliveryMethod.nova_poshta
    payment_method_input = order_data.get("payment_method") or PaymentMethod.card
    try:
        delivery_method = DeliveryMethod(delivery_method_input) if isinstance(delivery_method_input, str) else delivery_method_input
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DELIVERY_METHOD", "field": "delivery_method", "message": "Некоректний спосіб доставки"})
    try:
        payment_method = PaymentMethod(payment_method_input) if isinstance(payment_method_input, str) else payment_method_input
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PAYMENT_METHOD", "field": "payment_method", "message": "Некоректний спосіб оплати"})

    delivery_rule = DELIVERY_RULES[delivery_method]
    if payment_method not in delivery_rule["allowed_payments"]:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "PAYMENT_DELIVERY_COMBINATION_NOT_ALLOWED",
                "field": "payment_method",
                "message": "Обраний спосіб оплати недоступний для цього способу доставки",
            },
        )

    delivery_city = _clean_text(order_data.get("delivery_city"), 100)
    delivery_address = _clean_text(order_data.get("delivery_address"), 500)

    if delivery_method == DeliveryMethod.pickup:
        delivery_city = delivery_city or PICKUP_LOCATION_CITY
        delivery_address = delivery_address or PICKUP_LOCATION_ADDRESS
    else:
        if delivery_rule["city_required"] and not delivery_city:
            raise HTTPException(status_code=400, detail={"code": "INVALID_DELIVERY_CITY", "field": "delivery_city", "message": "Вкажіть місто доставки"})
        if delivery_rule["address_required"] and not delivery_address:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_DELIVERY_ADDRESS",
                    "field": "delivery_address",
                    "message": f"Вкажіть: {delivery_rule['address_label'].lower()}",
                },
            )

    comment = _clean_text(order_data.get("comment"), 1000)
    promo_code_text = str(order_data.get("promo_code") or "").strip()

    filtered_data = {
        "contact_name": contact_name,
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        "delivery_city": delivery_city,
        "delivery_address": delivery_address,
        "delivery_method": delivery_method,
        "payment_method": payment_method,
        "delivery_cost": 0.0,
        "discount": 0.0,
        "comment": comment,
        "payment_status": PaymentStatus.pending,
    }
    if order_data.get("address_id"):
        filtered_data["address_id"] = order_data.get("address_id")
    try:
        order = Order(user_id=current_user.id, **filtered_data)
        db.add(order)
        db.flush()

        subtotal = 0.0
        inventory_changes: list[tuple[int, int, int, int]] = []
        product_ids = [item["product_id"] for item in items_data]
        products = db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .options(selectinload(Product.inventory))
        ).all()
        products_by_id: dict[int, Product] = {product.id: product for product in products}

        for item in items_data:
            product_id = int(item.get("product_id") or 0)
            quantity = parse_positive_quantity(item.get("quantity"), field="quantity")
            if product_id <= 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "message": "Кожна позиція має містити коректні product_id та quantity"})

            product = products_by_id.get(product_id)
            if product is None:
                raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "product_id": product_id, "message": f"Товар #{product_id} не знайдено"})
            if not product.is_active:
                raise HTTPException(status_code=400, detail={"code": "PRODUCT_INACTIVE", "product_id": product_id, "message": f"Товар '{product.name}' недоступний для замовлення"})

            inventory = product.inventory
            available_quantity = inventory.quantity if inventory and inventory.quantity else 0
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "INSUFFICIENT_STOCK",
                        "product_id": product_id,
                        "product_name": product.name,
                        "requested": quantity,
                        "available": available_quantity,
                        "message": f"Недостатньо залишку для товару '{product.name}'",
                    },
                )

            effective_price_resolved = resolve_effective_product_price(db, product, current_user.customer_group_id, quantity)["effective_price"]
            if effective_price_resolved is None:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "PRICE_NOT_SET_FOR_ROLE",
                        "product_id": product_id,
                        "product_name": product.name,
                        "message": f"Ціну для вашої групи користувачів на товар '{product.name}' не встановлено для вказаної кількості ({quantity} шт).",
                    }
                )

            unit_price = float(effective_price_resolved)
            subtotal += unit_price * quantity

            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    product_sku=product.sku,
                    quantity=quantity,
                    unit_price=unit_price,
                )
            )

            quantity_before = int(inventory.quantity or 0)
            inventory.quantity = quantity_before - quantity
            quantity_after = int(inventory.quantity or 0)
            db.add(inventory)
            inventory_changes.append((product_id, quantity, quantity_before, quantity_after))

        delivery_cost = 0.0 if subtotal >= float(delivery_rule["free_from"]) else float(delivery_rule["base_cost"])
        order.delivery_cost = delivery_cost
        discount = 0.0

        promo = None
        if promo_code_text:
            promo = _find_promo_code_by_code(db, promo_code_text)
            if not promo:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "PROMO_INVALID",
                        "field": "promo_code",
                        "message": "Промокод не знайдено",
                    },
                )

            promo_is_valid, promo_message = promo.is_valid(subtotal)
            if not promo_is_valid:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "PROMO_INVALID",
                        "field": "promo_code",
                        "message": promo_message,
                    },
                )

            discount = round(float(promo.calculate_discount(subtotal)), 2)
            order.promo_code_id = promo.id

        if discount > subtotal + delivery_cost:
            discount = subtotal + delivery_cost
        if delivery_method == DeliveryMethod.pickup and PICKUP_LOCATION_ADDRESS not in order.delivery_address:
            order.delivery_address = PICKUP_LOCATION_ADDRESS
            order.delivery_city = PICKUP_LOCATION_CITY

        if delivery_method != DeliveryMethod.pickup and delivery_rule["address_label"]:
            delivery_note = f"Доставка: {delivery_rule['address_label']}"
            if delivery_note not in comment:
                order.comment = f"{delivery_note}\n{comment}".strip()

        order.discount = discount
        order.subtotal = subtotal
        order.total = max(subtotal + delivery_cost - discount, 0)

        if promo is not None:
            promo.used_count = int(promo.used_count or 0) + 1
            db.add(promo)

        for product_id, quantity, quantity_before, quantity_after in inventory_changes:
            db.add(InventoryMovement(
                product_id=product_id,
                order_id=order.id,
                type=MovementType.sale,
                quantity=-quantity,
                quantity_before=quantity_before,
                quantity_after=quantity_after,
                note=f"Автосписання: замовлення #{order.id}",
            ))

        if inventory_changes:
            affected_product_ids = [change[0] for change in inventory_changes]
            affected_inventory = list(db.scalars(
                select(Inventory)
                .where(Inventory.product_id.in_(affected_product_ids))
                .options(selectinload(cast(Any, Inventory.product)))
            ).all())
            create_low_stock_notifications(db, affected_inventory)

        cart = db.scalar(select(Cart).where(Cart.user_id == current_user.id))
        if cart:
            db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))

        db.flush()

        if order.user_id:
            status_ua = get_order_status_ua(
                order.status.value if hasattr(order.status, "value") else str(order.status)
            )
            db.add(Notification(
                user_id=order.user_id,
                type=NotificationType.order_status,
                title=f"Замовлення #{order.id} створено",
                message=f"Ваше замовлення #{order.id} успішно оформлено зі статусом '{status_ua}'.",
                target_path="/profile",
                target_order_id=order.id,
            ))
        sales_users = db.scalars(
            select(User).where(
                User.role.in_([UserRole.admin, UserRole.sales_processor, UserRole.manager]),
                User.is_active == True,
            )
        ).all()
        for sales_user in sales_users:
            db.add(Notification(
                user_id=sales_user.id,
                type=NotificationType.order_status,
                title=f"Нове замовлення #{order.id}",
                message=f"Надійшло нове замовлення на суму {order.total} грн.",
                target_path="/manager?tab=orders",
                target_order_id=order.id,
            ))
        db.commit()

        return {
            "id": order.id,
            "user_id": order.user_id,
            "status": order.status.value if hasattr(order.status, "value") else order.status,
            "subtotal": order.subtotal,
            "delivery_cost": order.delivery_cost,
            "discount": order.discount,
            "total": order.total,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "Order creation failed",
            extra={"error": str(e), "request_id": get_request_id(), "user_id": current_user.id},
        )
        raise HTTPException(status_code=500, detail="Internal server error")
