from datetime import datetime, timezone
from typing import Any, cast

from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from models import CustomerGroup, Product, ProductDiscount, ProductPrice


def get_active_product_discount(db: Session, product_id: int) -> ProductDiscount | None:
    now = datetime.now(timezone.utc)
    return db.scalar(
        select(ProductDiscount)
        .where(
            ProductDiscount.product_id == product_id,
            ProductDiscount.is_active == True,
            or_(ProductDiscount.start_date.is_(None), ProductDiscount.start_date <= now),
            or_(ProductDiscount.end_date.is_(None), ProductDiscount.end_date >= now),
        )
        .order_by(ProductDiscount.id.desc())
    )


def apply_product_discount(base_price: float, discount: ProductDiscount | None) -> float:
    if not discount:
        return float(base_price)
    price = float(base_price)
    value = float(discount.discount_value or 0)
    if str(discount.discount_type) == "PERCENTAGE":
        return round(max(price * (1 - value / 100.0), 0.0), 2)
    if str(discount.discount_type) == "FIXED_PRICE":
        return round(max(value, 0.0), 2)
    return round(price, 2)


from sqlalchemy import or_, func

def resolve_effective_product_price(
    db: Session,
    product: Product,
    customer_group_id: int | None,
    quantity: int = 1,
) -> dict:
    base_price = float(product.price)
    applied_tier = None
    group_name = None
    group_price = None
    qty = max(int(quantity or 1), 1)
    if not customer_group_id:
        default_group = db.scalar(
            select(CustomerGroup).where(
                or_(
                    CustomerGroup.is_default == True,
                    func.lower(CustomerGroup.name) == "роздріб"
                )
            )
        )
        if default_group:
            customer_group_id = default_group.id

    if customer_group_id:
        tier = db.scalar(
            select(ProductPrice)
            .where(
                cast(Any, ProductPrice.product_id) == product.id,
                cast(Any, ProductPrice.customer_group_id) == customer_group_id,
                cast(Any, ProductPrice.min_quantity) <= qty,
            )
            .order_by(ProductPrice.min_quantity.desc())
        )
        group = db.get(CustomerGroup, customer_group_id)
        group_name = group.name if group else None

        if tier:
            group_price = float(tier.price)
            applied_tier = {
                "id": tier.id,
                "min_quantity": tier.min_quantity,
                "price": float(tier.price),
                "customer_group_id": tier.customer_group_id,
            }
        elif group and (group.is_default or func.lower(group.name) == "роздріб"):
            group_price = base_price
        else:
            group_price = None

        pre_discount_price = group_price
    else:
        pre_discount_price = base_price

    active_discount = get_active_product_discount(db, product.id)

    if pre_discount_price is not None:
        effective_price = apply_product_discount(pre_discount_price, active_discount)
    else:
        effective_price = None

    return {
        "base_price": base_price,
        "group_price": group_price,
        "group_name": group_name,
        "applied_tier": applied_tier,
        "active_discount": {
            "id": active_discount.id,
            "discount_type": active_discount.discount_type,
            "discount_value": active_discount.discount_value,
            "start_date": active_discount.start_date.isoformat() if active_discount.start_date else None,
            "end_date": active_discount.end_date.isoformat() if active_discount.end_date else None,
            "is_active": active_discount.is_active,
        } if active_discount else None,
        "effective_price": effective_price,
    }


def get_presentational_old_price(pricing: dict) -> float | None:
    base_for_display = pricing.get("group_price")
    if base_for_display is None:
        base_for_display = pricing.get("base_price")
    effective_price = pricing.get("effective_price")
    if pricing.get("active_discount") and base_for_display is not None and effective_price is not None:
        base_value = float(cast(Any, base_for_display))
        effective_value = float(cast(Any, effective_price))
        if effective_value < base_value:
            return base_value
    return None

