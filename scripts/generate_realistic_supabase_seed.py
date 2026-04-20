from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import random

OUT_FILE = Path(__file__).resolve().parent.parent / "server" / "seed_supabase_realistic.sql"
RNG = random.Random(42)


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def dt(day_shift: int = 0) -> str:
    value = datetime(2026, 4, 20, 12, 0, 0) + timedelta(days=day_shift)
    return q(value.isoformat(sep=" ", timespec="seconds"))


USERS = [
    {
        "email": "admin@budmart.ua",
        "password_hash": "$2b$12$389pz.KGwkmne3Yqp1xaRe76o0wrVng8k7czAGYxfisJDdkQQgjpq",  # admin123
        "first_name": "Адміністратор",
        "last_name": "БудМарт",
        "phone": "+380441234567",
        "role": "admin",
    },
    {
        "email": "manager@budmart.ua",
        "password_hash": "$2b$12$TJwg.9.UjMQS7w40cp7RYObUMIE9kIvtdnCi/DMauwAVnwD9Pib9.",  # manager123
        "first_name": "Олена",
        "last_name": "Коваль",
        "phone": "+380671112233",
        "role": "manager",
    },
    {
        "email": "content@budmart.ua",
        "password_hash": "$2b$12$RT6MfmfGzlVIsSzzZwmavOT/1OOAlBpLvnd/iKEKYQ864y48V7JZi",  # content123
        "first_name": "Ірина",
        "last_name": "Мельник",
        "phone": "+380631234567",
        "role": "content_manager",
    },
    {
        "email": "warehouse@budmart.ua",
        "password_hash": "$2b$12$BvBXNiFwbfHTINLfwBE0w.eQAOwoHGV7qCTjGd3PRmYIQceBIQ2ru",  # warehouse123
        "first_name": "Андрій",
        "last_name": "Бондар",
        "phone": "+380661234567",
        "role": "warehouse_manager",
    },
    {
        "email": "sales@budmart.ua",
        "password_hash": "$2b$12$Rfc2H3WfJxns7jX90D5GBu/6mdKAa724DjVYs6q3Jm1zeDll4yxNG",  # sales123
        "first_name": "Марина",
        "last_name": "Ткачук",
        "phone": "+380681234567",
        "role": "sales_processor",
    },
]

CUSTOMER_NAMES = [
    ("Іван", "Петренко"), ("Олександр", "Кравчук"), ("Наталія", "Шевченко"),
    ("Дмитро", "Сидоренко"), ("Юлія", "Лисенко"), ("Максим", "Коваленко"),
    ("Тетяна", "Романюк"), ("Артем", "Гнатюк"), ("Софія", "Данилюк"),
    ("Михайло", "Марчук"), ("Вікторія", "Поліщук"), ("Роман", "Савчук"),
]

for idx, (first, last) in enumerate(CUSTOMER_NAMES, start=1):
    USERS.append(
        {
            "email": f"customer{idx:02d}@example.com",
            "password_hash": "$2b$12$IweW6MepbP9asCMSoN0KKOBD1Z1fazJl2QPMXdvm5GOcZPpYEqhg.",  # user123
            "first_name": first,
            "last_name": last,
            "phone": f"+38050{7000000 + idx}",
            "role": "customer",
        }
    )

CATEGORIES = [
    ("Цемент і суміші", "cement", "🧱", 1),
    ("Цегла та блоки", "brick", "🏗️", 2),
    ("Утеплення", "insulation", "🌡️", 3),
    ("Покрівля", "roof", "🏠", 4),
    ("Підлога", "floor", "🟫", 5),
    ("Фасад", "facade", "🎨", 6),
    ("Інструменти", "tools", "🔧", 7),
    ("Фарби", "paint", "🖌️", 8),
]

BRANDS = [
    ("Knauf", "knauf", "Україна"),
    ("Baumit", "baumit", "Австрія"),
    ("Ceresit", "ceresit", "Польща"),
    ("Rockwool", "rockwool", "Данія"),
    ("Bosch", "bosch", "Німеччина"),
    ("Sniezka", "sniezka", "Польща"),
    ("Makita", "makita", "Японія"),
    ("Dufa", "dufa", "Німеччина"),
]

SUPPLIERS = [
    ("ТОВ Knauf Україна", "Олексій Мороз", "+380441234567", "Нетто 30 днів"),
    ("Baumit ТОВ", "Світлана Ткач", "+380321234567", "Передоплата 50%"),
    ("Ceresit Henkel", "Дмитро Бондар", "+380671234567", "Відтермінування 45 днів"),
    ("Rockwool UA", "Ігор Мельник", "+380442223344", "Нетто 21 день"),
    ("Bosch Professional", "Катерина Левчук", "+380443334455", "Нетто 30 днів"),
]

PRODUCTS = [
    {
        "category": "cement", "brand": "knauf", "name": "Цемент Portland М500 50кг", "slug": "cement-m500-50",
        "sku": "CEM-M500-50", "price": 480.0, "old_price": 520.0, "unit": "міш", "icon": "🧱", "badge": "sale",
        "is_featured": True, "qty": 245, "min_qty": 50,
        "attrs": [("Марка", "М500"), ("Маса", "50 кг"), ("Клас міцності", "42.5N")],
    },
    {
        "category": "cement", "brand": "ceresit", "name": "Клей для плитки Ceresit CM 11 25кг", "slug": "ceresit-cm11-25",
        "sku": "CRS-CM11-25", "price": 295.0, "old_price": 330.0, "unit": "міш", "icon": "🧪", "badge": "sale",
        "is_featured": True, "qty": 96, "min_qty": 25,
        "attrs": [("Маса", "25 кг"), ("Час коригування", "20 хв"), ("Основа", "Цементна")],
    },
    {
        "category": "brick", "brand": "baumit", "name": "Газоблок Baumit D500 600x300x200", "slug": "gazoblock-d500",
        "sku": "GAZ-D500-200", "price": 78.0, "old_price": 85.0, "unit": "шт", "icon": "🏗️", "badge": "sale",
        "is_featured": False, "qty": 430, "min_qty": 100,
        "attrs": [("Клас", "D500"), ("Розмір", "600x300x200 мм"), ("Міцність", "B2.5")],
    },
    {
        "category": "insulation", "brand": "rockwool", "name": "Мінвата Rockwool 100мм (4 шт)", "slug": "rockwool-100",
        "sku": "RCK-100-4", "price": 1240.0, "old_price": None, "unit": "уп", "icon": "🧶", "badge": "new",
        "is_featured": True, "qty": 54, "min_qty": 20,
        "attrs": [("Товщина", "100 мм"), ("Клас горючості", "НГ"), ("Теплопровідність", "0.036 Вт/мК")],
    },
    {
        "category": "roof", "brand": "baumit", "name": "Бітумна черепиця Grafit 3м2", "slug": "bitumen-shingle-grafit",
        "sku": "BTS-GRF-3", "price": 1790.0, "old_price": None, "unit": "уп", "icon": "🏚️", "badge": None,
        "is_featured": False, "qty": 64, "min_qty": 20,
        "attrs": [("Площа покриття", "3 м2"), ("Колір", "Графіт"), ("Гарантія", "15 років")],
    },
    {
        "category": "floor", "brand": None, "name": "Ламінат Kronopol 8мм AC4 Дуб", "slug": "kronopol-oak-8",
        "sku": "KRP-OAK-8", "price": 380.0, "old_price": 420.0, "unit": "м2", "icon": "🟫", "badge": "sale",
        "is_featured": True, "qty": 520, "min_qty": 100,
        "attrs": [("Товщина", "8 мм"), ("Клас", "AC4"), ("Замок", "Click")],
    },
    {
        "category": "facade", "brand": "sniezka", "name": "Фарба фасадна Sniezka Extra 10л", "slug": "sniezka-facade-10",
        "sku": "SNZ-FCD-10", "price": 2490.0, "old_price": 2690.0, "unit": "відро", "icon": "🎨", "badge": "sale",
        "is_featured": True, "qty": 36, "min_qty": 12,
        "attrs": [("Основа", "Акрил"), ("Об'єм", "10 л"), ("Покриття", "до 70 м2")],
    },
    {
        "category": "tools", "brand": "bosch", "name": "Перфоратор Bosch GBH 2-26 DRE", "slug": "bosch-gbh-226",
        "sku": "BSH-GBH-226", "price": 4850.0, "old_price": 5200.0, "unit": "шт", "icon": "🔨", "badge": "sale",
        "is_featured": True, "qty": 15, "min_qty": 5,
        "attrs": [("Потужність", "800 Вт"), ("Сила удару", "2.7 Дж"), ("Патрон", "SDS-plus")],
    },
    {
        "category": "tools", "brand": "makita", "name": "Шуруповерт Makita DDF482", "slug": "makita-ddf482",
        "sku": "MKT-DDF482", "price": 6290.0, "old_price": 6790.0, "unit": "шт", "icon": "🪛", "badge": "hit",
        "is_featured": True, "qty": 22, "min_qty": 7,
        "attrs": [("Напруга", "18 В"), ("Акумулятор", "2x2.0 Ah"), ("Крутний момент", "62 Нм")],
    },
    {
        "category": "paint", "brand": "dufa", "name": "Фарба інтер'єрна Dufa Mattlatex 14кг", "slug": "dufa-mattlatex-14",
        "sku": "DUF-MTL-14", "price": 1890.0, "old_price": None, "unit": "відро", "icon": "🖌️", "badge": None,
        "is_featured": False, "qty": 41, "min_qty": 10,
        "attrs": [("Фініш", "Мат"), ("Маса", "14 кг"), ("Призначення", "Стіни/стеля")],
    },
]

# Expand with deterministic generated products.
EXTRA_TEMPLATES = [
    ("cement", "knauf", "Шпаклівка стартова Knauf", "KNF-ST"),
    ("cement", "baumit", "Штукатурка цементна Baumit", "BAU-PL"),
    ("brick", "ceresit", "Клей для газоблоку Ceresit", "CRS-GB"),
    ("insulation", "rockwool", "Плита утеплювача Rockwool", "RCK-PL"),
    ("roof", "bosch", "Саморіз покрівельний Bosch", "BSH-RF"),
    ("floor", "sniezka", "Лак для підлоги Sniezka", "SNZ-FL"),
    ("facade", "dufa", "Штукатурка декоративна Dufa", "DUF-DC"),
    ("tools", "makita", "Болгарка Makita 125мм", "MKT-GR"),
    ("paint", "dufa", "Емаль універсальна Dufa", "DUF-EM"),
]

for i in range(1, 19):
    cat, brand, base_name, sku_prefix = EXTRA_TEMPLATES[(i - 1) % len(EXTRA_TEMPLATES)]
    name = f"{base_name} серія {i:02d}"
    slug = f"{sku_prefix.lower().replace('-', '')}-{i:02d}"
    sku = f"{sku_prefix}-{i:02d}"
    price = float(RNG.randint(120, 5500))
    old_price = price + float(RNG.choice([0, 0, 0, 100, 200, 300]))
    if old_price == price:
        old_price = None
    qty = RNG.randint(8, 600)
    min_qty = max(5, int(qty * 0.15))
    PRODUCTS.append(
        {
            "category": cat,
            "brand": brand,
            "name": name,
            "slug": slug,
            "sku": sku,
            "price": price,
            "old_price": old_price,
            "unit": RNG.choice(["шт", "міш", "відро", "уп"]),
            "icon": RNG.choice(["🧱", "🎨", "🔧", "🏠", "🪣"]),
            "badge": RNG.choice([None, "sale", "new", "hit"]),
            "is_featured": RNG.choice([True, False]),
            "qty": qty,
            "min_qty": min_qty,
            "attrs": [("Серія", f"{i:02d}"), ("Країна", "Україна"), ("Гарантія", "12 міс")],
        }
    )

PROMOS = [
    ("BUD10", "percent", 10.0, 500.0, "10% знижка на перше замовлення"),
    ("SAVE200", "fixed", 200.0, 2000.0, "200 грн знижка від 2000 грн"),
    ("SPRING15", "percent", 15.0, 3000.0, "Весняна акція 15%"),
]


def emit_users(lines: list[str]) -> None:
    for idx, u in enumerate(USERS):
        created = dt(-30 + idx)
        lines.append(
            "INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, created_at, updated_at) "
            f"VALUES ({q(u['email'])}, {q(u['password_hash'])}, {q(u['first_name'])}, {q(u['last_name'])}, {q(u['phone'])}, "
            f"{q(u['role'])}, true, {created}, {created}) "
            "ON CONFLICT (email) DO UPDATE SET "
            "first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone, "
            "role = EXCLUDED.role, is_active = true, updated_at = EXCLUDED.updated_at;"
        )


def emit_categories(lines: list[str]) -> None:
    for name, slug, icon, sort_order in CATEGORIES:
        lines.append(
            "INSERT INTO categories (name, slug, icon, sort_order, is_active, created_at) "
            f"VALUES ({q(name)}, {q(slug)}, {q(icon)}, {sort_order}, true, {dt(-120)}) "
            "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order, is_active = true;"
        )


def emit_brands(lines: list[str]) -> None:
    for name, slug, country in BRANDS:
        lines.append(
            "INSERT INTO brands (name, slug, country, is_active, created_at) "
            f"VALUES ({q(name)}, {q(slug)}, {q(country)}, true, {dt(-150)}) "
            "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country, is_active = true;"
        )


def emit_suppliers(lines: list[str]) -> None:
    for name, contact, phone, terms in SUPPLIERS:
        lines.append(
            "INSERT INTO suppliers (name, contact_name, phone, payment_terms, is_active, created_at) "
            f"SELECT {q(name)}, {q(contact)}, {q(phone)}, {q(terms)}, true, {dt(-90)} "
            f"WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = {q(name)});"
        )


def emit_products(lines: list[str]) -> None:
    for idx, p in enumerate(PRODUCTS, start=1):
        old_price = "NULL" if p["old_price"] is None else str(p["old_price"])
        badge = "NULL" if p["badge"] is None else q(str(p["badge"]))
        brand_ref = "NULL" if p["brand"] is None else f"(SELECT id FROM brands WHERE slug = {q(p['brand'])})"
        created = dt(-60 + idx)
        lines.append(
            "INSERT INTO products (category_id, brand_id, name, slug, sku, description, price, old_price, unit, icon, badge, is_active, is_featured, created_at, updated_at) "
            f"VALUES ((SELECT id FROM categories WHERE slug = {q(p['category'])}), {brand_ref}, {q(p['name'])}, {q(p['slug'])}, {q(p['sku'])}, "
            f"{q('Якісний товар для професійного та приватного будівництва.')}, {p['price']}, {old_price}, {q(p['unit'])}, {q(p['icon'])}, {badge}, true, "
            f"{'true' if p['is_featured'] else 'false'}, {created}, {created}) "
            "ON CONFLICT (sku) DO UPDATE SET "
            "name = EXCLUDED.name, price = EXCLUDED.price, old_price = EXCLUDED.old_price, is_featured = EXCLUDED.is_featured, updated_at = EXCLUDED.updated_at;"
        )

        lines.append(f"DELETE FROM product_attributes WHERE product_id = (SELECT id FROM products WHERE sku = {q(p['sku'])});")
        for order, (key, value) in enumerate(p["attrs"]):
            lines.append(
                "INSERT INTO product_attributes (product_id, key, value, sort_order) "
                f"VALUES ((SELECT id FROM products WHERE sku = {q(p['sku'])}), {q(key)}, {q(value)}, {order});"
            )

        lines.append(f"DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE sku = {q(p['sku'])});")
        image_main = f"https://picsum.photos/seed/{p['slug']}-1/1200/900"
        image_extra = f"https://picsum.photos/seed/{p['slug']}-2/1200/900"
        lines.append(
            "INSERT INTO product_images (product_id, url, alt_text, is_main, sort_order) "
            f"VALUES ((SELECT id FROM products WHERE sku = {q(p['sku'])}), {q(image_main)}, {q(p['name'])}, true, 0);"
        )
        lines.append(
            "INSERT INTO product_images (product_id, url, alt_text, is_main, sort_order) "
            f"VALUES ((SELECT id FROM products WHERE sku = {q(p['sku'])}), {q(image_extra)}, {q(p['name'] + ' (додаткове фото)')}, false, 1);"
        )

        max_qty = max(500, int(p["qty"]) * 3)
        lines.append(
            "INSERT INTO inventory (product_id, quantity, min_quantity, max_quantity, updated_at) "
            f"VALUES ((SELECT id FROM products WHERE sku = {q(p['sku'])}), {int(p['qty'])}, {int(p['min_qty'])}, {max_qty}, {dt(-5)}) "
            "ON CONFLICT (product_id) DO UPDATE SET "
            "quantity = EXCLUDED.quantity, min_quantity = EXCLUDED.min_quantity, max_quantity = EXCLUDED.max_quantity, updated_at = EXCLUDED.updated_at;"
        )


def emit_promos(lines: list[str]) -> None:
    for code, discount_type, value, min_amount, description in PROMOS:
        lines.append(
            "INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_amount, used_count, is_active, created_at) "
            f"VALUES ({q(code)}, {q(description)}, {q(discount_type)}, {value}, {min_amount}, 0, true, {dt(-20)}) "
            "ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, discount_value = EXCLUDED.discount_value, min_order_amount = EXCLUDED.min_order_amount, is_active = true;"
        )


def emit_customer_data(lines: list[str]) -> None:
    customer_emails = [u["email"] for u in USERS if u["role"] == "customer"]
    featured_skus = [p["sku"] for p in PRODUCTS[:12]]

    for idx, email in enumerate(customer_emails, start=1):
        lines.append(
            "INSERT INTO carts (user_id, created_at, updated_at) "
            f"SELECT id, {dt(-idx)}, {dt(-idx)} FROM users u WHERE u.email = {q(email)} "
            "AND NOT EXISTS (SELECT 1 FROM carts c WHERE c.user_id = u.id);"
        )

        sku = featured_skus[idx % len(featured_skus)]
        qty = 1 + (idx % 3)
        lines.append(
            "INSERT INTO cart_items (cart_id, product_id, quantity, added_at) "
            "SELECT c.id, p.id, "
            f"{qty}, {dt(-idx)} FROM carts c JOIN users u ON u.id = c.user_id JOIN products p ON p.sku = {q(sku)} "
            f"WHERE u.email = {q(email)} "
            "AND NOT EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.id AND ci.product_id = p.id);"
        )

    for i, email in enumerate(customer_emails[:10], start=1):
        sku = featured_skus[(i * 2) % len(featured_skus)]
        rating = 5 if i % 3 else 4
        lines.append(
            "INSERT INTO reviews (product_id, user_id, rating, comment, is_approved, created_at) "
            f"VALUES ((SELECT id FROM products WHERE sku = {q(sku)}), (SELECT id FROM users WHERE email = {q(email)}), {rating}, "
            f"{q('Дуже хороший товар. Брав для ремонту, якість відповідає опису.')}, true, {dt(-i)}) "
            "ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, is_approved = true;"
        )

    for i, email in enumerate(customer_emails[:8], start=1):
        sku = featured_skus[(i * 3) % len(featured_skus)]
        lines.append(
            "INSERT INTO wishlists (user_id, product_id, added_at) "
            f"VALUES ((SELECT id FROM users WHERE email = {q(email)}), (SELECT id FROM products WHERE sku = {q(sku)}), {dt(-i)}) "
            "ON CONFLICT (user_id, product_id) DO NOTHING;"
        )

    lines.append(
        "INSERT INTO notifications (user_id, type, title, message, is_read, created_at) "
        f"VALUES ((SELECT id FROM users WHERE email = 'admin@budmart.ua'), 'low_stock', 'Низький запас на складі', {q('Перевірте товари з критичним залишком у модулі складу.')}, false, {dt(-1)}) "
        "ON CONFLICT DO NOTHING;"
    )


def build_sql() -> str:
    lines: list[str] = [
        "-- BuildShop realistic seed for Supabase (PostgreSQL)",
        "-- Generated by scripts/generate_realistic_supabase_seed.py",
        "BEGIN;",
    ]
    emit_users(lines)
    emit_categories(lines)
    emit_brands(lines)
    emit_suppliers(lines)
    emit_products(lines)
    emit_promos(lines)
    emit_customer_data(lines)
    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def main() -> None:
    sql = build_sql()
    OUT_FILE.write_text(sql, encoding="utf-8")
    print(f"Written: {OUT_FILE}")
    print(f"Users: {len(USERS)}")
    print(f"Products: {len(PRODUCTS)}")


if __name__ == "__main__":
    main()


