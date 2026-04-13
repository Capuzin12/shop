"""
Початкові дані BuildShop.
Спочатку виконай: python init_db.py --force
Потім: python seed.py   або   python init_db.py --force --seed
"""

from __future__ import annotations

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import engine
from models import (
    Brand,
    Category,
    DiscountType,
    Inventory,
    Product,
    ProductAttribute,
    ProductBadge,
    PromoCode,
    Supplier,
    User,
    UserRole,
    Cart,
    CartItem,
    Notification,
    NotificationType,
)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def run_seed() -> None:
    with Session(engine) as db:
        admin = User(
            email="admin@budmart.ua",
            password_hash=pwd.hash("admin123"),
            first_name="Адміністратор",
            last_name="БудМарт",
            phone="+380441234567",
            role=UserRole.admin,
        )
        manager = User(
            email="manager@budmart.ua",
            password_hash=pwd.hash("manager123"),
            first_name="Менеджер",
            last_name="Склад",
            phone="+380671234567",
            role=UserRole.manager,
        )
        customer = User(
            email="ivan@example.com",
            password_hash=pwd.hash("user123"),
            first_name="Іван",
            last_name="Петренко",
            phone="+380501234567",
            role=UserRole.customer,
        )
        db.add_all([admin, manager, customer])

        cat_cement = Category(name="Цемент і суміші", slug="cement", icon="🧱", sort_order=1)
        cat_brick = Category(name="Цегла та блоки", slug="brick", icon="🏗️", sort_order=2)
        cat_insul = Category(name="Утеплення", slug="insulation", icon="🌡️", sort_order=3)
        cat_roof = Category(name="Покрівля", slug="roof", icon="🏠", sort_order=4)
        cat_floor = Category(name="Підлога", slug="floor", icon="🟫", sort_order=5)
        cat_facade = Category(name="Фасад", slug="facade", icon="🎨", sort_order=6)
        cat_tools = Category(name="Інструменти", slug="tools", icon="🔧", sort_order=7)
        db.add_all(
            [cat_cement, cat_brick, cat_insul, cat_roof, cat_floor, cat_facade, cat_tools]
        )

        knauf = Brand(name="Knauf", slug="knauf", country="Україна")
        baumit = Brand(name="Baumit", slug="baumit", country="Австрія")
        ceresit = Brand(name="Ceresit", slug="ceresit", country="Польща")
        rockwool = Brand(name="Rockwool", slug="rockwool", country="Данія")
        bosch = Brand(name="Bosch", slug="bosch", country="Німеччина")
        db.add_all([knauf, baumit, ceresit, rockwool, bosch])

        sup1 = Supplier(
            name="ТОВ Knauf Україна",
            contact_name="Олексій Мороз",
            phone="+380441234567",
            payment_terms="Нетто 30 днів",
        )
        sup2 = Supplier(
            name="Baumit ТОВ",
            contact_name="Світлана Ткач",
            phone="+380321234567",
            payment_terms="Передоплата 50%",
        )
        sup3 = Supplier(
            name="Ceresit Henkel",
            contact_name="Дмитро Бондар",
            phone="+380671234567",
            payment_terms="Відтермінування 45 днів",
        )
        db.add_all([sup1, sup2, sup3])

        db.flush()

        products_data = [
            dict(
                category=cat_cement,
                brand=knauf,
                name="Цемент Portland М500 50кг",
                slug="cement-m500-50",
                sku="CEM-M500-50",
                price=480,
                old_price=520,
                unit="міш",
                icon="🧱",
                badge=ProductBadge.sale,
                is_featured=True,
                qty=245,
                min_qty=50,
                attrs=[
                    ("Марка", "М500"),
                    ("Маса", "50 кг"),
                    ("Клас міцності", "42.5N"),
                    ("Країна", "Україна"),
                ],
            ),
            dict(
                category=cat_cement,
                brand=knauf,
                name="Шпаклівка Rotband Knauf 25кг",
                slug="rotband-25",
                sku="KNF-ROT-25",
                price=320,
                old_price=None,
                unit="міш",
                icon="🪣",
                badge=None,
                is_featured=True,
                qty=88,
                min_qty=20,
                attrs=[("Тип", "Гіпсова"), ("Маса", "25 кг"), ("Шар нанесення", "5–50 мм")],
            ),
            dict(
                category=cat_brick,
                brand=None,
                name="Цегла керамічна одинарна М150",
                slug="brick-m150",
                sku="BRK-KER-150",
                price=8,
                old_price=None,
                unit="шт",
                icon="🧱",
                badge=None,
                is_featured=False,
                qty=12500,
                min_qty=2000,
                attrs=[
                    ("Марка", "М150"),
                    ("Розмір", "250×120×65 мм"),
                    ("Тип", "Повнотіла"),
                    ("Морозостійкість", "F50"),
                ],
            ),
            dict(
                category=cat_brick,
                brand=baumit,
                name="Газоблок Baumit D500 600×300×200",
                slug="gazoblock-d500",
                sku="GAZ-D500-200",
                price=78,
                old_price=85,
                unit="шт",
                icon="🏗️",
                badge=ProductBadge.sale,
                is_featured=False,
                qty=0,
                min_qty=100,
                attrs=[("Розмір", "600×300×200 мм"), ("Клас", "D500"), ("Міцність", "B2.5")],
            ),
            dict(
                category=cat_insul,
                brand=ceresit,
                name="Пінопласт EPS 70 50мм Ceresit",
                slug="eps-70-50",
                sku="CRS-EPS-50",
                price=520,
                old_price=580,
                unit="лист",
                icon="🌡️",
                badge=ProductBadge.sale,
                is_featured=True,
                qty=8,
                min_qty=30,
                attrs=[("Товщина", "50 мм"), ("Розмір", "1000×1000 мм"), ("Клас горючості", "Г4")],
            ),
            dict(
                category=cat_insul,
                brand=rockwool,
                name="Мінвата Rockwool 100мм (4 шт)",
                slug="rockwool-100",
                sku="RCK-100-4",
                price=1240,
                old_price=None,
                unit="уп",
                icon="🧶",
                badge=ProductBadge.new,
                is_featured=True,
                qty=34,
                min_qty=20,
                attrs=[
                    ("Товщина", "100 мм"),
                    ("Клас горючості", "НГ"),
                    ("Теплопровідність", "0.036 Вт/м·К"),
                ],
            ),
            dict(
                category=cat_floor,
                brand=None,
                name="Ламінат Kronopol 8мм AC4 Дуб",
                slug="kronopol-oak-8",
                sku="KRP-OAK-8",
                price=380,
                old_price=420,
                unit="м²",
                icon="🟫",
                badge=ProductBadge.sale,
                is_featured=True,
                qty=520,
                min_qty=100,
                attrs=[
                    ("Товщина", "8 мм"),
                    ("Клас", "AC4"),
                    ("Декор", "Дуб натуральний"),
                    ("Замок", "Click"),
                ],
            ),
            dict(
                category=cat_facade,
                brand=baumit,
                name="Штукатурка декор. Baumit Kratzputz",
                slug="baumit-kratzputz",
                sku="BAU-KRT-25",
                price=890,
                old_price=950,
                unit="відро",
                icon="🎨",
                badge=ProductBadge.sale,
                is_featured=False,
                qty=42,
                min_qty=15,
                attrs=[("Тип", "Короїд 2мм"), ("Маса", "25кг"), ("Витрата", "3.5 кг/м²")],
            ),
            dict(
                category=cat_tools,
                brand=bosch,
                name="Перфоратор Bosch GBH 2-26 DRE",
                slug="bosch-gbh-226",
                sku="BSH-GBH-226",
                price=4850,
                old_price=5200,
                unit="шт",
                icon="🔨",
                badge=ProductBadge.sale,
                is_featured=True,
                qty=15,
                min_qty=5,
                attrs=[
                    ("Потужність", "800 Вт"),
                    ("Сила удару", "2.7 Дж"),
                    ("Патрон", "SDS-plus"),
                ],
            ),
            dict(
                category=cat_tools,
                brand=ceresit,
                name="Монтажна піна Ceresit TS 61 Pro",
                slug="ceresit-ts61",
                sku="CRS-TS61-750",
                price=185,
                old_price=None,
                unit="шт",
                icon="🫧",
                badge=None,
                is_featured=False,
                qty=4,
                min_qty=20,
                attrs=[("Об'єм", "750 мл"), ("Вихід", "до 45 л"), ("Тип", "Однокомпонентна")],
            ),
        ]

        products = []
        for pd in products_data:
            attrs = pd.pop("attrs")
            qty = pd.pop("qty")
            min_q = pd.pop("min_qty")
            p = Product(**pd)
            db.add(p)
            db.flush()
            products.append(p)
            for i, (k, v) in enumerate(attrs):
                db.add(ProductAttribute(product_id=p.id, key=k, value=v, sort_order=i))
            max_q = max(qty * 3, 500) if qty else 500
            db.add(
                Inventory(
                    product_id=p.id,
                    quantity=qty,
                    min_quantity=min_q,
                    max_quantity=max_q,
                )
            )

        db.add(
            PromoCode(
                code="BUD10",
                discount_type=DiscountType.percent,
                discount_value=10,
                min_order_amount=500,
                description="10% знижка на перше замовлення",
            )
        )
        db.add(
            PromoCode(
                code="SAVE200",
                discount_type=DiscountType.fixed,
                discount_value=200,
                min_order_amount=2000,
                description="200 грн знижка від 2000 грн",
            )
        )

        db.commit()

        # Створити кошик для клієнта
        cart = Cart(user_id=customer.id)
        db.add(cart)
        db.commit()

        cart_item = CartItem(cart_id=cart.id, product_id=products[0].id, quantity=2)
        db.add(cart_item)

        # Створити сповіщення
        notification = Notification(
            user_id=admin.id,
            type=NotificationType.low_stock,
            title="Низький запас товару",
            message="Товар 'Цемент' має низький запас. Рекомендується поповнити."
        )
        db.add(notification)

        db.commit()

    print("БД заповнена тестовими даними.")
    print(f"   Категорій: 7 | Брендів: 5 | Товарів: {len(products_data)} | Промокодів: 2")
    print("   admin@budmart.ua / admin123 (admin)")
    print("   manager@budmart.ua / manager123 (manager)")
    print("   ivan@example.com / user123 (customer)")


if __name__ == "__main__":
    run_seed()
