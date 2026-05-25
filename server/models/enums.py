import enum


class UserRole(str, enum.Enum):
    customer = "customer"
    content_manager = "content_manager"
    warehouse_manager = "warehouse_manager"
    sales_processor = "sales_processor"
    manager = "manager"
    admin = "admin"


class OrderStatus(str, enum.Enum):
    new = "new"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    picked_up = "picked_up"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    card = "card"
    card_online = "card_online"
    cash = "cash"
    bank_transfer = "bank_transfer"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class DeliveryMethod(str, enum.Enum):
    nova_poshta = "nova_poshta"
    ukrposhta = "ukrposhta"
    courier = "courier"
    pickup = "pickup"


class MovementType(str, enum.Enum):
    receipt = "receipt"
    sale = "sale"
    return_ = "return"
    adjustment = "adjustment"
    write_off = "write_off"


class SupplyStatus(str, enum.Enum):
    draft = "draft"
    ordered = "ordered"
    in_transit = "in_transit"
    received = "received"
    cancelled = "cancelled"


class DiscountType(str, enum.Enum):
    percentage = "PERCENTAGE"
    fixed = "FIXED"
    percent = "PERCENTAGE"

