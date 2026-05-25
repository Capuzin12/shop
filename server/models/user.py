from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base, _py_enum
from .enums import UserRole


class CustomerGroup(Base):
    __tablename__ = "customer_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    users: Mapped[List["User"]] = relationship(back_populates="customer_group")
    product_prices: Mapped[List["ProductPrice"]] = relationship(
        back_populates="customer_group",
        cascade="all, delete-orphan",
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    customer_group_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customer_groups.id", ondelete="SET NULL")
    )
    role: Mapped[UserRole] = mapped_column(_py_enum(UserRole), default=UserRole.customer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    addresses: Mapped[List["Address"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    orders: Mapped[List["Order"]] = relationship(back_populates="user")
    reviews: Mapped[List["Review"]] = relationship(back_populates="user")
    wishlist: Mapped[List["Wishlist"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    carts: Mapped[List["Cart"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[List["Notification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    order_messages: Mapped[List["OrderMessage"]] = relationship(back_populates="sender")
    customer_group: Mapped[Optional["CustomerGroup"]] = relationship(
        back_populates="users"
    )

    def __repr__(self):
        return f"<User {self.email}>"


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    label: Mapped[Optional[str]] = mapped_column(String(50))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    street: Mapped[str] = mapped_column(String(200), nullable=False)
    building: Mapped[str] = mapped_column(String(20), nullable=False)
    apartment: Mapped[Optional[str]] = mapped_column(String(20))
    postal_code: Mapped[Optional[str]] = mapped_column(String(10))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    user: Mapped["User"] = relationship(back_populates="addresses")
    orders: Mapped[List["Order"]] = relationship(back_populates="address")

