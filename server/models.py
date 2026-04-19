"""
БудМарт — SQLAlchemy моделі для FastAPI
Файл: server/models.py
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Integer,
    String,
    Float,
    Boolean,
    Text,
    ForeignKey,
    Enum as SAEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func
import enum


class Base(DeclarativeBase):
    pass


def _py_enum(enum_cls: type[enum.Enum], **kwargs):
    """Переліки як TEXT для SQLite (сумісно з schema.sql)."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        validate_strings=True,
        values_callable=lambda x: [m.value for m in x],
        **kwargs,
    )


# ============================================================
# ENUMS
# ============================================================

class UserRole(str, enum.Enum):
    customer = "customer"
    content_manager = "content_manager"
    warehouse_manager = "warehouse_manager"
    sales_processor = "sales_processor"
    manager  = "manager"
    admin    = "admin"

class ProductBadge(str, enum.Enum):
    new  = "new"
    sale = "sale"
    hit  = "hit"

class OrderStatus(str, enum.Enum):
    new        = "new"
    processing = "processing"
    shipped    = "shipped"
    delivered  = "delivered"
    picked_up  = "picked_up"
    cancelled  = "cancelled"
    refunded   = "refunded"

class PaymentMethod(str, enum.Enum):
    card          = "card"
    cash          = "cash"
    bank_transfer = "bank_transfer"

class PaymentStatus(str, enum.Enum):
    pending  = "pending"
    paid     = "paid"
    failed   = "failed"
    refunded = "refunded"

class DeliveryMethod(str, enum.Enum):
    nova_poshta = "nova_poshta"
    ukrposhta   = "ukrposhta"
    courier     = "courier"
    pickup      = "pickup"

class MovementType(str, enum.Enum):
    receipt    = "receipt"
    sale       = "sale"
    return_    = "return"
    adjustment = "adjustment"
    write_off  = "write_off"

class SupplyStatus(str, enum.Enum):
    draft      = "draft"
    ordered    = "ordered"
    in_transit = "in_transit"
    received   = "received"
    cancelled  = "cancelled"

class DiscountType(str, enum.Enum):
    percent = "percent"
    fixed   = "fixed"


# ============================================================
# 1. КОРИСТУВАЧІ
# ============================================================

class User(Base):
    __tablename__ = "users"

    id            : Mapped[int]           = mapped_column(primary_key=True)
    email         : Mapped[str]           = mapped_column(String(255), unique=True, nullable=False)
    password_hash : Mapped[str]           = mapped_column(String(255), nullable=False)
    first_name    : Mapped[str]           = mapped_column(String(100), nullable=False)
    last_name     : Mapped[str]           = mapped_column(String(100), nullable=False)
    phone         : Mapped[Optional[str]] = mapped_column(String(20))
    role          : Mapped[UserRole]      = mapped_column(_py_enum(UserRole), default=UserRole.customer)
    is_active     : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at    : Mapped[datetime]      = mapped_column(default=func.now())
    updated_at    : Mapped[datetime]      = mapped_column(default=func.now(), onupdate=func.now())

    # Зв'язки
    addresses  : Mapped[List["Address"]]  = relationship(back_populates="user", cascade="all, delete-orphan")
    orders     : Mapped[List["Order"]]    = relationship(back_populates="user")
    reviews    : Mapped[List["Review"]]   = relationship(back_populates="user")
    wishlist   : Mapped[List["Wishlist"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    carts      : Mapped[List["Cart"]]     = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    order_messages: Mapped[List["OrderMessage"]] = relationship(back_populates="sender")

    def __repr__(self):
        return f"<User {self.email}>"


class Address(Base):
    __tablename__ = "addresses"

    id          : Mapped[int]           = mapped_column(primary_key=True)
    user_id     : Mapped[int]           = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    label       : Mapped[Optional[str]] = mapped_column(String(50))
    city        : Mapped[str]           = mapped_column(String(100), nullable=False)
    street      : Mapped[str]           = mapped_column(String(200), nullable=False)
    building    : Mapped[str]           = mapped_column(String(20), nullable=False)
    apartment   : Mapped[Optional[str]] = mapped_column(String(20))
    postal_code : Mapped[Optional[str]] = mapped_column(String(10))
    is_default  : Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at  : Mapped[datetime]      = mapped_column(default=func.now())

    user   : Mapped["User"]         = relationship(back_populates="addresses")
    orders : Mapped[List["Order"]]  = relationship(back_populates="address")


# ============================================================
# 2. КАТАЛОГ
# ============================================================

class Category(Base):
    __tablename__ = "categories"

    id          : Mapped[int]           = mapped_column(primary_key=True)
    parent_id   : Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    name        : Mapped[str]           = mapped_column(String(100), nullable=False)
    slug        : Mapped[str]           = mapped_column(String(100), unique=True, nullable=False)
    description : Mapped[Optional[str]] = mapped_column(Text)
    icon        : Mapped[Optional[str]] = mapped_column(String(100))
    image_url   : Mapped[Optional[str]] = mapped_column(String(500))
    sort_order  : Mapped[int]           = mapped_column(Integer, default=0)
    is_active   : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at  : Mapped[datetime]      = mapped_column(default=func.now())

    parent   : Mapped[Optional["Category"]]  = relationship(back_populates="children", remote_side="Category.id")
    children : Mapped[List["Category"]]      = relationship(back_populates="parent")
    products : Mapped[List["Product"]]       = relationship(back_populates="category")

    def __repr__(self):
        return f"<Category {self.name}>"


class Brand(Base):
    __tablename__ = "brands"

    id          : Mapped[int]           = mapped_column(primary_key=True)
    name        : Mapped[str]           = mapped_column(String(100), unique=True, nullable=False)
    slug        : Mapped[str]           = mapped_column(String(100), unique=True, nullable=False)
    description : Mapped[Optional[str]] = mapped_column(Text)
    country     : Mapped[Optional[str]] = mapped_column(String(100))
    logo_url    : Mapped[Optional[str]] = mapped_column(String(500))
    website_url : Mapped[Optional[str]] = mapped_column(String(500))
    is_active   : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at  : Mapped[datetime]      = mapped_column(default=func.now())

    products : Mapped[List["Product"]] = relationship(back_populates="brand")


class Product(Base):
    __tablename__ = "products"

    id               : Mapped[int]                   = mapped_column(primary_key=True)
    category_id      : Mapped[int]                   = mapped_column(ForeignKey("categories.id"), nullable=False)
    brand_id         : Mapped[Optional[int]]          = mapped_column(ForeignKey("brands.id"))
    name             : Mapped[str]                    = mapped_column(String(255), nullable=False)
    slug             : Mapped[str]                    = mapped_column(String(255), unique=True, nullable=False)
    sku              : Mapped[str]                    = mapped_column(String(100), unique=True, nullable=False)
    description      : Mapped[Optional[str]]          = mapped_column(Text)
    price            : Mapped[float]                  = mapped_column(Float, nullable=False)
    old_price        : Mapped[Optional[float]]        = mapped_column(Float)
    unit             : Mapped[str]                    = mapped_column(String(20), default="шт")
    weight_kg        : Mapped[Optional[float]]        = mapped_column(Float)
    icon             : Mapped[Optional[str]]          = mapped_column(String(50))
    badge            : Mapped[Optional[ProductBadge]] = mapped_column(_py_enum(ProductBadge), nullable=True)
    is_active        : Mapped[bool]                   = mapped_column(Boolean, default=True)
    is_featured      : Mapped[bool]                   = mapped_column(Boolean, default=False)
    meta_title       : Mapped[Optional[str]]          = mapped_column(String(255))
    meta_description : Mapped[Optional[str]]          = mapped_column(String(500))
    created_at       : Mapped[datetime]               = mapped_column(default=func.now())
    updated_at       : Mapped[datetime]               = mapped_column(default=func.now(), onupdate=func.now())

    category   : Mapped["Category"]                   = relationship(back_populates="products")
    brand      : Mapped[Optional["Brand"]]            = relationship(back_populates="products")
    attributes : Mapped[List["ProductAttribute"]]     = relationship(back_populates="product", cascade="all, delete-orphan", order_by="ProductAttribute.sort_order")
    images     : Mapped[List["ProductImage"]]         = relationship(back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order")
    inventory  : Mapped[Optional["Inventory"]]        = relationship(back_populates="product", uselist=False, cascade="all, delete-orphan")
    reviews    : Mapped[List["Review"]]               = relationship(back_populates="product")
    wishlist   : Mapped[List["Wishlist"]]             = relationship(back_populates="product")

    def __repr__(self):
        return f"<Product {self.sku}: {self.name}>"

    @property
    def discount_percent(self) -> Optional[int]:
        if self.old_price and self.old_price > self.price:
            return round((1 - self.price / self.old_price) * 100)
        return None

    @property
    def avg_rating(self) -> Optional[float]:
        approved = [r for r in self.reviews if r.is_approved]
        if not approved:
            return None
        return round(sum(r.rating for r in approved) / len(approved), 1)


class ProductAttribute(Base):
    __tablename__ = "product_attributes"

    id         : Mapped[int]           = mapped_column(primary_key=True)
    product_id : Mapped[int]           = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    key        : Mapped[str]           = mapped_column(String(100), nullable=False)
    value      : Mapped[str]           = mapped_column(String(255), nullable=False)
    unit       : Mapped[Optional[str]] = mapped_column(String(30))
    sort_order : Mapped[int]           = mapped_column(Integer, default=0)

    product : Mapped["Product"] = relationship(back_populates="attributes")


class ProductImage(Base):
    __tablename__ = "product_images"

    id         : Mapped[int]           = mapped_column(primary_key=True)
    product_id : Mapped[int]           = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    url        : Mapped[str]           = mapped_column(String(500), nullable=False)
    alt_text   : Mapped[Optional[str]] = mapped_column(String(255))
    is_main    : Mapped[bool]          = mapped_column(Boolean, default=False)
    sort_order : Mapped[int]           = mapped_column(Integer, default=0)

    product : Mapped["Product"] = relationship(back_populates="images")


# ============================================================
# 3. СКЛАД
# ============================================================

class Inventory(Base):
    __tablename__ = "inventory"

    id                  : Mapped[int]           = mapped_column(primary_key=True)
    product_id          : Mapped[int]           = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), unique=True)
    quantity            : Mapped[int]           = mapped_column(Integer, default=0)
    min_quantity        : Mapped[int]           = mapped_column(Integer, default=0)
    max_quantity        : Mapped[int]           = mapped_column(Integer, default=9999)
    min_quantity_alert  : Mapped[Optional[int]] = mapped_column(Integer, default=None)
    location            : Mapped[Optional[str]] = mapped_column(String(50))
    updated_at          : Mapped[datetime]      = mapped_column(default=func.now(), onupdate=func.now())

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

    id            : Mapped[int]           = mapped_column(primary_key=True)
    name          : Mapped[str]           = mapped_column(String(200), nullable=False)
    contact_name  : Mapped[Optional[str]] = mapped_column(String(100))
    phone         : Mapped[Optional[str]] = mapped_column(String(20))
    email         : Mapped[Optional[str]] = mapped_column(String(255))
    address       : Mapped[Optional[str]] = mapped_column(Text)
    payment_terms : Mapped[Optional[str]] = mapped_column(String(100))
    notes         : Mapped[Optional[str]] = mapped_column(Text)
    is_active     : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at    : Mapped[datetime]      = mapped_column(default=func.now())

    supply_orders : Mapped[List["SupplyOrder"]] = relationship(back_populates="supplier")


class SupplyOrder(Base):
    __tablename__ = "supply_orders"

    id             : Mapped[int]                = mapped_column(primary_key=True)
    supplier_id    : Mapped[int]                = mapped_column(ForeignKey("suppliers.id"))
    invoice_number : Mapped[Optional[str]]      = mapped_column(String(100))
    status         : Mapped[SupplyStatus]       = mapped_column(_py_enum(SupplyStatus), default=SupplyStatus.draft)
    total_amount   : Mapped[float]              = mapped_column(Float, default=0)
    notes          : Mapped[Optional[str]]      = mapped_column(Text)
    ordered_at     : Mapped[Optional[datetime]] = mapped_column()
    expected_at    : Mapped[Optional[datetime]] = mapped_column()
    received_at    : Mapped[Optional[datetime]] = mapped_column()
    created_by     : Mapped[Optional[int]]      = mapped_column(ForeignKey("users.id"))
    created_at     : Mapped[datetime]           = mapped_column(default=func.now())

    supplier : Mapped["Supplier"]               = relationship(back_populates="supply_orders")
    items    : Mapped[List["SupplyOrderItem"]]  = relationship(back_populates="supply_order", cascade="all, delete-orphan")


class SupplyOrderItem(Base):
    __tablename__ = "supply_order_items"

    id              : Mapped[int]   = mapped_column(primary_key=True)
    supply_order_id : Mapped[int]   = mapped_column(ForeignKey("supply_orders.id", ondelete="CASCADE"))
    product_id      : Mapped[int]   = mapped_column(ForeignKey("products.id"))
    quantity        : Mapped[int]   = mapped_column(Integer, nullable=False)
    unit_price      : Mapped[float] = mapped_column(Float, nullable=False)

    supply_order : Mapped["SupplyOrder"] = relationship(back_populates="items")
    product      : Mapped["Product"]     = relationship()

    @property
    def total_price(self) -> float:
        return self.quantity * self.unit_price


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id              : Mapped[int]           = mapped_column(primary_key=True)
    product_id      : Mapped[int]           = mapped_column(ForeignKey("products.id"))
    supply_order_id : Mapped[Optional[int]] = mapped_column(ForeignKey("supply_orders.id"))
    order_id        : Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"))
    type            : Mapped[MovementType]  = mapped_column(_py_enum(MovementType), nullable=False)
    quantity        : Mapped[int]           = mapped_column(Integer, nullable=False)
    quantity_before : Mapped[int]           = mapped_column(Integer, nullable=False)
    quantity_after  : Mapped[int]           = mapped_column(Integer, nullable=False)
    note            : Mapped[Optional[str]] = mapped_column(Text)
    created_by      : Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at      : Mapped[datetime]      = mapped_column(default=func.now())

    product: Mapped["Product"] = relationship()


# ============================================================
# 4. ЗАМОВЛЕННЯ
# ============================================================

class Order(Base):
    __tablename__ = "orders"

    id              : Mapped[int]            = mapped_column(primary_key=True)
    user_id         : Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    address_id      : Mapped[Optional[int]]  = mapped_column(ForeignKey("addresses.id", ondelete="SET NULL"))
    contact_name    : Mapped[str]            = mapped_column(String(200), nullable=False)
    contact_phone   : Mapped[str]            = mapped_column(String(20), nullable=False)
    contact_email   : Mapped[Optional[str]]  = mapped_column(String(255))
    delivery_city   : Mapped[Optional[str]]  = mapped_column(String(100))
    delivery_address: Mapped[Optional[str]]  = mapped_column(Text)
    status          : Mapped[OrderStatus]    = mapped_column(_py_enum(OrderStatus), default=OrderStatus.new)
    subtotal        : Mapped[float]          = mapped_column(Float, default=0)
    delivery_cost   : Mapped[float]          = mapped_column(Float, default=0)
    discount        : Mapped[float]          = mapped_column(Float, default=0)
    total           : Mapped[float]          = mapped_column(Float, default=0)
    delivery_method : Mapped[DeliveryMethod] = mapped_column(
        _py_enum(DeliveryMethod), default=DeliveryMethod.nova_poshta
    )
    tracking_number : Mapped[Optional[str]]  = mapped_column(String(100))
    payment_method  : Mapped[PaymentMethod]  = mapped_column(_py_enum(PaymentMethod), default=PaymentMethod.card)
    payment_status  : Mapped[PaymentStatus]  = mapped_column(_py_enum(PaymentStatus), default=PaymentStatus.pending)
    promo_code_id   : Mapped[Optional[int]]  = mapped_column(ForeignKey("promo_codes.id"))
    comment         : Mapped[Optional[str]]  = mapped_column(Text)
    admin_note      : Mapped[Optional[str]]  = mapped_column(Text)
    created_at      : Mapped[datetime]       = mapped_column(default=func.now())
    updated_at      : Mapped[datetime]       = mapped_column(default=func.now(), onupdate=func.now())

    user       : Mapped[Optional["User"]]      = relationship(back_populates="orders")
    address    : Mapped[Optional["Address"]]   = relationship(back_populates="orders")
    items      : Mapped[List["OrderItem"]]     = relationship(back_populates="order", cascade="all, delete-orphan")
    promo_code : Mapped[Optional["PromoCode"]] = relationship()
    movements  : Mapped[List["InventoryMovement"]] = relationship(
        primaryjoin="Order.id == InventoryMovement.order_id",
        foreign_keys="InventoryMovement.order_id"
    )
    messages   : Mapped[List["OrderMessage"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderMessage.created_at",
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (UniqueConstraint("order_id", "product_id", name="unique_order_product"),)

    id           : Mapped[int]           = mapped_column(primary_key=True)
    order_id     : Mapped[int]           = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id   : Mapped[Optional[int]] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    product_name : Mapped[str]           = mapped_column(String(255), nullable=False)
    product_sku  : Mapped[str]           = mapped_column(String(100), nullable=False)
    quantity     : Mapped[int]           = mapped_column(Integer, nullable=False)
    unit_price   : Mapped[float]         = mapped_column(Float, nullable=False)

    order   : Mapped["Order"]           = relationship(back_populates="items")
    product : Mapped[Optional["Product"]] = relationship()

    @property
    def total_price(self) -> float:
        return self.quantity * self.unit_price


class OrderMessage(Base):
    __tablename__ = "order_messages"

    id         : Mapped[int]      = mapped_column(primary_key=True)
    order_id   : Mapped[int]      = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    sender_id  : Mapped[int]      = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body       : Mapped[str]      = mapped_column(Text, nullable=False)
    is_from_staff: Mapped[bool]   = mapped_column(Boolean, default=False)
    created_at : Mapped[datetime] = mapped_column(default=func.now())

    order  : Mapped["Order"] = relationship(back_populates="messages")
    sender : Mapped["User"] = relationship(back_populates="order_messages")


# ============================================================
# 5. ВІДГУКИ ТА ВИБРАНЕ
# ============================================================

class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("product_id", "user_id"),)

    id          : Mapped[int]           = mapped_column(primary_key=True)
    product_id  : Mapped[int]           = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    user_id     : Mapped[int]           = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating      : Mapped[int]           = mapped_column(Integer, nullable=False)
    comment     : Mapped[Optional[str]] = mapped_column(Text)
    is_approved : Mapped[bool]          = mapped_column(Boolean, default=False)
    admin_reply : Mapped[Optional[str]] = mapped_column(Text)
    created_at  : Mapped[datetime]      = mapped_column(default=func.now())

    product : Mapped["Product"] = relationship(back_populates="reviews")
    user    : Mapped["User"]    = relationship(back_populates="reviews")


# ============================================================
# 6. ПРОМОКОДИ
# ============================================================

class PromoCode(Base):
    __tablename__ = "promo_codes"

    id               : Mapped[int]                = mapped_column(primary_key=True)
    code             : Mapped[str]                = mapped_column(String(50), unique=True, nullable=False)
    description      : Mapped[Optional[str]]      = mapped_column(String(255))
    discount_type    : Mapped[DiscountType]       = mapped_column(_py_enum(DiscountType), nullable=False)
    discount_value   : Mapped[float]              = mapped_column(Float, nullable=False)
    min_order_amount : Mapped[float]              = mapped_column(Float, default=0)
    max_uses         : Mapped[Optional[int]]      = mapped_column(Integer)
    used_count       : Mapped[int]                = mapped_column(Integer, default=0)
    valid_from       : Mapped[Optional[datetime]] = mapped_column()
    valid_until      : Mapped[Optional[datetime]] = mapped_column()
    is_active        : Mapped[bool]               = mapped_column(Boolean, default=True)
    created_at       : Mapped[datetime]           = mapped_column(default=func.now())

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
        if self.discount_type == DiscountType.percent:
            return round(order_amount * self.discount_value / 100, 2)
        return min(self.discount_value, order_amount)


# ============================================================
# CART
# ============================================================

class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="carts")
    items: Mapped[List["CartItem"]] = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cart_id: Mapped[int] = mapped_column(Integer, ForeignKey("carts.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    added_at: Mapped[datetime] = mapped_column(default=func.now())

    cart: Mapped["Cart"] = relationship("Cart", back_populates="items")
    product: Mapped["Product"] = relationship("Product")


# ============================================================
# NOTIFICATIONS
# ============================================================

class NotificationType(str, enum.Enum):
    low_stock = "low_stock"
    order_status = "order_status"
    supply_arrival = "supply_arrival"
    system = "system"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[NotificationType] = mapped_column(_py_enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    target_path: Mapped[Optional[str]] = mapped_column(String(255))
    target_product_id: Mapped[Optional[int]] = mapped_column(Integer)
    target_inventory_id: Mapped[Optional[int]] = mapped_column(Integer)
    target_order_id: Mapped[Optional[int]] = mapped_column(Integer)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="notifications")


# ============================================================
# WISHLIST
# ============================================================

class Wishlist(Base):
    __tablename__ = "wishlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="wishlist")
    product: Mapped["Product"] = relationship("Product")

    __table_args__ = (UniqueConstraint('user_id', 'product_id', name='unique_user_product_wishlist'),)


# ============================================================
# AUDIT & COMPLIANCE
# ============================================================

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # create, update, delete, status_change
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # user, product, order, inventory
    resource_id: Mapped[Optional[int]] = mapped_column(Integer)
    changes_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON diff of before/after
    request_id: Mapped[Optional[str]] = mapped_column(String(36))  # UUID from request
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv4 or IPv6
    details: Mapped[Optional[str]] = mapped_column(Text)  # Additional context
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)
    
    user: Mapped[Optional["User"]] = relationship("User")


class ClientError(Base):
    __tablename__ = "client_errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    path: Mapped[Optional[str]] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    stack: Mapped[Optional[str]] = mapped_column(Text)
    component_stack: Mapped[Optional[str]] = mapped_column(Text)
    request_id: Mapped[Optional[str]] = mapped_column(String(64))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(default=func.now(), index=True)

    user: Mapped[Optional["User"]] = relationship("User")


