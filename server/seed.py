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
    Review,
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
        content_manager = User(
            email="content@budmart.ua",
            password_hash=pwd.hash("content123"),
            first_name="Контент",
            last_name="Менеджер",
            phone="+380631234567",
            role=UserRole.content_manager,
        )
        warehouse_manager = User(
            email="warehouse@budmart.ua",
            password_hash=pwd.hash("warehouse123"),
            first_name="Склад",
            last_name="Менеджер",
            phone="+380661234567",
            role=UserRole.warehouse_manager,
        )
        sales_processor = User(
            email="sales@budmart.ua",
            password_hash=pwd.hash("sales123"),
            first_name="Продажі",
            last_name="Менеджер",
            phone="+380681234567",
            role=UserRole.sales_processor,
        )
        customer = User(
            email="ivan@example.com",
            password_hash=pwd.hash("user123"),
            first_name="Іван",
            last_name="Петренко",
            phone="+380501234567",
            role=UserRole.customer,
        )
        db.add_all([admin, manager, content_manager, warehouse_manager, sales_processor, customer])

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
                description="Високоміцний портландцемент для фундаментів, стяжок та конструкцій з підвищеним навантаженням.",
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
                description="Універсальна гіпсова шпаклівка для внутрішніх робіт, формує гладку основу під фарбування.",
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
                description="Класична керамічна цегла для несучих та огороджувальних стін у приватному й комерційному будівництві.",
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
                description="Легкий енергоефективний газоблок для швидкого зведення стін і перегородок.",
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
                description="Теплоізоляційні плити для фасадів та перекриттів з оптимальним співвідношенням щільності і ціни.",
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
                description="Базальтова тепло- і звукоізоляція для вентильованих фасадів, покрівлі та каркасних стін.",
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
                description="Зносостійкий ламінат для житлових та офісних приміщень із стабільною замковою системою.",
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
                description="Декоративна фасадна штукатурка типу короїд з високою стійкістю до вологи та УФ-випромінювання.",
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
                description="Надійний професійний перфоратор для свердління та довбання бетону, цегли й каменю.",
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
                description="Професійна монтажна піна для герметизації швів, отворів та встановлення віконних блоків.",
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
            dict(
                category=cat_roof,
                brand=rockwool,
                name="Мембрана покрівельна супердифузійна 75м²",
                description="Паропроникна мембрана для скатних дахів, захищає утеплювач від вітру і вологи.",
                slug="roof-membrane-75",
                sku="RFM-75-3L",
                price=2650,
                old_price=2890,
                unit="рул",
                icon="🏠",
                badge=ProductBadge.sale,
                is_featured=False,
                qty=37,
                min_qty=10,
                attrs=[("Площа", "75 м²"), ("Шари", "3"), ("Щільність", "110 г/м²")],
            ),
            dict(
                category=cat_roof,
                brand=baumit,
                name="Бітумна черепиця Grafit 3м²",
                description="Гнучка бітумна черепиця для приватних будинків з виразною текстурою і захистом від вигорання.",
                slug="bitumen-shingle-grafit",
                sku="BTS-GRF-3",
                price=1790,
                old_price=None,
                unit="уп",
                icon="🏚️",
                badge=None,
                is_featured=False,
                qty=64,
                min_qty=20,
                attrs=[("Площа покриття", "3 м²"), ("Колір", "Графіт"), ("Гарантія", "15 років")],
            ),
            dict(
                category=cat_roof,
                brand=bosch,
                name="Саморіз покрівельний 4.8×35 (250 шт)",
                description="Оцинковані покрівельні саморізи з EPDM-шайбою для герметичного кріплення профнастилу.",
                slug="roof-screw-48-35-250",
                sku="RSC-4835-250",
                price=410,
                old_price=None,
                unit="кор",
                icon="🔩",
                badge=None,
                is_featured=False,
                qty=112,
                min_qty=40,
                attrs=[("Розмір", "4.8×35 мм"), ("Кількість", "250 шт"), ("Покриття", "Цинк")],
            ),
            dict(
                category=cat_cement,
                brand=ceresit,
                name="Клей для плитки Ceresit CM 11 25кг",
                description="Еластичний клей для керамічної плитки всередині та зовні приміщень.",
                slug="ceresit-cm11-25",
                sku="CRS-CM11-25",
                price=295,
                old_price=330,
                unit="міш",
                icon="🧪",
                badge=ProductBadge.sale,
                is_featured=True,
                qty=96,
                min_qty=25,
                attrs=[("Маса", "25 кг"), ("Час коригування", "20 хв"), ("Основа", "Цементна")],
            ),
            dict(
                category=cat_floor,
                brand=bosch,
                name="Підкладка під ламінат XPS 3мм 10м²",
                description="Щільна підкладка для ламінату, покращує тепло- і шумоізоляцію підлогового покриття.",
                slug="xps-underlay-3mm-10",
                sku="XPS-3-10",
                price=460,
                old_price=None,
                unit="рул",
                icon="📐",
                badge=None,
                is_featured=False,
                qty=73,
                min_qty=20,
                attrs=[("Товщина", "3 мм"), ("Площа", "10 м²"), ("Матеріал", "XPS")],
            ),
            dict(
                category=cat_facade,
                brand=ceresit,
                name="Фарба фасадна силіконова Ceresit CT 48 10л",
                description="Силіконова фасадна фарба з високою паропроникністю та стійкістю до атмосферних впливів.",
                slug="ceresit-ct48-10",
                sku="CRS-CT48-10",
                price=2890,
                old_price=3090,
                unit="відро",
                icon="🪣",
                badge=ProductBadge.sale,
                is_featured=True,
                qty=29,
                min_qty=12,
                attrs=[("Об'єм", "10 л"), ("Основа", "Силікон"), ("Витрата", "0.2 л/м²")],
            ),
            dict(
                category=cat_tools,
                brand=bosch,
                name="Шліфмашина Bosch GWS 750-125",
                description="Компактна кутова шліфмашина для різання металу, плитки та зачистки поверхонь.",
                slug="bosch-gws-750-125",
                sku="BSH-GWS-750",
                price=2590,
                old_price=None,
                unit="шт",
                icon="⚙️",
                badge=ProductBadge.new,
                is_featured=False,
                qty=21,
                min_qty=8,
                attrs=[("Потужність", "750 Вт"), ("Диск", "125 мм"), ("Вага", "1.8 кг")],
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

        db.add_all([
            Review(
                product_id=products[0].id,
                user_id=customer.id,
                rating=5,
                comment="Відмінний цемент, добре тримає міцність після заливки.",
                is_approved=True,
            ),
            Review(
                product_id=products[8].id,
                user_id=manager.id,
                rating=4,
                comment="Надійний інструмент для щоденної роботи на об'єкті.",
                is_approved=True,
            ),
        ])

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
    print("   manager@budmart.ua / manager123 (manager/legacy)")
    print("   content@budmart.ua / content123 (content_manager)")
    print("   warehouse@budmart.ua / warehouse123 (warehouse_manager)")
    print("   sales@budmart.ua / sales123 (sales_processor)")
    print("   ivan@example.com / user123 (customer)")


if __name__ == "__main__":
    run_seed()
