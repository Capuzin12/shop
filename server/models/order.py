from datetime import datetime
from typing import Optional, List

from sqlalchemy import CheckConstraint, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base, _py_enum
from .enums import DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    address_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("addresses.id", ondelete="SET NULL")
    )
    contact_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    delivery_city: Mapped[Optional[str]] = mapped_column(String(100))
    delivery_address: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[OrderStatus] = mapped_column(
        _py_enum(OrderStatus), default=OrderStatus.new
    )
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    delivery_cost: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    delivery_method: Mapped[DeliveryMethod] = mapped_column(
        _py_enum(DeliveryMethod), default=DeliveryMethod.nova_poshta
    )
    tracking_number: Mapped[Optional[str]] = mapped_column(String(100))
    payment_method: Mapped[PaymentMethod] = mapped_column(
        _py_enum(PaymentMethod), default=PaymentMethod.card
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        _py_enum(PaymentStatus), default=PaymentStatus.pending
    )
    promo_code_id: Mapped[Optional[int]] = mapped_column(ForeignKey("promo_codes.id"))
    comment: Mapped[Optional[str]] = mapped_column(Text)
    admin_note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    user: Mapped[Optional["User"]] = relationship(back_populates="orders")
    address: Mapped[Optional["Address"]] = relationship(back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    promo_code: Mapped[Optional["PromoCode"]] = relationship()
    movements: Mapped[List["InventoryMovement"]] = relationship(
        primaryjoin="Order.id == InventoryMovement.order_id",
        foreign_keys="InventoryMovement.order_id",
    )
    messages: Mapped[List["OrderMessage"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderMessage.created_at",
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        UniqueConstraint("order_id", "product_id", name="unique_order_product"),
        CheckConstraint("quantity >= 1", name="ck_order_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_order_items_unit_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL")
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_sku: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped[Optional["Product"]] = relationship()

    @property
    def total_price(self) -> float:
        return self.quantity * self.unit_price


class OrderMessage(Base):
    __tablename__ = "order_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_from_staff: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    order: Mapped["Order"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship(back_populates="order_messages")

