from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base
from .user import CustomerGroup


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    icon: Mapped[Optional[str]] = mapped_column(String(100))
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    parent: Mapped[Optional["Category"]] = relationship(
        back_populates="children", remote_side="Category.id"
    )
    children: Mapped[List["Category"]] = relationship(back_populates="parent")
    products: Mapped[List["Product"]] = relationship(back_populates="category")

    def __repr__(self):
        return f"<Category {self.name}>"


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    country: Mapped[Optional[str]] = mapped_column(String(100))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    website_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    products: Mapped[List["Product"]] = relationship(back_populates="brand")


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    brand_id: Mapped[Optional[int]] = mapped_column(ForeignKey("brands.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="шт")
    weight_kg: Mapped[Optional[float]] = mapped_column(Float)
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    badge: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    meta_title: Mapped[Optional[str]] = mapped_column(String(255))
    meta_description: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    category: Mapped["Category"] = relationship(back_populates="products")
    brand: Mapped[Optional["Brand"]] = relationship(back_populates="products")
    attributes: Mapped[List["ProductAttribute"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductAttribute.sort_order",
    )
    images: Mapped[List["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
    )
    inventory: Mapped[Optional["Inventory"]] = relationship(
        back_populates="product", uselist=False, cascade="all, delete-orphan"
    )
    reviews: Mapped[List["Review"]] = relationship(back_populates="product")
    wishlist: Mapped[List["Wishlist"]] = relationship(back_populates="product")
    product_prices: Mapped[List["ProductPrice"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    product_discounts: Mapped[List["ProductDiscount"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    price_history: Mapped[List["PriceHistory"]] = relationship(back_populates="product")

    def __repr__(self):
        return f"<Product {self.sku}: {self.name}>"

    @property
    def avg_rating(self) -> Optional[float]:
        approved = [r for r in self.reviews if r.is_approved]
        if not approved:
            return None
        return round(sum(r.rating for r in approved) / len(approved), 1)


class ProductAttribute(Base):
    __tablename__ = "product_attributes"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(30))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped["Product"] = relationship(back_populates="attributes")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[Optional[str]] = mapped_column(String(255))
    is_main: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped["Product"] = relationship(back_populates="images")


class ProductPrice(Base):
    __tablename__ = "product_prices"
    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "customer_group_id",
            "min_quantity",
            name="product_prices_unique_combo",
        ),
        CheckConstraint("price >= 0", name="ck_product_prices_price_non_negative"),
        CheckConstraint("min_quantity >= 1", name="ck_product_prices_min_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    customer_group_id: Mapped[int] = mapped_column(
        ForeignKey("customer_groups.id", ondelete="CASCADE"), nullable=False
    )
    price: Mapped[float] = mapped_column(Float, nullable=False)
    min_quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )

    product: Mapped["Product"] = relationship(back_populates="product_prices")
    customer_group: Mapped["CustomerGroup"] = relationship(back_populates="product_prices")


class ProductDiscount(Base):
    __tablename__ = "product_discounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    discount_type: Mapped[str] = mapped_column(String(32), nullable=False)
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)
    start_date: Mapped[Optional[datetime]] = mapped_column()
    end_date: Mapped[Optional[datetime]] = mapped_column()
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="product_discounts")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    old_price: Mapped[float] = mapped_column(Float, nullable=False)
    new_price: Mapped[float] = mapped_column(Float, nullable=False)
    changed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    changed_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    product: Mapped["Product"] = relationship(back_populates="price_history")
    changed_by_user: Mapped[Optional["User"]] = relationship("User")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("product_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    admin_reply: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    product: Mapped["Product"] = relationship(back_populates="reviews")
    user: Mapped["User"] = relationship(back_populates="reviews")
