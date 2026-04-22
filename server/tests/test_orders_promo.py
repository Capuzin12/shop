from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from main import create_order, validate_promo_code
from models import Base, Category, DiscountType, Inventory, Order, Product, PromoCode, User, UserRole


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def seed_customer(db_session):
    user = User(
        email="customer@example.com",
        password_hash="hashed",
        first_name="Test",
        last_name="Customer",
        phone="+380501112233",
        role=UserRole.customer,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def seed_product_with_inventory(db_session, *, price=100.0, stock=20):
    category = Category(name="Будматеріали", slug=f"category-{datetime.utcnow().timestamp()}")
    db_session.add(category)
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Цемент",
        slug=f"cement-{datetime.utcnow().timestamp()}",
        sku=f"SKU-{int(datetime.utcnow().timestamp() * 1000)}",
        price=price,
        is_active=True,
    )
    db_session.add(product)
    db_session.flush()

    inventory = Inventory(product_id=product.id, quantity=stock, min_quantity=1, max_quantity=999)
    db_session.add(inventory)
    db_session.commit()
    db_session.refresh(product)
    return product


def seed_promo(db_session, *, code="BUD10", discount_type=DiscountType.percent, discount_value=10.0, min_order_amount=0.0):
    promo = PromoCode(
        code=code,
        description="Promo for tests",
        discount_type=discount_type,
        discount_value=discount_value,
        min_order_amount=min_order_amount,
        max_uses=10,
        used_count=0,
        valid_from=datetime.utcnow() - timedelta(days=1),
        valid_until=datetime.utcnow() + timedelta(days=1),
        is_active=True,
    )
    db_session.add(promo)
    db_session.commit()
    db_session.refresh(promo)
    return promo


def test_validate_promo_code_success(db_session):
    user = seed_customer(db_session)
    promo = seed_promo(db_session, code="SAVE10", discount_type=DiscountType.percent, discount_value=10.0)

    result = validate_promo_code({"code": "save10", "order_amount": 250}, db_session, user)

    assert result["valid"] is True
    assert result["discount"] == 25.0
    assert result["promo"]["id"] == promo.id

    promo_after = db_session.get(PromoCode, promo.id)
    assert promo_after.used_count == 0


def test_create_order_applies_promo_discount_and_increments_usage(db_session):
    user = seed_customer(db_session)
    product = seed_product_with_inventory(db_session, price=120.0)
    promo = seed_promo(db_session, code="BUD10", discount_type=DiscountType.percent, discount_value=10.0, min_order_amount=100.0)

    payload = {
        "contact_name": "Покупець",
        "contact_phone": "+380501112233",
        "contact_email": "customer@example.com",
        "delivery_city": "Київ",
        "delivery_address": "Хрещатик 1",
        "delivery_method": "nova_poshta",
        "payment_method": "card",
        "promo_code": "bud10",
        "items": [{"product_id": product.id, "quantity": 2}],
    }

    result = create_order(payload, db_session, user)

    assert result["subtotal"] == pytest.approx(240.0)
    assert result["discount"] == pytest.approx(24.0)
    assert result["total"] == pytest.approx(216.0)

    order = db_session.scalar(select(Order).where(Order.id == result["id"]))
    assert order is not None
    assert order.promo_code_id == promo.id

    promo_after = db_session.get(PromoCode, promo.id)
    assert promo_after.used_count == 1


def test_create_order_rejects_invalid_promo_and_does_not_increment_usage(db_session):
    user = seed_customer(db_session)
    product = seed_product_with_inventory(db_session, price=80.0)
    promo = seed_promo(db_session, code="BIGSAVE", discount_type=DiscountType.fixed, discount_value=100.0, min_order_amount=500.0)

    payload = {
        "contact_name": "Покупець",
        "contact_phone": "+380501112233",
        "contact_email": "customer@example.com",
        "delivery_city": "Київ",
        "delivery_address": "Хрещатик 1",
        "delivery_method": "nova_poshta",
        "payment_method": "card",
        "promo_code": "BIGSAVE",
        "items": [{"product_id": product.id, "quantity": 1}],
    }

    with pytest.raises(HTTPException) as exc:
        create_order(payload, db_session, user)

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "PROMO_INVALID"

    promo_after = db_session.get(PromoCode, promo.id)
    assert promo_after.used_count == 0

    orders = db_session.scalars(select(Order)).all()
    assert len(orders) == 0

