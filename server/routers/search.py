from typing import Annotated, cast

from fastapi import APIRouter, Depends
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from models import Brand, Category, Inventory, Product, ProductImage
from routers.deps import get_db
from services.search import rank_fuzzy_products

router = APIRouter(tags=["search"])


@router.get("/api/search/suggestions")
def search_suggestions(q: str, db: Annotated[Session, Depends(get_db)]):
    query = (q or "").strip()
    if len(query) < 1:
        return {"products": [], "categories": [], "brands": []}

    search_terms = [term.strip() for term in query.split() if term.strip()]

    product_conditions = []
    category_conditions = []
    brand_conditions = []

    for term in search_terms:
        if ":" in term:
            field, value = term.split(":", 1)
            field = field.lower().strip()
            value = value.strip()

            if field == "brand" and value:
                brand_conditions.append(Brand.name.ilike(f"%{value}%"))
                product_conditions.append(and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{value}%")))
            elif field == "category" and value:
                category_conditions.append(Category.name.ilike(f"%{value}%"))
                product_conditions.append(and_(Product.category_id.isnot(None), Category.name.ilike(f"%{value}%")))
            elif field == "sku" and value:
                product_conditions.append(Product.sku.ilike(f"%{value}%"))
            else:
                product_conditions.append(
                    or_(
                        Product.name.ilike(f"%{term}%"),
                        Product.description.ilike(f"%{term}%"),
                        Product.sku.ilike(f"%{term}%"),
                        and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")),
                        and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%")),
                    )
                )
                category_conditions.append(Category.name.ilike(f"%{term}%"))
                brand_conditions.append(Brand.name.ilike(f"%{term}%"))
        else:
            product_conditions.append(
                or_(
                    Product.name.ilike(f"%{term}%"),
                    Product.description.ilike(f"%{term}%"),
                    Product.sku.ilike(f"%{term}%"),
                    and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")),
                    and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%")),
                )
            )
            category_conditions.append(Category.name.ilike(f"%{term}%"))
            brand_conditions.append(Brand.name.ilike(f"%{term}%"))

    main_image_sq = (
        select(ProductImage.product_id, ProductImage.url)
        .where(ProductImage.is_main == True)
        .distinct(ProductImage.product_id)
        .subquery()
    )

    products_query = (
        select(Product, main_image_sq.c.url.label("image_url"))
        .where(Product.is_active == True)
        .outerjoin(Brand, Product.brand_id == Brand.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .outerjoin(main_image_sq, Product.id == main_image_sq.c.product_id)
    )

    if product_conditions:
        products_query = products_query.where(and_(*product_conditions))

    categories_query = select(Category).where(Category.is_active == True)
    if category_conditions:
        categories_query = categories_query.where(and_(*category_conditions))

    brands_query = select(Brand).where(Brand.is_active == True)
    if brand_conditions:
        brands_query = brands_query.where(and_(*brand_conditions))

    search_mode = "strict"
    image_url_map = {}

    rows = db.execute(
        products_query
        .order_by(Product.is_featured.desc(), Product.name.asc())
        .limit(8)
    ).all()

    products = [row[0] for row in rows]
    image_url_map = {row[0].id: row[1] for row in rows}

    if not products:
        fallback_candidates = db.scalars(
            select(Product)
            .where(Product.is_active == True)
            .outerjoin(Brand, Product.brand_id == Brand.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .limit(500)
        ).all()
        ranked_products = cast(list[tuple[Product, float]], list(rank_fuzzy_products(query, fallback_candidates, limit=8)))
        products = [item[0] for item in ranked_products]
        search_mode = "fuzzy"

        fuzzy_ids = [p.id for p in products]
        fuzzy_images = db.execute(
            select(ProductImage.product_id, ProductImage.url)
            .where(ProductImage.product_id.in_(fuzzy_ids), ProductImage.is_main == True)
        ).all()
        image_url_map = {row[0]: row[1] for row in fuzzy_images}

    product_ids = [product.id for product in products]
    stock_map = {
        product_id: quantity
        for product_id, quantity in db.execute(
            select(Inventory.product_id, Inventory.quantity).where(Inventory.product_id.in_(product_ids))
        ).all()
    }

    categories = db.scalars(
        categories_query
        .order_by(Category.name.asc())
        .limit(5)
    ).all()

    brands = db.scalars(
        brands_query
        .order_by(Brand.name.asc())
        .limit(5)
    ).all()

    return {
        "products": [
            {
                "id": product.id,
                "name": product.name,
                "sku": product.sku,
                "price": product.price,
                "old_price": None,
                "slug": product.slug,
                "description": product.description,
                "quantity": stock_map.get(product.id, 0),
                "brand_name": product.brand.name if product.brand else None,
                "category_name": product.category.name if product.category else None,
                "image_url": image_url_map.get(product.id),
            }
            for product in products
        ],
        "categories": [
            {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
            }
            for category in categories
        ],
        "brands": [
            {
                "id": brand.id,
                "name": brand.name,
                "slug": brand.slug,
            }
            for brand in brands
        ],
        "search_mode": search_mode,
    }