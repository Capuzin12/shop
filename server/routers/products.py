from datetime import datetime, timezone
from typing import Annotated
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session, selectinload

from models import (
    Inventory,
    Product,
    ProductAttribute,
    ProductImage,
    Review,
    User,
)
from routers.deps import can_manage_catalog, get_current_admin_user, get_current_active_user, get_db, get_optional_user
from services.helpers import generate_slug_from_name
import services.orders as order_services
from services.pricing import get_presentational_old_price, resolve_effective_product_price
from services.search import search_products_response
from services.serializers import serialize_product_detail, serialize_review

router = APIRouter(tags=["products"])


def _normalize_product_attributes_payload(payload: dict) -> list[dict] | None:
    if not isinstance(payload, dict):
        return None

    if "attributes" in payload:
        attributes_payload = payload.get("attributes")
        if attributes_payload is None:
            return None
        if not isinstance(attributes_payload, list):
            raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_ATTRIBUTES", "message": "attributes має бути масивом"})
        parsed_attributes: list[dict] = []
        for index, raw in enumerate(attributes_payload):
            if not isinstance(raw, dict):
                continue
            key = str(raw.get("key") or "").strip()
            value = str(raw.get("value") or "").strip()
            if not key or not value:
                continue
            unit = str(raw.get("unit") or "").strip() or None
            try:
                sort_order = int(raw.get("sort_order", index))
            except (TypeError, ValueError):
                sort_order = index
            parsed_attributes.append({"key": key, "value": value, "unit": unit, "sort_order": sort_order})
        return parsed_attributes

    attributes_text = payload.get("attributes_text")
    if attributes_text in (None, ""):
        return None

    parsed_attributes = []
    for index, line in enumerate(str(attributes_text).splitlines()):
        parts = [part.strip() for part in line.split("|")]
        if len(parts) < 2:
            continue
        key, value = parts[0], parts[1]
        if not key or not value:
            continue
        unit = parts[2] if len(parts) > 2 and parts[2] else None
        try:
            sort_order = int(parts[3]) if len(parts) > 3 and parts[3] else index
        except ValueError:
            sort_order = index
        parsed_attributes.append({"key": key, "value": value, "unit": unit, "sort_order": sort_order})
    return parsed_attributes


def _normalize_product_payload(payload: dict, *, require_basic: bool) -> tuple[dict, list[dict] | None, list[dict] | None]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_PAYLOAD", "message": "Некоректний формат товару"})

    normalized: dict = {}
    editable = {
        "category_id", "brand_id", "name", "slug", "sku", "description", "price", "unit",
        "weight_kg", "icon", "badge", "is_active", "is_featured", "meta_title", "meta_description",
    }
    for key in editable:
        if key not in payload:
            continue
        value = payload.get(key)
        if key == "category_id":
            try:
                parsed = int(cast(int, value))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле має бути числом"})
            if parsed <= 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле має бути більше за 0"})
            normalized[key] = parsed
        elif key == "brand_id":
            if value in (None, ""):
                normalized[key] = None
            else:
                try:
                    parsed = int(cast(int, value))
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле має бути числом"})
                if parsed <= 0:
                    raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле має бути більше за 0"})
                normalized[key] = parsed
        elif key in {"price", "weight_kg"}:
            if value in (None, ""):
                if key == "weight_kg":
                    normalized[key] = None
                continue
            try:
                parsed = float(cast(float, value))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле має бути числом"})
            if key == "price" and parsed <= 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Ціна має бути більшою за 0"})
            if key == "weight_kg" and parsed < 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле не може бути від'ємним"})
            normalized[key] = parsed
        elif key in {"is_active", "is_featured"}:
            normalized[key] = bool(value)
        elif key == "badge":
            if value in (None, ""):
                normalized[key] = None
            else:
                normalized[key] = str(value)
        else:
            cleaned = str(value or "").strip()
            if key in {"name", "slug", "sku"} and cleaned == "":
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": key, "message": "Поле не може бути порожнім"})
            normalized[key] = cleaned if cleaned else None

    if require_basic:
        for field in ("name", "slug", "sku", "category_id", "price"):
            if normalized.get(field) in (None, ""):
                raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_FIELD", "field": field, "message": "Поле обов'язкове"})

    images_payload = payload.get("images") if "images" in payload else None
    images: list[dict] | None = None
    if images_payload is not None:
        if not isinstance(images_payload, list):
            raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_IMAGES", "message": "images має бути масивом"})
        images = []
        for index, raw in enumerate(images_payload):
            if not isinstance(raw, dict):
                continue
            url = str(raw.get("url") or "").strip()
            if not url:
                continue
            alt_text = str(raw.get("alt_text") or "").strip() or None
            try:
                sort_order = int(raw.get("sort_order", index))
            except (TypeError, ValueError):
                sort_order = index
            images.append({
                "url": url,
                "alt_text": alt_text,
                "is_main": bool(raw.get("is_main", False)),
                "sort_order": sort_order,
            })
        if images and not any(img["is_main"] for img in images):
            images[0]["is_main"] = True

    attributes = _normalize_product_attributes_payload(payload)
    return normalized, images, attributes


@router.get("/api/products")
def get_products(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
    active_only: bool = True,
    category_id: int | None = None,
    search: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    brand_ids: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    page: int = 1,
    limit: int = 12,
):
    return search_products_response(
        db,
        current_user,
        active_only=active_only,
        category_id=category_id,
        search=search,
        min_price=min_price,
        max_price=max_price,
        brand_ids=brand_ids,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit,
    )


@router.get("/api/products/{product_id}")
def get_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.images),
            selectinload(Product.attributes),
            selectinload(Product.category),
            selectinload(Product.brand),
        )
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    inventory = db.scalar(select(Inventory).where(Inventory.product_id == product.id))
    stock_quantity = inventory.quantity if inventory and inventory.quantity is not None else 0
    payload = serialize_product_detail(product)
    pricing = resolve_effective_product_price(db, product, getattr(current_user, "customer_group_id", None), 1)
    payload.update({
        "quantity": stock_quantity,
        "in_stock": stock_quantity > 0,
        "old_price": get_presentational_old_price(pricing),
        "active_discount": pricing["active_discount"],
        "effective_price": pricing["effective_price"],
        "customer_group_name": pricing["group_name"],
    })
    return payload


@router.get("/api/products/{product_id}/reviews")
def get_product_reviews(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = db.scalars(
        select(Review)
        .where(Review.product_id == product_id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
    ).all()

    visible_reviews = []
    for review in reviews:
        if review.is_approved:
            visible_reviews.append(review)
            continue
        if current_user and (review.user_id == current_user.id or can_manage_catalog(current_user.role)):
            visible_reviews.append(review)

    avg_rating = round(sum(r.rating for r in visible_reviews) / len(visible_reviews), 1) if visible_reviews else None
    can_review = False
    review_requirement = "Щоб залишити відгук, замовлення з цим товаром має бути доставлено або забрано."
    if current_user:
        can_review = order_services.can_user_review_product(db, current_user.id, product_id)
    return {
        "reviews": [serialize_review(review) for review in visible_reviews],
        "total": len(visible_reviews),
        "avg_rating": avg_rating,
        "can_review": can_review,
        "review_requirement": review_requirement,
    }


@router.post("/api/products/{product_id}/reviews")
def create_or_update_review(
    product_id: int,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")

    if not order_services.can_user_review_product(db, current_user.id, product_id):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "REVIEW_NOT_ALLOWED",
                "message": "Відгук можна залишити лише після статусу 'Доставлено' або 'Забрано' для цього товару.",
            },
        )

    raw_rating = payload.get("rating")
    try:
        rating = int(cast(int, raw_rating))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_REVIEW_RATING", "message": "Оцінка має бути числом від 1 до 5"})

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail={"code": "INVALID_REVIEW_RATING", "message": "Оцінка має бути від 1 до 5"})

    comment = str(payload.get("comment") or "").strip()
    if len(comment) < 5:
        raise HTTPException(status_code=400, detail={"code": "INVALID_REVIEW_COMMENT", "message": "Відгук має містити щонайменше 5 символів"})
    comment = comment[:1500]

    existing_review = db.scalar(
        select(Review).where(Review.product_id == product_id, Review.user_id == current_user.id)
    )

    if existing_review:
        existing_review.rating = rating
        existing_review.comment = comment
        existing_review.is_approved = True
        existing_review.created_at = datetime.now(timezone.utc)
        db.add(existing_review)
        review = existing_review
    else:
        review = Review(
            product_id=product_id,
            user_id=current_user.id,
            rating=rating,
            comment=comment,
            is_approved=True,
        )
        db.add(review)

    db.commit()
    db.refresh(review)
    review = db.scalar(select(Review).where(Review.id == review.id).options(selectinload(Review.user)))
    return serialize_review(cast(Review, review))


@router.post("/api/products")
def create_product(
    product: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    normalized_product, images_data, attributes_data = _normalize_product_payload(product, require_basic=True)

    if not normalized_product.get("slug"):
        normalized_product["slug"] = generate_slug_from_name(normalized_product.get("name", ""))

    existing_product = db.scalar(select(Product).where(Product.slug == normalized_product["slug"]))
    if existing_product:
        raise HTTPException(
            status_code=409,
            detail={"code": "SLUG_EXISTS", "message": f"Товар з таким slug вже існує: {normalized_product['slug']}"},
        )

    new_product = Product(**normalized_product)
    db.add(new_product)
    db.flush()
    if images_data is not None:
        for image in images_data:
            db.add(ProductImage(product_id=new_product.id, **image))
    if attributes_data is not None:
        for attribute in attributes_data:
            db.add(ProductAttribute(product_id=new_product.id, **attribute))
    db.commit()
    created = db.scalar(
        select(Product)
        .where(Product.id == new_product.id)
        .options(
            selectinload(Product.images),
            selectinload(Product.attributes),
            selectinload(Product.category),
            selectinload(Product.brand),
        )
    )
    return serialize_product_detail(cast(Product, created))


@router.put("/api/products/{product_id}")
def update_product(
    product_id: int,
    product: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    db_product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.images))
    )
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    normalized_product, images_data, attributes_data = _normalize_product_payload(product, require_basic=False)

    if "name" in normalized_product and not normalized_product.get("slug"):
        normalized_product["slug"] = generate_slug_from_name(normalized_product["name"])

    if "slug" in normalized_product and normalized_product["slug"] != db_product.slug:
        existing = db.scalar(select(Product).where(
            Product.slug == normalized_product["slug"],
            Product.id != product_id,
        ))
        if existing:
            raise HTTPException(
                status_code=409,
                detail={"code": "SLUG_EXISTS", "message": f"Товар з таким slug вже існує: {normalized_product['slug']}"},
            )

    old_price_value = float(db_product.price)
    new_price_value = float(normalized_product.get("price", old_price_value))
    if new_price_value != old_price_value:
        db.execute(text("SET LOCAL app.current_user_id = :uid"), {"uid": current_user.id})
    for key, value in normalized_product.items():
        setattr(db_product, key, value)

    if images_data is not None:
        db.execute(delete(ProductImage).where(ProductImage.product_id == db_product.id))
        for image in images_data:
            db.add(ProductImage(product_id=db_product.id, **image))

    if attributes_data is not None:
        db.execute(delete(ProductAttribute).where(ProductAttribute.product_id == db_product.id))
        for attribute in attributes_data:
            db.add(ProductAttribute(product_id=db_product.id, **attribute))

    db.commit()
    updated = db.scalar(
        select(Product)
        .where(Product.id == db_product.id)
        .options(
            selectinload(Product.images),
            selectinload(Product.attributes),
            selectinload(Product.category),
            selectinload(Product.brand),
        )
    )
    return serialize_product_detail(cast(Product, updated))


@router.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
):
    db_product = db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted"}


@router.get("/api/products/{product_id}/effective-price")
def get_effective_price_for_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    quantity: int = 1,
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    product_obj = cast(object, product)
    pricing = resolve_effective_product_price(db, cast(Product, product_obj), getattr(current_user, "customer_group_id", None), quantity)
    return {
        "effective_price": pricing["effective_price"],
        "base_price": pricing["base_price"],
        "group_name": pricing["group_name"],
        "applied_tier": pricing["applied_tier"],
        "active_discount": pricing["active_discount"],
    }

