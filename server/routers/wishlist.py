from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models import Inventory, Product, Wishlist
from routers.deps import get_current_active_user, get_db
from services.helpers import _to_iso_or_none
from services.serializers import serialize_product_summary
from services.pricing import get_presentational_old_price, resolve_effective_product_price
from models import User

router = APIRouter(tags=["wishlist"])


@router.get("/api/wishlist")
def get_wishlist(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    items = db.scalars(
        select(Wishlist).where(Wishlist.user_id == current_user.id).options(selectinload(Wishlist.product).selectinload(Product.images)).order_by(Wishlist.added_at.desc())
    ).all()
    result = []
    for item in items:
        stock = db.scalar(select(Inventory).where(Inventory.product_id == item.product_id))
        stock_quantity = stock.quantity if stock else 0
        pricing = resolve_effective_product_price(db, item.product, current_user.customer_group_id, 1) if item.product else {"effective_price": 0, "base_price": 0}
        product_payload = serialize_product_summary(item.product) if item.product else {
            "id": item.product_id,
            "name": "Товар",
            "slug": "",
            "sku": "",
            "description": "",
            "price": 0,
            "old_price": None,
            "unit": "шт",
            "icon": None,
            "badge": None,
            "is_active": True,
            "is_featured": False,
            "category_id": None,
            "brand_id": None,
            "category_name": None,
            "brand_name": None,
            "image_url": None,
        }
        product_payload.update({
            "price": pricing.get("effective_price", 0),
            "old_price": get_presentational_old_price(pricing),
            "quantity": stock_quantity,
            "in_stock": stock_quantity > 0,
        })
        result.append({
            "id": item.id,
            "product_id": item.product_id,
            "added_at": _to_iso_or_none(item.added_at),
            "product": product_payload,
        })
    return result


@router.post("/api/wishlist", status_code=status.HTTP_201_CREATED)
def create_wishlist_item(
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    try:
        product_id = int((payload or {}).get("product_id", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_ID", "message": "product_id має бути цілим числом"})
    if product_id <= 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRODUCT_ID", "message": "Вкажіть коректний product_id"})
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    existing = db.scalar(select(Wishlist).where(Wishlist.user_id == current_user.id, Wishlist.product_id == product_id))
    if existing:
        return {"id": existing.id, "product_id": existing.product_id, "added_at": _to_iso_or_none(existing.added_at)}
    item = Wishlist(user_id=current_user.id, product_id=product_id)
    db.add(item)
    db.commit()
    return {"id": item.id, "product_id": item.product_id, "added_at": _to_iso_or_none(item.added_at)}


@router.delete("/api/wishlist/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist_item(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    item = db.scalar(select(Wishlist).where(Wishlist.user_id == current_user.id, Wishlist.product_id == product_id))
    if not item:
        raise HTTPException(status_code=404, detail={"code": "WISHLIST_ITEM_NOT_FOUND", "message": "Елемент wishlist не знайдено"})
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

