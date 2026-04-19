-- ============================================================
-- БудМарт — Повна схема бази даних
-- Версія: 1.0 | SQLite / PostgreSQL сумісна
-- Порядок таблиць виправлено під зовнішні ключі SQLite.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. КОРИСТУВАЧІ ТА АДРЕСИ
-- ============================================================

CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    phone           TEXT,
    role            TEXT NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('customer', 'content_manager', 'warehouse_manager', 'sales_processor', 'manager', 'admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE addresses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           TEXT,
    city            TEXT NOT NULL,
    street          TEXT NOT NULL,
    building        TEXT NOT NULL,
    apartment       TEXT,
    postal_code     TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. КАТАЛОГ
-- ============================================================

CREATE TABLE categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    icon            TEXT,
    image_url       TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brands (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    country         TEXT,
    logo_url        TEXT,
    website_url     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    brand_id        INTEGER REFERENCES brands(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    sku             TEXT NOT NULL UNIQUE,
    description     TEXT,
    price           REAL NOT NULL CHECK (price >= 0),
    old_price       REAL CHECK (old_price >= 0),
    unit            TEXT NOT NULL DEFAULT 'шт',
    weight_kg       REAL,
    icon            TEXT,
    badge           TEXT CHECK (badge IN ('new', 'sale', 'hit', NULL)),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    meta_title      TEXT,
    meta_description TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_attributes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    value           TEXT NOT NULL,
    unit            TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    alt_text        TEXT,
    is_main         BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 3. СКЛАД ТА ПОСТАЧАННЯ (без посилань на orders)
-- ============================================================

CREATE TABLE inventory (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id          INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity        INTEGER NOT NULL DEFAULT 0,
    max_quantity        INTEGER NOT NULL DEFAULT 9999,
    min_quantity_alert  INTEGER DEFAULT NULL,
    location            TEXT,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    contact_name    TEXT,
    phone           TEXT,
    email           TEXT,
    address         TEXT,
    payment_terms   TEXT,
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supply_orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    invoice_number  TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','ordered','in_transit','received','cancelled')),
    total_amount    REAL NOT NULL DEFAULT 0,
    notes           TEXT,
    ordered_at      TIMESTAMP,
    expected_at     TIMESTAMP,
    received_at     TIMESTAMP,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supply_order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supply_order_id INTEGER NOT NULL REFERENCES supply_orders(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      REAL NOT NULL CHECK (unit_price >= 0),
    total_price     REAL NOT NULL DEFAULT 0
);

-- ============================================================
-- 6. ПРОМОКОДИ (раніше за orders — FK promo_code_id)
-- ============================================================

CREATE TABLE promo_codes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    description     TEXT,
    discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value  REAL NOT NULL CHECK (discount_value > 0),
    min_order_amount REAL NOT NULL DEFAULT 0,
    max_uses        INTEGER,
    used_count      INTEGER NOT NULL DEFAULT 0,
    valid_from      TIMESTAMP,
    valid_until     TIMESTAMP,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. ЗАМОВЛЕННЯ КЛІЄНТІВ
-- ============================================================

CREATE TABLE orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    address_id      INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    contact_name    TEXT NOT NULL,
    contact_phone   TEXT NOT NULL,
    contact_email   TEXT,
    delivery_city   TEXT,
    delivery_address TEXT,
    status          TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','processing','shipped','delivered','picked_up','cancelled','refunded')),
    subtotal        REAL NOT NULL DEFAULT 0,
    delivery_cost   REAL NOT NULL DEFAULT 0,
    discount        REAL NOT NULL DEFAULT 0,
    total           REAL NOT NULL DEFAULT 0,
    delivery_method TEXT NOT NULL DEFAULT 'nova_poshta'
                        CHECK (delivery_method IN ('nova_poshta','ukrposhta','courier','pickup')),
    tracking_number TEXT,
    payment_method  TEXT NOT NULL DEFAULT 'card'
                        CHECK (payment_method IN ('card','cash','bank_transfer')),
    payment_status  TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
    promo_code_id   INTEGER REFERENCES promo_codes(id),
    comment         TEXT,
    admin_note      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name    TEXT NOT NULL,
    product_sku     TEXT NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      REAL NOT NULL CHECK (unit_price >= 0),
    total_price     REAL NOT NULL DEFAULT 0,
    UNIQUE (order_id, product_id)
);

CREATE TABLE order_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    is_from_staff   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Рухи складу (після orders — FK order_id)
CREATE TABLE inventory_movements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    supply_order_id INTEGER REFERENCES supply_orders(id),
    order_id        INTEGER REFERENCES orders(id),
    type            TEXT NOT NULL
                        CHECK (type IN ('receipt','sale','return','adjustment','write_off')),
    quantity        INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after  INTEGER NOT NULL,
    note            TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. ВІДГУКИ ТА ВИБРАНЕ
-- ============================================================

CREATE TABLE reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
    admin_reply     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, user_id)
);

-- ============================================================
-- 7. ІНДЕКСИ
-- ============================================================

CREATE INDEX idx_products_category    ON products(category_id);
CREATE INDEX idx_products_brand       ON products(brand_id);
CREATE INDEX idx_products_sku         ON products(sku);
CREATE INDEX idx_products_slug        ON products(slug);
CREATE INDEX idx_products_is_active   ON products(is_active);
CREATE INDEX idx_products_price       ON products(price);
CREATE INDEX idx_attrs_product        ON product_attributes(product_id);
CREATE INDEX idx_inventory_product    ON inventory(product_id);
CREATE INDEX idx_movements_product    ON inventory_movements(product_id);
CREATE INDEX idx_movements_type       ON inventory_movements(type);
CREATE INDEX idx_movements_date       ON inventory_movements(created_at);
CREATE INDEX idx_orders_user          ON orders(user_id);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orders_date          ON orders(created_at);
CREATE INDEX idx_order_items_order    ON order_items(order_id);
CREATE INDEX idx_order_items_product  ON order_items(product_id);
CREATE INDEX idx_order_messages_order ON order_messages(order_id);
CREATE INDEX idx_order_messages_date  ON order_messages(created_at);
CREATE INDEX idx_reviews_product      ON reviews(product_id);
CREATE INDEX idx_reviews_approved     ON reviews(is_approved);
CREATE INDEX idx_supply_supplier      ON supply_orders(supplier_id);
CREATE INDEX idx_supply_status        ON supply_orders(status);

-- ============================================================
-- 8. ТРИГЕРИ (без AFTER UPDATE на products/orders — унікнення рекурсії в SQLite)
-- ============================================================

CREATE TRIGGER trg_receipt_movement
AFTER UPDATE OF status ON supply_orders
WHEN NEW.status = 'received' AND OLD.status != 'received'
BEGIN
    UPDATE inventory
    SET quantity = quantity + (
        SELECT soi.quantity
        FROM supply_order_items soi
        WHERE soi.supply_order_id = NEW.id AND soi.product_id = inventory.product_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE product_id IN (
        SELECT product_id FROM supply_order_items WHERE supply_order_id = NEW.id
    );
END;

-- ============================================================
-- CARTS & NOTIFICATIONS
-- ============================================================

CREATE TABLE carts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id         INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL DEFAULT 1,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('low_stock', 'order_status', 'supply_arrival', 'system')),
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    target_path     TEXT,
    target_product_id INTEGER,
    target_inventory_id INTEGER,
    target_order_id INTEGER,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_errors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    path            TEXT,
    message         TEXT NOT NULL,
    stack           TEXT,
    component_stack TEXT,
    request_id      TEXT,
    user_agent      TEXT,
    ip_address      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_errors_created_at ON client_errors(created_at);
CREATE INDEX idx_client_errors_user_id ON client_errors(user_id);

-- ============================================================
-- WISHLIST
-- ============================================================

CREATE TABLE wishlists (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);
