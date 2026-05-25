from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base, _py_enum
from .enums import MovementType, SupplyStatus


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_inventory_quantity_non_negative"),
        CheckConstraint("min_quantity >= 0", name="ck_inventory_min_quantity_non_negative"),
        CheckConstraint("max_quantity >= 0", name="ck_inventory_max_quantity_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), unique=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    min_quantity: Mapped[int] = mapped_column(Integer, default=0)
    max_quantity: Mapped[int] = mapped_column(Integer, default=9999)
    min_quantity_alert: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    location: Mapped[Optional[str]] = mapped_column(String(50))
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    product: Mapped["Product"] = relationship(back_populates="inventory")

    @property
    def status(self) -> str:
        if self.quantity == 0:
            return "out_of_stock"
        if self.quantity < self.min_quantity:
            return "low_stock"
        return "in_stock"

    @property
    def needs_reorder(self) -> bool:
        return self.quantity <= self.min_quantity


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    supply_orders: Mapped[List["SupplyOrder"]] = relationship(back_populates="supplier")


class SupplyOrder(Base):
    __tablename__ = "supply_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[SupplyStatus] = mapped_column(
        _py_enum(SupplyStatus), default=SupplyStatus.draft
    )
    total_amount: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    ordered_at: Mapped[Optional[datetime]] = mapped_column()
    expected_at: Mapped[Optional[datetime]] = mapped_column()
    received_at: Mapped[Optional[datetime]] = mapped_column()
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    supplier: Mapped["Supplier"] = relationship(back_populates="supply_orders")
    items: Mapped[List["SupplyOrderItem"]] = relationship(
        back_populates="supply_order", cascade="all, delete-orphan"
    )


class SupplyOrderItem(Base):
    __tablename__ = "supply_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    supply_order_id: Mapped[int] = mapped_column(
        ForeignKey("supply_orders.id", ondelete="CASCADE")
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)

    supply_order: Mapped["SupplyOrder"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()

    @property
    def total_price(self) -> float:
        return self.quantity * self.unit_price


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    supply_order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("supply_orders.id"))
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"))
    type: Mapped[MovementType] = mapped_column(_py_enum(MovementType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_before: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    product: Mapped["Product"] = relationship()

