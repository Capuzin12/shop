from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from models import CustomerGroup, PriceHistory, Product, ProductDiscount, ProductPrice, User
from routers.deps import get_current_admin_user, get_db, get_optional_user
from services.helpers import _parse_optional_datetime, _parse_optional_int_field
from services.pricing import resolve_effective_product_price
from services.reporting import build_admin_report_pdf, build_admin_report_xlsx, collect_admin_report_data
from services.serializers import serialize_customer_group

router = APIRouter(tags=["admin"])


@router.get("/api/admin/orders")
def get_admin_orders(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_admin_user),
):
    from routers.orders import _get_orders_fallback_rows, _get_serialized_orders_for_query
    from models import Order
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    try:
        return _get_serialized_orders_for_query(db, query)
    except Exception:
        return _get_orders_fallback_rows(db, current_user)


@router.get("/api/admin/report")
def download_admin_report(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_admin_user),
    format: str = "pdf",
):
    requested_format = str(format or "pdf").strip().lower()
    data = collect_admin_report_data(db)
    if requested_format == "pdf":
        report_content, media_type, ext = build_admin_report_pdf(data), "application/pdf", "pdf"
    elif requested_format == "xlsx":
        report_content, media_type, ext = build_admin_report_xlsx(data), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    else:
        raise HTTPException(status_code=400, detail={"code": "UNSUPPORTED_REPORT_FORMAT", "message": "Підтримуються лише формати pdf та xlsx"})
    filename = f"buildshop_admin_report_{datetime.now().strftime('%Y%m%d_%H%M')}.{ext}"
    return Response(content=report_content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/api/admin/customer-groups")
def get_customer_groups(db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    groups = db.scalars(select(CustomerGroup).options(selectinload(CustomerGroup.users)).order_by(CustomerGroup.id.asc())).all()
    return [serialize_customer_group(group) for group in groups]


@router.get("/api/admin/customer-groups/{group_id}")
def get_customer_group(group_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    group = db.scalar(select(CustomerGroup).where(CustomerGroup.id == group_id).options(selectinload(CustomerGroup.users)))
    if not group:
        raise HTTPException(status_code=404, detail={"code": "CUSTOMER_GROUP_NOT_FOUND", "message": "Групу не знайдено"})
    return serialize_customer_group(group)


@router.post("/api/admin/customer-groups", status_code=status.HTTP_201_CREATED)
def create_customer_group(payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    name = str((payload or {}).get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail={"code": "INVALID_NAME", "message": "Назва обов'язкова"})
    group = CustomerGroup(name=name, description=str((payload or {}).get("description") or "").strip() or None, is_default=bool((payload or {}).get("is_default", False)))
    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "CUSTOMER_GROUP_EXISTS", "message": "Група з такою назвою вже існує"})
    db.refresh(group)
    return serialize_customer_group(group)


@router.put("/api/admin/customer-groups/{group_id}")
def update_customer_group(group_id: int, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    group = db.get(CustomerGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail={"code": "CUSTOMER_GROUP_NOT_FOUND", "message": "Групу не знайдено"})
    if "name" in (payload or {}):
        name = str((payload or {}).get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail={"code": "INVALID_NAME", "message": "Назва обов'язкова"})
        group.name = name
    if "description" in (payload or {}):
        group.description = str((payload or {}).get("description") or "").strip() or None
    if "is_default" in (payload or {}):
        group.is_default = bool((payload or {}).get("is_default"))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "CUSTOMER_GROUP_EXISTS", "message": "Група з такою назвою вже існує"})
    db.refresh(group)
    return serialize_customer_group(group)


@router.delete("/api/admin/customer-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_group(group_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    group = db.scalar(select(CustomerGroup).where(CustomerGroup.id == group_id).options(selectinload(CustomerGroup.users)))
    if not group:
        raise HTTPException(status_code=404, detail={"code": "CUSTOMER_GROUP_NOT_FOUND", "message": "Групу не знайдено"})
    if group.is_default:
        raise HTTPException(status_code=400, detail={"code": "DEFAULT_GROUP_DELETE_FORBIDDEN", "message": "Неможливо видалити дефолтну групу"})
    if group.users:
        raise HTTPException(status_code=400, detail={"code": "GROUP_HAS_USERS", "message": "Неможливо видалити групу з прив'язаними користувачами"})
    db.delete(group)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/admin/products/{product_id}/prices")
def get_product_prices(product_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    rows = db.scalars(select(ProductPrice).where(ProductPrice.product_id == product_id).options(selectinload(ProductPrice.customer_group)).order_by(ProductPrice.customer_group_id.asc(), ProductPrice.min_quantity.asc())).all()
    return [{"id": row.id, "product_id": row.product_id, "customer_group_id": row.customer_group_id, "customer_group_name": row.customer_group.name if row.customer_group else None, "price": row.price, "min_quantity": row.min_quantity, "updated_at": row.updated_at.isoformat() if row.updated_at else None} for row in rows]


@router.post("/api/admin/products/{product_id}/prices", status_code=status.HTTP_201_CREATED)
def upsert_product_price(product_id: int, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    try:
        customer_group_id, min_quantity, price = int((payload or {}).get("customer_group_id")), int((payload or {}).get("min_quantity", 1)), float((payload or {}).get("price"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRICE_PAYLOAD", "message": "Некоректні дані тарифу"})
    if min_quantity < 1 or price < 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRICE_PAYLOAD", "message": "Перевірте price та min_quantity"})
    row = db.scalar(select(ProductPrice).where(
        ProductPrice.product_id == product_id,
        ProductPrice.customer_group_id == customer_group_id,
        ProductPrice.min_quantity == min_quantity
    ))
    if row:
        old_price = float(row.price)
        if old_price != price:
            db.add(PriceHistory(
                product_id=product_id,
                old_price=old_price,
                new_price=price,
                changed_by=current_user.id,
            ))
        row.price = price
    else:
        row = ProductPrice(product_id=product_id, customer_group_id=customer_group_id, min_quantity=min_quantity, price=price)
        db.add(row)
        db.add(PriceHistory(
            product_id=product_id,
            old_price=0.0,
            new_price=price,
            changed_by=current_user.id,
        ))
    db.commit()
    db.refresh(row)
    return {"id": row.id, "product_id": row.product_id, "customer_group_id": row.customer_group_id, "price": row.price, "min_quantity": row.min_quantity, "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.put("/api/admin/products/{product_id}/prices/{price_id}")
def update_product_price(product_id: int, price_id: int, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    row = db.get(ProductPrice, price_id)
    if not row or row.product_id != product_id:
        raise HTTPException(status_code=404, detail={"code": "PRICE_TIER_NOT_FOUND", "message": "Тариф не знайдено"})
    if "customer_group_id" in (payload or {}):
        row.customer_group_id = int((payload or {}).get("customer_group_id"))
    if "min_quantity" in (payload or {}):
        row.min_quantity = int((payload or {}).get("min_quantity"))
    if "price" in (payload or {}):
        row.price = float((payload or {}).get("price"))
    if row.min_quantity < 1 or row.price < 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PRICE_PAYLOAD", "message": "Перевірте price та min_quantity"})
    db.commit()
    db.refresh(row)
    return {"id": row.id, "product_id": row.product_id, "customer_group_id": row.customer_group_id, "price": row.price, "min_quantity": row.min_quantity, "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.delete("/api/admin/products/{product_id}/prices/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_price(product_id: int, price_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    row = db.get(ProductPrice, price_id)
    if not row or row.product_id != product_id:
        raise HTTPException(status_code=404, detail={"code": "PRICE_TIER_NOT_FOUND", "message": "Тариф не знайдено"})
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/admin/products/{product_id}/discounts")
def get_product_discounts(product_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    now = datetime.utcnow()
    discounts = db.scalars(select(ProductDiscount).where(ProductDiscount.product_id == product_id).order_by(ProductDiscount.id.desc())).all()
    return [{"id": d.id, "product_id": d.product_id, "discount_type": d.discount_type, "discount_value": d.discount_value, "start_date": d.start_date.isoformat() if d.start_date else None, "end_date": d.end_date.isoformat() if d.end_date else None, "is_active": d.is_active, "is_currently_active": bool(d.is_active and (d.start_date is None or d.start_date <= now) and (d.end_date is None or d.end_date >= now))} for d in discounts]


@router.post("/api/admin/products/{product_id}/discounts", status_code=status.HTTP_201_CREATED)
def create_product_discount(product_id: int, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Товар не знайдено"})
    discount_type = str((payload or {}).get("discount_type") or "").strip().upper()
    if discount_type not in {"PERCENTAGE", "FIXED_PRICE"}:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DISCOUNT_TYPE", "message": "Допустимі типи: PERCENTAGE, FIXED_PRICE"})
    try:
        discount_value = float((payload or {}).get("discount_value"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_DISCOUNT_VALUE", "message": "Некоректне значення знижки"})
    if discount_value <= 0:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DISCOUNT_VALUE", "message": "Значення знижки має бути > 0"})
    discount = ProductDiscount(product_id=product_id, discount_type=discount_type, discount_value=discount_value, start_date=_parse_optional_datetime((payload or {}).get("start_date")), end_date=_parse_optional_datetime((payload or {}).get("end_date")), is_active=bool((payload or {}).get("is_active", True)))
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return {"id": discount.id, "product_id": discount.product_id, "discount_type": discount.discount_type, "discount_value": discount.discount_value, "start_date": discount.start_date.isoformat() if discount.start_date else None, "end_date": discount.end_date.isoformat() if discount.end_date else None, "is_active": discount.is_active}


@router.put("/api/admin/products/{product_id}/discounts/{discount_id}")
def update_product_discount(product_id: int, discount_id: int, payload: dict, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    discount = db.get(ProductDiscount, discount_id)
    if not discount or discount.product_id != product_id:
        raise HTTPException(status_code=404, detail={"code": "DISCOUNT_NOT_FOUND", "message": "Знижку не знайдено"})
    if "discount_type" in (payload or {}):
        discount_type = str((payload or {}).get("discount_type") or "").strip().upper()
        if discount_type not in {"PERCENTAGE", "FIXED_PRICE"}:
            raise HTTPException(status_code=400, detail={"code": "INVALID_DISCOUNT_TYPE", "message": "Допустимі типи: PERCENTAGE, FIXED_PRICE"})
        discount.discount_type = discount_type
    if "discount_value" in (payload or {}):
        discount.discount_value = float((payload or {}).get("discount_value"))
        if discount.discount_value <= 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_DISCOUNT_VALUE", "message": "Значення знижки має бути > 0"})
    if "start_date" in (payload or {}):
        discount.start_date = _parse_optional_datetime((payload or {}).get("start_date"))
    if "end_date" in (payload or {}):
        discount.end_date = _parse_optional_datetime((payload or {}).get("end_date"))
    if "is_active" in (payload or {}):
        discount.is_active = bool((payload or {}).get("is_active"))
    db.commit()
    db.refresh(discount)
    return {"id": discount.id, "product_id": discount.product_id, "discount_type": discount.discount_type, "discount_value": discount.discount_value, "start_date": discount.start_date.isoformat() if discount.start_date else None, "end_date": discount.end_date.isoformat() if discount.end_date else None, "is_active": discount.is_active}


@router.delete("/api/admin/products/{product_id}/discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_discount(product_id: int, discount_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user)):
    discount = db.get(ProductDiscount, discount_id)
    if not discount or discount.product_id != product_id:
        raise HTTPException(status_code=404, detail={"code": "DISCOUNT_NOT_FOUND", "message": "Знижку не знайдено"})
    db.delete(discount)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/admin/products/{product_id}/price-history")
def get_product_price_history(product_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated = Depends(get_current_admin_user), page: int = 1, per_page: int = 20):
    safe_page, safe_per_page = max(int(page or 1), 1), min(max(int(per_page or 20), 1), 100)
    offset = (safe_page - 1) * safe_per_page
    total = db.scalar(select(func.count()).select_from(PriceHistory).where(PriceHistory.product_id == product_id)) or 0
    rows = db.execute(select(PriceHistory.id, PriceHistory.product_id, Product.name.label("product_name"), PriceHistory.old_price, PriceHistory.new_price, PriceHistory.changed_by, PriceHistory.changed_at, User.first_name, User.last_name).select_from(PriceHistory).outerjoin(Product, Product.id == PriceHistory.product_id).outerjoin(User, User.id == PriceHistory.changed_by).where(PriceHistory.product_id == product_id).order_by(PriceHistory.changed_at.desc()).offset(offset).limit(safe_per_page)).all()
    return {"items": [{"id": row.id, "product_id": row.product_id, "old_price": row.old_price, "new_price": row.new_price, "changed_by": row.changed_by, "changed_by_name": (f"{row.first_name or ''} {row.last_name or ''}").strip() or None, "changed_at": row.changed_at.isoformat() if row.changed_at else None} for row in rows], "total": int(total), "page": safe_page, "per_page": safe_per_page}


@router.get("/api/admin/price-history")
def get_global_price_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated = Depends(get_current_admin_user),
    product_id: str | None = None,
    changed_by: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    per_page: int = 20,
):
    safe_page, safe_per_page = max(int(page or 1), 1), min(max(int(per_page or 20), 1), 100)
    offset = (safe_page - 1) * safe_per_page
    query = select(PriceHistory.id, PriceHistory.product_id, Product.name.label("product_name"), PriceHistory.old_price, PriceHistory.new_price, PriceHistory.changed_by, PriceHistory.changed_at, User.first_name, User.last_name).select_from(PriceHistory).join(Product, Product.id == PriceHistory.product_id).outerjoin(User, User.id == PriceHistory.changed_by)
    count_query = select(func.count()).select_from(PriceHistory)
    filters = []
    parsed_product_id, parsed_changed_by = _parse_optional_int_field(product_id, "product_id"), _parse_optional_int_field(changed_by, "changed_by")
    if parsed_product_id:
        filters.append(PriceHistory.product_id == parsed_product_id)
    if parsed_changed_by:
        filters.append(PriceHistory.changed_by == parsed_changed_by)
    if date_from:
        parsed = _parse_optional_datetime(date_from)
        if parsed:
            filters.append(PriceHistory.changed_at >= parsed)
    if date_to:
        parsed = _parse_optional_datetime(date_to)
        if parsed:
            filters.append(PriceHistory.changed_at <= parsed)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = db.scalar(count_query) or 0
    rows = db.execute(query.order_by(PriceHistory.changed_at.desc()).offset(offset).limit(safe_per_page)).all()
    return {"items": [{"id": row.id, "product_id": row.product_id, "product_name": row.product_name, "old_price": row.old_price, "new_price": row.new_price, "changed_by": row.changed_by, "changed_by_name": (f"{row.first_name or ''} {row.last_name or ''}").strip() or None, "changed_at": row.changed_at.isoformat() if row.changed_at else None} for row in rows], "total": int(total), "page": safe_page, "per_page": safe_per_page}

