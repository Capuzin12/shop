-- ============================================================
-- ПОВНЕ ОЧИЩЕННЯ + REBUILD СХЕМИ
-- Проєкт: БудМарт (Supabase)
-- ============================================================

DROP VIEW  IF EXISTS public.v_effective_prices CASCADE;

DROP TABLE IF EXISTS public.price_history          CASCADE;
DROP TABLE IF EXISTS public.product_discounts      CASCADE;
DROP TABLE IF EXISTS public.product_prices         CASCADE;
DROP TABLE IF EXISTS public.wishlists              CASCADE;
DROP TABLE IF EXISTS public.reviews                CASCADE;
DROP TABLE IF EXISTS public.order_messages         CASCADE;
DROP TABLE IF EXISTS public.order_items            CASCADE;
DROP TABLE IF EXISTS public.orders                 CASCADE;
DROP TABLE IF EXISTS public.cart_items             CASCADE;
DROP TABLE IF EXISTS public.carts                  CASCADE;
DROP TABLE IF EXISTS public.inventory_movements    CASCADE;
DROP TABLE IF EXISTS public.inventory              CASCADE;
DROP TABLE IF EXISTS public.supply_order_items     CASCADE;
DROP TABLE IF EXISTS public.supply_orders          CASCADE;
DROP TABLE IF EXISTS public.suppliers              CASCADE;
DROP TABLE IF EXISTS public.product_attributes     CASCADE;
DROP TABLE IF EXISTS public.product_images         CASCADE;
DROP TABLE IF EXISTS public.products               CASCADE;
DROP TABLE IF EXISTS public.promo_codes            CASCADE;
DROP TABLE IF EXISTS public.categories             CASCADE;
DROP TABLE IF EXISTS public.brands                 CASCADE;
DROP TABLE IF EXISTS public.notifications          CASCADE;
DROP TABLE IF EXISTS public.client_errors          CASCADE;
DROP TABLE IF EXISTS public.audit_logs             CASCADE;
DROP TABLE IF EXISTS public.addresses              CASCADE;
DROP TABLE IF EXISTS public.users                  CASCADE;
DROP TABLE IF EXISTS public.customer_groups        CASCADE;
DROP TABLE IF EXISTS public.alembic_version        CASCADE;

DROP FUNCTION IF EXISTS public.fn_set_default_customer_group() CASCADE;
DROP FUNCTION IF EXISTS public.fn_log_price_change()           CASCADE;

CREATE TABLE public.alembic_version (
  version_num VARCHAR NOT NULL,
  CONSTRAINT alembic_version_pkey PRIMARY KEY (version_num)
);

CREATE TABLE public.customer_groups (
  id          SERIAL    PRIMARY KEY,
  name        VARCHAR   NOT NULL UNIQUE,
  description TEXT,
  is_default  BOOLEAN   NOT NULL DEFAULT false,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customer_groups_single_default_idx
  ON public.customer_groups (is_default)
  WHERE is_default = true;

INSERT INTO public.customer_groups (name, description, is_default) VALUES
  ('Роздріб',  'Звичайні роздрібні покупці',          true),
  ('Гуртовик', 'Оптові покупці зі знижковими цінами', false),
  ('Виконроб', 'Виконроби та будівельні бригади',      false);

CREATE TABLE public.users (
  id                  SERIAL    PRIMARY KEY,
  email               VARCHAR   NOT NULL UNIQUE,
  password_hash       VARCHAR   NOT NULL,
  first_name          VARCHAR   NOT NULL,
  last_name           VARCHAR   NOT NULL,
  phone               VARCHAR,
  role                VARCHAR   NOT NULL,
  customer_group_id   INTEGER   REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  is_active           BOOLEAN   NOT NULL DEFAULT true,
  created_at          TIMESTAMP NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_set_default_customer_group()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_group_id IS NULL THEN
    SELECT id INTO NEW.customer_group_id
    FROM public.customer_groups WHERE is_default = true LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_default_customer_group
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_default_customer_group();

CREATE TABLE public.addresses (
  id          SERIAL    PRIMARY KEY,
  user_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label       VARCHAR,
  city        VARCHAR   NOT NULL,
  street      VARCHAR   NOT NULL,
  building    VARCHAR   NOT NULL,
  apartment   VARCHAR,
  postal_code VARCHAR,
  is_default  BOOLEAN   NOT NULL DEFAULT false,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.brands (
  id          SERIAL    PRIMARY KEY,
  name        VARCHAR   NOT NULL UNIQUE,
  slug        VARCHAR   NOT NULL UNIQUE,
  description TEXT,
  country     VARCHAR,
  logo_url    VARCHAR,
  website_url VARCHAR,
  is_active   BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id          SERIAL    PRIMARY KEY,
  parent_id   INTEGER   REFERENCES public.categories(id) ON DELETE SET NULL,
  name        VARCHAR   NOT NULL,
  slug        VARCHAR   NOT NULL UNIQUE,
  description TEXT,
  icon        VARCHAR,
  image_url   VARCHAR,
  sort_order  INTEGER   NOT NULL DEFAULT 0,
  is_active   BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.promo_codes (
  id                SERIAL    PRIMARY KEY,
  code              VARCHAR   NOT NULL UNIQUE,
  description       VARCHAR,
  discount_type     VARCHAR   NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  discount_value    DOUBLE PRECISION NOT NULL CHECK (discount_value > 0),
  min_order_amount  DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_uses          INTEGER,
  used_count        INTEGER   NOT NULL DEFAULT 0,
  valid_from        TIMESTAMP,
  valid_until       TIMESTAMP,
  is_active         BOOLEAN   NOT NULL DEFAULT true,
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id               SERIAL           PRIMARY KEY,
  category_id      INTEGER          NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  brand_id         INTEGER          REFERENCES public.brands(id) ON DELETE SET NULL,
  name             VARCHAR          NOT NULL,
  slug             VARCHAR          NOT NULL UNIQUE,
  sku              VARCHAR          NOT NULL UNIQUE,
  description      TEXT,
  price            DOUBLE PRECISION NOT NULL CHECK (price >= 0),
  unit             VARCHAR          NOT NULL,
  weight_kg        DOUBLE PRECISION,
  icon             VARCHAR,
  badge            VARCHAR,
  is_active        BOOLEAN          NOT NULL DEFAULT true,
  is_featured      BOOLEAN          NOT NULL DEFAULT false,
  meta_title       VARCHAR,
  meta_description VARCHAR,
  created_at       TIMESTAMP        NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP        NOT NULL DEFAULT now()
);

CREATE TABLE public.product_prices (
  id                SERIAL           PRIMARY KEY,
  product_id        INTEGER          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_group_id INTEGER          NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  price             DOUBLE PRECISION NOT NULL CHECK (price >= 0),
  min_quantity      INTEGER          NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  updated_at        TIMESTAMP        NOT NULL DEFAULT now(),
  CONSTRAINT product_prices_unique_combo UNIQUE (product_id, customer_group_id, min_quantity)
);

CREATE INDEX product_prices_product_idx        ON public.product_prices (product_id);
CREATE INDEX product_prices_customer_group_idx ON public.product_prices (customer_group_id);

CREATE TABLE public.product_discounts (
  id             SERIAL           PRIMARY KEY,
  product_id     INTEGER          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_type  VARCHAR          NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_PRICE')),
  discount_value DOUBLE PRECISION NOT NULL CHECK (discount_value > 0),
  start_date     TIMESTAMP,
  end_date       TIMESTAMP,
  is_active      BOOLEAN          NOT NULL DEFAULT true,
  CONSTRAINT product_discounts_dates_check
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);

CREATE INDEX product_discounts_product_idx ON public.product_discounts (product_id);
CREATE INDEX product_discounts_active_idx  ON public.product_discounts (is_active, start_date, end_date);

CREATE TABLE public.price_history (
  id          SERIAL           PRIMARY KEY,
  product_id  INTEGER          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price   DOUBLE PRECISION NOT NULL,
  new_price   DOUBLE PRECISION NOT NULL,
  changed_by  INTEGER          REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMP        NOT NULL DEFAULT now()
);

CREATE INDEX price_history_product_idx    ON public.price_history (product_id);
CREATE INDEX price_history_changed_at_idx ON public.price_history (changed_at DESC);

CREATE OR REPLACE FUNCTION public.fn_log_price_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.price <> OLD.price THEN
    INSERT INTO public.price_history (product_id, old_price, new_price, changed_by)
    VALUES (
      NEW.id,
      OLD.price,
      NEW.price,
      NULLIF(current_setting('app.current_user_id', true), '')::INTEGER
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_price_history
  AFTER UPDATE OF price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_price_change();

CREATE TABLE public.product_attributes (
  id         SERIAL  PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key        VARCHAR NOT NULL,
  value      VARCHAR NOT NULL,
  unit       VARCHAR,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.product_images (
  id         SERIAL  PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url        VARCHAR NOT NULL,
  alt_text   VARCHAR,
  is_main    BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.inventory (
  id                 SERIAL    PRIMARY KEY,
  product_id         INTEGER   NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  quantity           INTEGER   NOT NULL DEFAULT 0,
  min_quantity       INTEGER   NOT NULL DEFAULT 0,
  max_quantity       INTEGER   NOT NULL DEFAULT 9999,
  min_quantity_alert INTEGER,
  location           VARCHAR,
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id            SERIAL    PRIMARY KEY,
  name          VARCHAR   NOT NULL,
  contact_name  VARCHAR,
  phone         VARCHAR,
  email         VARCHAR,
  address       TEXT,
  payment_terms VARCHAR,
  notes         TEXT,
  is_active     BOOLEAN   NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.supply_orders (
  id             SERIAL    PRIMARY KEY,
  supplier_id    INTEGER   NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  invoice_number VARCHAR,
  status         VARCHAR   NOT NULL,
  total_amount   DOUBLE PRECISION NOT NULL DEFAULT 0,
  notes          TEXT,
  ordered_at     TIMESTAMP,
  expected_at    TIMESTAMP,
  received_at    TIMESTAMP,
  created_by     INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.supply_order_items (
  id              SERIAL           PRIMARY KEY,
  supply_order_id INTEGER          NOT NULL REFERENCES public.supply_orders(id) ON DELETE CASCADE,
  product_id      INTEGER          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity        INTEGER          NOT NULL CHECK (quantity > 0),
  unit_price      DOUBLE PRECISION NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE public.inventory_movements (
  id              SERIAL    PRIMARY KEY,
  product_id      INTEGER   NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  supply_order_id INTEGER   REFERENCES public.supply_orders(id) ON DELETE SET NULL,
  order_id        INTEGER,
  type            VARCHAR   NOT NULL,
  quantity        INTEGER   NOT NULL,
  quantity_before INTEGER   NOT NULL,
  quantity_after  INTEGER   NOT NULL,
  note            TEXT,
  created_by      INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id               SERIAL           PRIMARY KEY,
  user_id          INTEGER          REFERENCES public.users(id) ON DELETE SET NULL,
  address_id       INTEGER          REFERENCES public.addresses(id) ON DELETE SET NULL,
  contact_name     VARCHAR          NOT NULL,
  contact_phone    VARCHAR          NOT NULL,
  contact_email    VARCHAR,
  delivery_city    VARCHAR,
  delivery_address TEXT,
  status           VARCHAR          NOT NULL,
  subtotal         DOUBLE PRECISION NOT NULL DEFAULT 0,
  delivery_cost    DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount         DOUBLE PRECISION NOT NULL DEFAULT 0,
  total            DOUBLE PRECISION NOT NULL DEFAULT 0,
  delivery_method  VARCHAR          NOT NULL,
  tracking_number  VARCHAR,
  payment_method   VARCHAR          NOT NULL,
  payment_status   VARCHAR          NOT NULL,
  promo_code_id    INTEGER          REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  comment          TEXT,
  admin_note       TEXT,
  created_at       TIMESTAMP        NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP        NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE TABLE public.order_items (
  id           SERIAL           PRIMARY KEY,
  order_id     INTEGER          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id   INTEGER          REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR          NOT NULL,
  product_sku  VARCHAR          NOT NULL,
  quantity     INTEGER          NOT NULL CHECK (quantity > 0),
  unit_price   DOUBLE PRECISION NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE public.order_messages (
  id            SERIAL    PRIMARY KEY,
  order_id      INTEGER   NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  body          TEXT      NOT NULL,
  is_from_staff BOOLEAN   NOT NULL DEFAULT false,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.carts (
  id         SERIAL    PRIMARY KEY,
  user_id    INTEGER   NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.cart_items (
  id         SERIAL    PRIMARY KEY,
  cart_id    INTEGER   NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id INTEGER   NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity   INTEGER   NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_unique_product UNIQUE (cart_id, product_id)
);

CREATE TABLE public.wishlists (
  id         SERIAL    PRIMARY KEY,
  user_id    INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id INTEGER   NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_at   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT wishlists_unique UNIQUE (user_id, product_id)
);

CREATE TABLE public.reviews (
  id          SERIAL    PRIMARY KEY,
  product_id  INTEGER   NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating      INTEGER   NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  is_approved BOOLEAN   NOT NULL DEFAULT false,
  admin_reply TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT reviews_unique_user_product UNIQUE (user_id, product_id)
);

CREATE TABLE public.notifications (
  id                  SERIAL    PRIMARY KEY,
  user_id             INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                VARCHAR   NOT NULL,
  title               VARCHAR   NOT NULL,
  message             TEXT      NOT NULL,
  target_path         VARCHAR,
  target_product_id   INTEGER   REFERENCES public.products(id) ON DELETE SET NULL,
  target_inventory_id INTEGER   REFERENCES public.inventory(id) ON DELETE SET NULL,
  target_order_id     INTEGER   REFERENCES public.orders(id) ON DELETE SET NULL,
  is_read             BOOLEAN   NOT NULL DEFAULT false,
  created_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id            SERIAL    PRIMARY KEY,
  user_id       INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  action        VARCHAR   NOT NULL,
  resource_type VARCHAR   NOT NULL,
  resource_id   INTEGER,
  changes_json  TEXT,
  request_id    VARCHAR,
  ip_address    VARCHAR,
  details       TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_idx      ON public.audit_logs (user_id);
CREATE INDEX audit_logs_resource_idx  ON public.audit_logs (resource_type, resource_id);
CREATE INDEX audit_logs_created_idx   ON public.audit_logs (created_at DESC);

CREATE TABLE public.client_errors (
  id              SERIAL    PRIMARY KEY,
  user_id         INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  path            VARCHAR,
  message         VARCHAR   NOT NULL,
  stack           TEXT,
  component_stack TEXT,
  request_id      VARCHAR,
  user_agent      VARCHAR,
  ip_address      VARCHAR,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.v_effective_prices AS
SELECT
  p.id                                        AS product_id,
  p.name                                      AS product_name,
  p.price                                     AS base_price,
  cg.id                                       AS customer_group_id,
  cg.name                                     AS customer_group_name,
  pp.min_quantity,
  COALESCE(pp.price, p.price)                 AS group_price,
  pd.discount_type,
  pd.discount_value,
  CASE
    WHEN pd.id IS NOT NULL AND pd.discount_type = 'PERCENTAGE'
      THEN ROUND((COALESCE(pp.price, p.price) * (1 - pd.discount_value / 100))::NUMERIC, 2)
    WHEN pd.id IS NOT NULL AND pd.discount_type = 'FIXED_PRICE'
      THEN pd.discount_value
    ELSE COALESCE(pp.price, p.price)
  END                                         AS effective_price
FROM public.products p
LEFT JOIN public.product_prices pp ON pp.product_id = p.id
LEFT JOIN public.customer_groups cg ON cg.id = pp.customer_group_id
LEFT JOIN LATERAL (
  SELECT * FROM public.product_discounts d
  WHERE d.product_id = p.id
    AND d.is_active = true
    AND (d.start_date IS NULL OR d.start_date <= now())
    AND (d.end_date   IS NULL OR d.end_date   >= now())
  ORDER BY d.id DESC LIMIT 1
) pd ON true
WHERE p.is_active = true;

-- ============================================================
-- INIT complete
-- ============================================================

