from datetime import datetime

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Wishlist(Base):
    __tablename__ = "wishlists"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="unique_user_product_wishlist"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=False
    )
    added_at: Mapped[datetime] = mapped_column(default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="wishlist")
    product: Mapped["Product"] = relationship("Product")

