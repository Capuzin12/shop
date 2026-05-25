from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base, _py_enum
import enum


class NotificationType(str, enum.Enum):
    low_stock = "low_stock"
    order_status = "order_status"
    supply_arrival = "supply_arrival"
    system = "system"
    promo = "promo"
    new_review = "new_review"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        _py_enum(NotificationType), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    target_path: Mapped[Optional[str]] = mapped_column(String(255))
    target_product_id: Mapped[Optional[int]] = mapped_column(Integer)
    target_inventory_id: Mapped[Optional[int]] = mapped_column(Integer)
    target_order_id: Mapped[Optional[int]] = mapped_column(Integer)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="notifications")

