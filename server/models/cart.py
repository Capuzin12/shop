from datetime import datetime
from typing import List

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="carts")
    items: Mapped[List["CartItem"]] = relationship(
        "CartItem", back_populates="cart", cascade="all, delete-orphan"
    )


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_cart_items_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cart_id: Mapped[int] = mapped_column(Integer, ForeignKey("carts.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    added_at: Mapped[datetime] = mapped_column(default=func.now())

    cart: Mapped["Cart"] = relationship("Cart", back_populates="items")
    product: Mapped["Product"] = relationship("Product")

