from datetime import datetime
from difflib import SequenceMatcher
import re
import unicodedata

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from models import Brand, Category, Inventory, Product, ProductDiscount, ProductImage
from services.pricing import get_presentational_old_price, resolve_effective_product_price


def normalize_search_text(value: str) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", str(value).lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fuzzy_product_score(search_query: str, product: Product) -> float:
    query_norm = normalize_search_text(search_query)
    if not query_norm:
        return 0.0

    parts = [
        normalize_search_text(product.name or ""),
        normalize_search_text(product.sku or ""),
        normalize_search_text(product.brand.name if getattr(product, "brand", None) else ""),
        normalize_search_text(product.category.name if getattr(product, "category", None) else ""),
    ]

    query_tokens = [token for token in query_norm.split(" ") if token]
    best = 0.0
    for part in parts:
        if not part:
            continue
        if query_norm in part:
            best = max(best, 1.0)
            continue
        best = max(best, SequenceMatcher(None, query_norm, part).ratio())
        part_tokens = [token for token in part.split(" ") if token]
        for q in query_tokens:
            token_best = max((SequenceMatcher(None, q, token).ratio() for token in part_tokens), default=0.0)
            best = max(best, token_best)
    return best


def rank_fuzzy_products(search_query: str, products: list[Product], threshold: float = 0.58, limit: int | None = None):
    scored: list[tuple[Product, float]] = []
    for product in products:
        score = fuzzy_product_score(search_query, product)
        if score >= threshold:
            scored.append((product, score))

    scored.sort(key=lambda item: (item[1], item[0].is_featured, item[0].name), reverse=True)
    return scored[:limit] if limit is not None else scored


def search_products_response(
    db: Session,
    current_user,
    *,
    active_only: bool = True,
    category_id: int | None = None,
    search: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    brand_ids: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    page: int = 1,
    limit: int = 12,
):
    safe_page = max(int(page or 1), 1)
    safe_limit = min(max(int(limit or 12), 1), 50)
    query = select(Product)
    if active_only:
        query = query.where(Product.is_active == True)
    search_terms, facet_search_conditions, search_mode, search_hint = [], [], "strict", None
    if search:
        search_terms = [term.strip() for term in search.split() if term.strip()]
        search_conditions = []
        for term in search_terms:
            if ":" in term:
                field, value = term.split(":", 1)
                field, value = field.lower().strip(), value.strip()
                if field == "brand" and value:
                    search_conditions.append(and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{value}%")))
                elif field == "category" and value:
                    search_conditions.append(and_(Product.category_id.isnot(None), Category.name.ilike(f"%{value}%")))
                elif field == "sku" and value:
                    search_conditions.append(Product.sku.ilike(f"%{value}%"))
                elif field == "price" and value:
                    try:
                        if value.startswith("<"):
                            search_conditions.append(Product.price < float(value[1:]))
                        elif value.startswith(">"):
                            search_conditions.append(Product.price > float(value[1:]))
                        elif "-" in value:
                            min_p, max_p = value.split("-", 1)
                            search_conditions.append(and_(Product.price >= float(min_p), Product.price <= float(max_p)))
                        else:
                            search_conditions.append(Product.price == float(value))
                    except ValueError:
                        pass
                else:
                    search_conditions.append(or_(Product.name.ilike(f"%{term}%"), Product.description.ilike(f"%{term}%"), Product.sku.ilike(f"%{term}%"), and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")), and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%"))))
            else:
                search_conditions.append(or_(Product.name.ilike(f"%{term}%"), Product.description.ilike(f"%{term}%"), Product.sku.ilike(f"%{term}%"), and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")), and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%"))))
        if search_conditions:
            query = query.where(and_(*search_conditions))
    query = query.outerjoin(Brand, Product.brand_id == Brand.id).outerjoin(Category, Product.category_id == Category.id)
    if category_id:
        query = query.where(Product.category_id == category_id)
    try:
        parsed_brand_ids = [int(value) for value in brand_ids.split(",") if value.strip()] if brand_ids else []
    except ValueError:
        parsed_brand_ids = []
    if parsed_brand_ids:
        query = query.where(Product.brand_id.in_(parsed_brand_ids))
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    if sort_by == "price":
        order = Product.price.asc() if sort_order == "asc" else Product.price.desc()
    elif sort_by == "newest":
        order = Product.created_at.desc()
    elif sort_by in {"popular", "rating"}:
        order = Product.is_featured.desc()
    elif sort_by == "discount":
        discount_rank = select(func.max(ProductDiscount.discount_value)).where(ProductDiscount.product_id == Product.id, ProductDiscount.is_active == True, or_(ProductDiscount.start_date.is_(None), ProductDiscount.start_date <= datetime.utcnow()), or_(ProductDiscount.end_date.is_(None), ProductDiscount.end_date >= datetime.utcnow())).scalar_subquery()
        order = func.coalesce(discount_rank, 0).desc() if sort_order == "desc" else func.coalesce(discount_rank, 0).asc()
    else:
        order = Product.name.asc() if sort_order == "asc" else Product.name.desc()
    offset = (safe_page - 1) * safe_limit
    products = db.scalars(query.order_by(order).offset(offset).limit(safe_limit)).all()
    if search and total == 0:
        fuzzy_query = select(Product).where(Product.is_active == True).outerjoin(Brand, Product.brand_id == Brand.id).outerjoin(Category, Product.category_id == Category.id)
        if category_id:
            fuzzy_query = fuzzy_query.where(Product.category_id == category_id)
        if parsed_brand_ids:
            fuzzy_query = fuzzy_query.where(Product.brand_id.in_(parsed_brand_ids))
        if min_price is not None:
            fuzzy_query = fuzzy_query.where(Product.price >= min_price)
        if max_price is not None:
            fuzzy_query = fuzzy_query.where(Product.price <= max_price)
        fuzzy_ranked = rank_fuzzy_products(search, db.scalars(fuzzy_query.limit(500)).all())
        total = len(fuzzy_ranked)
        products = [item[0] for item in fuzzy_ranked[offset: offset + safe_limit]]
        search_mode = "fuzzy"
        if fuzzy_ranked:
            search_hint = fuzzy_ranked[0][0].name
    total_pages = (total + safe_limit - 1) // safe_limit if total > 0 else 0
    product_ids = [p.id for p in products]
    inventory_map = {inv.product_id: inv.quantity for inv in db.execute(select(Inventory.product_id, Inventory.quantity).where(Inventory.product_id.in_(product_ids))).all()}
    image_rows = db.execute(select(ProductImage.product_id, ProductImage.url, ProductImage.is_main, ProductImage.sort_order, ProductImage.id).where(ProductImage.product_id.in_(product_ids)).order_by(ProductImage.product_id.asc(), ProductImage.is_main.desc(), ProductImage.sort_order.asc(), ProductImage.id.asc())).all()
    image_map = {}
    for row in image_rows:
        if row.product_id not in image_map and row.url:
            image_map[row.product_id] = row.url
    products_data = []
    for product in products:
        pricing = resolve_effective_product_price(db, product, getattr(current_user, "customer_group_id", None), 1)
        products_data.append({"id": product.id, "name": product.name, "slug": product.slug, "price": product.price, "old_price": get_presentational_old_price(pricing), "effective_price": pricing["effective_price"], "active_discount": pricing["active_discount"], "customer_group_name": pricing["group_name"], "unit": product.unit, "icon": product.icon, "description": product.description, "badge": product.badge.value if product.badge and hasattr(product.badge, "value") else str(product.badge) if product.badge else None, "is_featured": product.is_featured, "is_active": product.is_active, "category_id": product.category_id, "brand_id": product.brand_id, "sku": product.sku, "category_name": product.category.name if product.category else None, "brand_name": product.brand.name if product.brand else None, "quantity": inventory_map.get(product.id, 0), "in_stock": inventory_map.get(product.id, 0) > 0, "image_url": image_map.get(product.id)})
    facets = {}
    brand_facets_query = select(Brand.id, Brand.name, func.count(Product.id)).join(Product, Product.brand_id == Brand.id).where(Product.is_active == True)
    if search:
        facet_search_conditions = []
        for term in search_terms:
            if ":" in term:
                field, value = term.split(":", 1)
                field, value = field.lower().strip(), value.strip()
                if field == "brand" and value:
                    facet_search_conditions.append(Brand.name.ilike(f"%{value}%"))
                elif field == "category" and value:
                    facet_search_conditions.append(Category.name.ilike(f"%{value}%"))
                elif field == "sku" and value:
                    facet_search_conditions.append(Product.sku.ilike(f"%{value}%"))
                else:
                    facet_search_conditions.append(or_(Product.name.ilike(f"%{term}%"), Product.description.ilike(f"%{term}%"), Product.sku.ilike(f"%{term}%"), Brand.name.ilike(f"%{term}%"), Category.name.ilike(f"%{term}%")))
            else:
                facet_search_conditions.append(or_(Product.name.ilike(f"%{term}%"), Product.description.ilike(f"%{term}%"), Product.sku.ilike(f"%{term}%"), Brand.name.ilike(f"%{term}%"), Category.name.ilike(f"%{term}%")))
        if facet_search_conditions:
            brand_facets_query = brand_facets_query.where(and_(*facet_search_conditions))
    brand_facets_query = brand_facets_query.outerjoin(Category, Product.category_id == Category.id)
    if category_id:
        brand_facets_query = brand_facets_query.where(Product.category_id == category_id)
    if min_price is not None:
        brand_facets_query = brand_facets_query.where(Product.price >= min_price)
    if max_price is not None:
        brand_facets_query = brand_facets_query.where(Product.price <= max_price)
    facets["brands"] = [{"id": row[0], "name": row[1], "count": row[2]} for row in db.execute(brand_facets_query.group_by(Brand.id, Brand.name).order_by(Brand.name.asc())).all()]
    category_facets_query = select(Category.id, Category.name, func.count(Product.id)).join(Product, Product.category_id == Category.id).where(Product.is_active == True)
    if search and facet_search_conditions:
        category_facets_query = category_facets_query.where(and_(*facet_search_conditions))
    category_facets_query = category_facets_query.outerjoin(Brand, Product.brand_id == Brand.id)
    if parsed_brand_ids:
        category_facets_query = category_facets_query.where(Product.brand_id.in_(parsed_brand_ids))
    if min_price is not None:
        category_facets_query = category_facets_query.where(Product.price >= min_price)
    if max_price is not None:
        category_facets_query = category_facets_query.where(Product.price <= max_price)
    facets["categories"] = [{"id": row[0], "name": row[1], "count": row[2]} for row in db.execute(category_facets_query.group_by(Category.id, Category.name).order_by(Category.name.asc())).all()]
    price_stats_query = select(func.min(Product.price), func.max(Product.price), func.avg(Product.price)).where(Product.is_active == True)
    if search and facet_search_conditions:
        price_stats_query = price_stats_query.where(and_(*facet_search_conditions))
    if category_id:
        price_stats_query = price_stats_query.where(Product.category_id == category_id)
    if parsed_brand_ids:
        price_stats_query = price_stats_query.where(Product.brand_id.in_(parsed_brand_ids))
    price_stats = db.execute(price_stats_query).first()
    if price_stats:
        facets["price"] = {"min": price_stats[0], "max": price_stats[1], "avg": round(price_stats[2], 2) if price_stats[2] else None}
    availability_query = select(func.sum(case((Inventory.quantity > 0, 1), else_=0)), func.sum(case((Inventory.quantity == 0, 1), else_=0)), func.count(Product.id)).outerjoin(Inventory, Product.id == Inventory.product_id).where(Product.is_active == True)
    if search and facet_search_conditions:
        availability_query = availability_query.where(and_(*facet_search_conditions))
    if category_id:
        availability_query = availability_query.where(Product.category_id == category_id)
    if parsed_brand_ids:
        availability_query = availability_query.where(Product.brand_id.in_(parsed_brand_ids))
    if min_price is not None:
        availability_query = availability_query.where(Product.price >= min_price)
    if max_price is not None:
        availability_query = availability_query.where(Product.price <= max_price)
    availability_stats = db.execute(availability_query).first()
    if availability_stats:
        facets["availability"] = {"in_stock": availability_stats[0] or 0, "out_of_stock": availability_stats[1] or 0, "total": availability_stats[2] or 0}
    return {"products": products_data, "total": total, "page": safe_page, "limit": safe_limit, "total_pages": total_pages, "facets": facets, "search_mode": search_mode, "search_hint": search_hint}

