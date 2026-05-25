from datetime import datetime

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from logging_config import get_logger
from models import (
    Brand,
    CartItem,
    Category,
    CustomerGroup,
    Inventory,
    Notification,
    Order,
    OrderMessage,
    Product,
    ProductImage,
    PromoCode,
    Review,
    Supplier,
    User,
    UserRole,
)
from services.helpers import _to_iso_or_none
from services.pricing import get_presentational_old_price, resolve_effective_product_price

logger = get_logger(__name__)


def serialize_model(obj, seen=None):
    if seen is None:
        seen = set()
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if hasattr(obj, "value") and hasattr(obj, "name"):
        return obj.value
    if isinstance(obj, (datetime,)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [serialize_model(item, seen) for item in obj]
    if isinstance(obj, dict):
        return {key: serialize_model(value, seen) for key, value in obj.items()}
    if id(obj) in seen:
        return None
    seen.add(id(obj))
    if hasattr(obj, "__table__"):
        data = {}
        mapper = inspect(obj)
        for attr in mapper.attrs:
            key = attr.key
            if key.startswith("_") or key == "password_hash":
                continue
            try:
                value = getattr(obj, key)
            except Exception as e:
                logger.debug(f"Could not serialize attribute {key}: {e}")
                continue
            data[key] = serialize_model(value, seen)
        return data
    return str(obj)


def serialize_order_summary(order: Order):
    return {
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
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "product_sku": item.product_sku,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
            }
            for item in (order.items or [])
        ],
    }


def serialize_user_summary(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "customer_group_id": user.customer_group_id,
        "customer_group_name": user.customer_group.name if getattr(user, "customer_group", None) else None,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def serialize_customer_group(group: CustomerGroup):
    users_count = len(group.users or []) if hasattr(group, "users") else 0
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "is_default": bool(group.is_default),
        "users_count": users_count,
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


def serialize_cart_product(db: Session, product: Product, customer_group_id: int | None, cart_quantity: int, stock_quantity: int) -> dict:
    pricing = resolve_effective_product_price(db, product, customer_group_id, cart_quantity)
    return {
        "id": product.id,
        "name": product.name,
        "price": pricing["effective_price"],
        "old_price": get_presentational_old_price(pricing),
        "sku": product.sku,
        "slug": product.slug,
        "description": product.description,
        "quantity": stock_quantity,
        "in_stock": stock_quantity > 0,
    }


def serialize_category(category: Category):
    return {
        "id": category.id,
        "parent_id": category.parent_id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "icon": category.icon,
        "image_url": category.image_url,
        "sort_order": category.sort_order,
        "is_active": category.is_active,
        "created_at": category.created_at.isoformat() if category.created_at else None,
    }


def serialize_brand(brand: Brand):
    return {
        "id": brand.id,
        "name": brand.name,
        "slug": brand.slug,
        "description": brand.description,
        "country": brand.country,
        "logo_url": brand.logo_url,
        "website_url": brand.website_url,
        "is_active": brand.is_active,
        "created_at": brand.created_at.isoformat() if brand.created_at else None,
    }


def serialize_supplier(supplier: Supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "contact_name": supplier.contact_name,
        "phone": supplier.phone,
        "email": supplier.email,
        "address": supplier.address,
        "payment_terms": supplier.payment_terms,
        "notes": supplier.notes,
        "is_active": supplier.is_active,
        "created_at": supplier.created_at.isoformat() if supplier.created_at else None,
    }


def serialize_promo_code(promo: PromoCode):
    return {
        "id": promo.id,
        "code": promo.code,
        "description": promo.description,
        "discount_type": promo.discount_type.value if hasattr(promo.discount_type, "value") else str(promo.discount_type),
        "discount_value": promo.discount_value,
        "min_order_amount": promo.min_order_amount,
        "max_uses": promo.max_uses,
        "used_count": promo.used_count,
        "valid_from": promo.valid_from.isoformat() if promo.valid_from else None,
        "valid_until": promo.valid_until.isoformat() if promo.valid_until else None,
        "is_active": promo.is_active,
        "created_at": promo.created_at.isoformat() if promo.created_at else None,
    }


def serialize_product_summary(product: Product):
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "sku": product.sku,
        "description": product.description,
        "price": product.price,
        "old_price": None,
        "unit": product.unit,
        "icon": product.icon,
        "badge": product.badge.value if product.badge and hasattr(product.badge, "value") else str(product.badge) if product.badge else None,
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "category_id": product.category_id,
        "brand_id": product.brand_id,
        "category_name": product.category.name if getattr(product, "category", None) else None,
        "brand_name": product.brand.name if getattr(product, "brand", None) else None,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
    }


def serialize_product_image(image: ProductImage):
    return {
        "id": image.id,
        "url": image.url,
        "alt_text": image.alt_text,
        "is_main": image.is_main,
        "sort_order": image.sort_order,
    }


def serialize_product_detail(product: Product):
    result = serialize_product_summary(product)
    result.update({
        "weight_kg": product.weight_kg,
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
        "images": [
            serialize_product_image(image)
            for image in sorted((product.images or []), key=lambda i: ((i.sort_order or 0), (i.id or 0)))
        ],
        "attributes": [
            {
                "id": attr.id,
                "key": attr.key,
                "value": attr.value,
                "unit": attr.unit,
                "sort_order": attr.sort_order,
            }
            for attr in sorted((product.attributes or []), key=lambda a: ((a.sort_order or 0), (a.id or 0)))
        ],
    })
    return result


def serialize_inventory_summary(item: Inventory):
    product = item.product
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": product.name if product else "Unknown",
        "product_sku": product.sku if product else None,
        "quantity": item.quantity,
        "min_quantity": item.min_quantity,
        "max_quantity": item.max_quantity,
        "location": item.location,
        "min_quantity_alert": item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_review(review: Review):
    return {
        "id": review.id,
        "product_id": review.product_id,
        "user_id": review.user_id,
        "rating": review.rating,
        "comment": review.comment,
        "is_approved": review.is_approved,
        "admin_reply": review.admin_reply,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "author": {
            "id": review.user.id,
            "first_name": review.user.first_name,
            "last_name": review.user.last_name,
            "role": review.user.role.value if hasattr(review.user.role, "value") else str(review.user.role),
        } if review.user else None,
    }


def serialize_order_message(message: OrderMessage):
    sender_role = message.sender.role.value if message.sender and hasattr(message.sender.role, "value") else None
    return {
        "id": message.id,
        "order_id": message.order_id,
        "sender_id": message.sender_id,
        "is_from_staff": message.is_from_staff,
        "body": message.body,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "sender": {
            "id": message.sender.id,
            "first_name": message.sender.first_name,
            "last_name": message.sender.last_name,
            "role": sender_role,
        } if message.sender else None,
    }


def _serialize_cart_item(db: Session, item: CartItem, customer_group_id: int | None) -> dict:
    stock = db.scalar(select(Inventory).where(Inventory.product_id == item.product_id))
    stock_quantity = stock.quantity if stock else 0
    product_payload = None
    if item.product:
        product_payload = serialize_cart_product(db, item.product, customer_group_id, item.quantity, stock_quantity)
    return {
        "id": item.id,
        "cart_id": item.cart_id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "added_at": _to_iso_or_none(item.added_at),
        "product": product_payload,
    }


def _serialize_notification(notification: Notification, current_user: User) -> dict:
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "type": notification.type.value if hasattr(notification.type, "value") else str(notification.type),
        "title": notification.title,
        "message": notification.message,
        "target_path": notification.target_path
        or (
            "/manager?tab=orders"
            if notification.target_order_id and current_user.role in (UserRole.admin, UserRole.sales_processor, UserRole.manager)
            else "/profile"
            if notification.target_order_id
            else "/notifications"
        ),
        "target_product_id": notification.target_product_id,
        "target_inventory_id": notification.target_inventory_id,
        "target_order_id": notification.target_order_id,
        "is_read": bool(notification.is_read),
        "created_at": _to_iso_or_none(notification.created_at),
    }

