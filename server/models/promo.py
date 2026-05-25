from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base, _py_enum
from .enums import DiscountType


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    discount_type: Mapped[DiscountType] = mapped_column(
        _py_enum(DiscountType), nullable=False
    )
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)
    min_order_amount: Mapped[float] = mapped_column(Float, default=0)
    max_uses: Mapped[Optional[int]] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[Optional[datetime]] = mapped_column()
    valid_until: Mapped[Optional[datetime]] = mapped_column()
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    def is_valid(self, order_amount: float) -> tuple[bool, str]:
        from datetime import datetime as dt

        if not self.is_active:
            return False, "Промокод неактивний"
        if self.max_uses and self.used_count >= self.max_uses:
            return False, "Ліміт використань вичерпано"
        if self.valid_from and dt.now() < self.valid_from:
            return False, "Промокод ще не активний"
        if self.valid_until and dt.now() > self.valid_until:
            return False, "Термін дії промокоду закінчився"
        if order_amount < self.min_order_amount:
            return False, f"Мінімальна сума замовлення: {self.min_order_amount} грн"
        return True, "OK"

    def calculate_discount(self, order_amount: float) -> float:
        if self.discount_type == DiscountType.percentage:
            return round(order_amount * self.discount_value / 100, 2)
        return min(self.discount_value, order_amount)

