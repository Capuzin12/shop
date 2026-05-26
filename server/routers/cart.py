from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models import Cart, CartItem, Product, User
from routers.deps import get_current_active_user, get_db
from services.helpers import _to_iso_or_none, parse_positive_quantity
from services.serializers import _serialize_cart_item

MAX_CART_ITEM_QUANTITY = 999
router = APIRouter(tags=["cart"])


def _get_or_create_cart_for_user(db: Session, user_id: int) -> Cart:
    cart = cast(Cart | None, db.scalar(
        select(Cart).where(Cart.user_id == user_id).options(selectinload(Cart.items).selectinload(CartItem.product).selectinload(Product.images))  # type: ignore[arg-type]
    ))
    if cart:
        return cart
    cart = Cart(user_id=user_id)
    db.add(cart)
    db.commit()
    refreshed_cart = cast(Cart | None, db.scalar(
        select(Cart).where(Cart.id == cart.id).options(selectinload(Cart.items).selectinload(CartItem.product).selectinload(Product.images))  # type: ignore[arg-type]
    ))
    assert refreshed_cart is not None
    return refreshed_cart


@router.get("/api/cart")
def get_cart(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    cart = _get_or_create_cart_for_user(db, current_user.id)
    return {
        "id": cart.id,
        "user_id": cart.user_id,
        "created_at": _to_iso_or_none(cart.created_at),
        "updated_at": _to_iso_or_none(cart.updated_at),
        "items": [_serialize_cart_item(db, item, current_user.customer_group_id) for item in cart.items],
    }


@router.post("/api/cart/items", status_code=status.HTTP_201_CREATED)
def create_cart_item(
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
    quantity = parse_positive_quantity((payload or {}).get("quantity"), field="quantity")
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    cart = _get_or_create_cart_for_user(db, current_user.id)
    existing_cart_item = db.scalar(select(CartItem).where(CartItem.cart_id == cart.id, CartItem.product_id == product_id))
    if existing_cart_item:
        existing_cart_item.quantity = min(existing_cart_item.quantity + quantity, MAX_CART_ITEM_QUANTITY)
        resolved_cart_item = existing_cart_item
    else:
        resolved_cart_item = CartItem(cart_id=cart.id, product_id=product_id, quantity=quantity)
        db.add(resolved_cart_item)
    db.commit()
    return _serialize_cart_item(db, resolved_cart_item, current_user.customer_group_id)


@router.put("/api/cart/items/{item_id}")
def update_cart_item(
    item_id: int,
    payload: dict,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    quantity = parse_positive_quantity((payload or {}).get("quantity"), field="quantity")
    cart_item = db.scalar(
        select(CartItem)
        .join(Cart, Cart.id == CartItem.cart_id)
        .where(CartItem.id == item_id, Cart.user_id == current_user.id)
        .options(selectinload(CartItem.product).selectinload(Product.images))  # type: ignore[arg-type]
    )
    if not cart_item:
        raise HTTPException(status_code=404, detail={"code": "CART_ITEM_NOT_FOUND", "message": "Позицію кошика не знайдено"})
    cart_item.quantity = quantity
    db.commit()
    return _serialize_cart_item(db, cart_item, current_user.customer_group_id)


@router.delete("/api/cart/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    cart_item = db.scalar(select(CartItem).join(Cart, Cart.id == CartItem.cart_id).where(CartItem.id == item_id, Cart.user_id == current_user.id))
    if not cart_item:
        raise HTTPException(status_code=404, detail={"code": "CART_ITEM_NOT_FOUND", "message": "Позицію кошика не знайдено"})
    db.delete(cart_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

