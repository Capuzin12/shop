from datetime import datetime, timedelta
from typing import Annotated

import models  # noqa: F401 — реєстрація ORM-моделей
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import func, select, inspect, delete
from sqlalchemy.orm import Session, selectinload

from database import SessionLocal
from models import Category, Product, User, UserRole, Inventory, Brand, Order, OrderItem, Cart, CartItem, Notification, NotificationType, Wishlist

# Auth settings
SECRET_KEY = "your-secret-key-here"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(title="BuildShop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_model(obj, seen=None):
    if seen is None:
        seen = set()
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (datetime,)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [serialize_model(item, seen) for item in obj]
    if isinstance(obj, dict):
        return {key: serialize_model(value, seen) for key, value in obj.items()}
    if id(obj) in seen:
        return None
    seen.add(id(obj))
    if hasattr(obj, '__table__'):
        data = {}
        mapper = inspect(obj)
        for attr in mapper.attrs:
            key = attr.key
            if key.startswith('_') or key == 'password_hash':
                continue
            try:
                value = getattr(obj, key)
            except Exception:
                continue
            data[key] = serialize_model(value, seen)
        return data
    return str(obj)


# Auth functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def authenticate_user(db: Session, email: str, password: str):
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_staff_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


DbSession = Annotated[Session, Depends(get_db)]


@app.post("/token")
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    user = authenticate_user(db, form_data.username, form_data.password)
    print(user);
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/")
def read_root():
    return {
        "message": "BuildShop API",
        "docs": "/docs",
        "hint": "Після init_db + seed доступні лічильники в /api/stats",
    }


@app.get("/api/stats")
def api_stats(db: DbSession):
    categories = db.scalar(select(func.count()).select_from(Category)) or 0
    products = db.scalar(select(func.count()).select_from(Product)) or 0
    orders = db.scalar(select(func.count()).select_from(Order)) or 0
    return {"categories": categories, "products": products, "orders": orders}


# Categories
@app.get("/api/categories")
def get_categories(db: DbSession):
    categories = db.scalars(select(Category).where(Category.is_active == True)).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "icon": c.icon,
            "sort_order": c.sort_order,
        }
        for c in categories
    ]


@app.post("/api/categories")
def create_category(category: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    new_category = Category(**category)
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@app.put("/api/categories/{category_id}")
def update_category(category_id: int, category: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    db_category = db.get(Category, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in category.items():
        setattr(db_category, key, value)
    db.commit()
    db.refresh(db_category)
    return db_category


@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    db_category = db.get(Category, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(db_category)
    db.commit()
    return {"message": "Category deleted"}


# Products
from sqlalchemy import or_, and_


@app.get("/api/products")
def get_products(
    db: DbSession,
    category_id: int | None = None,
    search: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    page: int = 1,
    limit: int = 12
):
    query = select(Product)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if search:
        query = query.where(or_(Product.name.ilike(f"%{search}%"), Product.description.ilike(f"%{search}%")))
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)

    # Get total count for pagination
    count_query = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_query)

    # Apply sorting and pagination
    if sort_by == "price":
        order = Product.price.asc() if sort_order == "asc" else Product.price.desc()
    else:
        order = Product.name.asc() if sort_order == "asc" else Product.name.desc()

    offset = (page - 1) * limit
    query = query.order_by(order).offset(offset).limit(limit)
    products = db.scalars(query).all()

    total_pages = (total + limit - 1) // limit if total > 0 else 0

    # Simple serialization for API response
    products_data = [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "price": p.price,
            "old_price": p.old_price,
            "unit": p.unit,
            "icon": p.icon,
            "badge": p.badge,
            "is_featured": p.is_featured,
            "category_id": p.category_id,
            "brand_id": p.brand_id,
            "sku": p.sku,
        }
        for p in products
    ]

    return {
        "products": products_data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }


@app.get("/api/products/{product_id}")
def get_product(product_id: int, db: DbSession):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "price": product.price,
        "old_price": product.old_price,
        "unit": product.unit,
        "icon": product.icon,
        "badge": product.badge,
        "is_featured": product.is_featured,
        "category_id": product.category_id,
        "brand_id": product.brand_id,
        "sku": product.sku,
        "description": product.description,
    }


@app.post("/api/products")
def create_product(product: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    new_product = Product(**product)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return serialize_model(new_product)


@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    db_product = db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product.items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return serialize_model(db_product)


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    db_product = db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted"}


# Inventory
@app.get("/api/inventory")
def get_inventory(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    inventory_items = db.scalars(select(Inventory).options(selectinload(Inventory.product))).all()
    result = []
    for item in inventory_items:
        product = item.product
        result.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": product.name if product else "Unknown",
            "quantity": item.quantity,
            "min_quantity": item.min_quantity,
            "max_quantity": item.max_quantity,
            "location": item.location,
            "min_quantity_alert": item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None
        })
    return result


@app.put("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, inventory_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_staff_user)]):
    db_inventory = db.get(Inventory, inventory_id)
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    old_quantity = db_inventory.quantity
    for key, value in inventory_data.items():
        setattr(db_inventory, key, value)
    db.commit()
    db.refresh(db_inventory)
    
    if 'quantity' in inventory_data:
        min_alert = db_inventory.min_quantity_alert or db_inventory.min_quantity
        if old_quantity >= min_alert and db_inventory.quantity < min_alert:
            admins = db.scalars(select(User).where(User.role == UserRole.admin)).all()
            for admin in admins:
                notification = Notification(
                    user_id=admin.id,
                    type=NotificationType.low_stock,
                    title=f"Низький запас товару",
                    message=f"Товар '{db_inventory.product.name}' має низький запас: {db_inventory.quantity} од. (мін. {db_inventory.min_quantity})"
                )
                db.add(notification)
            db.commit()
    
    return serialize_model(db_inventory)


# Orders
@app.get("/api/orders")
def get_orders(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role == UserRole.admin:
        orders = db.scalars(select(Order)).all()
    else:
        orders = db.scalars(select(Order).where(Order.user_id == current_user.id)).all()
    return serialize_model(orders)


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role != UserRole.admin and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return serialize_model(order)


@app.post("/api/orders")
def create_order(order_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    items_data = order_data.pop("items", [])
    if not items_data:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    try:
        order = Order(user_id=current_user.id, **order_data)
        db.add(order)
        db.flush()

        subtotal = 0.0
        for item in items_data:
            product_id = item.get("product_id")
            quantity = int(item.get("quantity", 0))
            if not product_id or quantity <= 0:
                raise HTTPException(status_code=400, detail="Each item must contain valid product_id and quantity")

            product = db.get(Product, product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

            inventory = db.scalar(select(Inventory).where(Inventory.product_id == product_id))
            available_quantity = inventory.quantity if inventory else 0
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not enough stock for product '{product.name}'"
                )

            unit_price = float(product.price)
            subtotal += unit_price * quantity
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    product_sku=product.sku,
                    quantity=quantity,
                    unit_price=unit_price,
                )
            )

        delivery_cost = float(order.delivery_cost or 0)
        discount = float(order.discount or 0)
        order.subtotal = subtotal
        order.total = max(subtotal + delivery_cost - discount, 0)

        db.commit()
        db.refresh(order)
        return serialize_model(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@app.put("/api/orders/{order_id}")
def update_order(order_id: int, order_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    db_order = db.get(Order, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = db_order.status
    for key, value in order_data.items():
        setattr(db_order, key, value)
    db.commit()
    db.refresh(db_order)
    
    if 'status' in order_data and old_status != order_data['status']:
        notification = Notification(
            user_id=db_order.user_id,
            type=NotificationType.order_status,
            title=f"Статус замовлення #{db_order.id} змінено",
            message=f"Ваше замовлення #{db_order.id} змінило статус з '{old_status.value}' на '{db_order.status.value}'"
        )
        db.add(notification)
        db.commit()
    
    return serialize_model(db_order)


# Users (admin only)
@app.get("/api/users")
def get_users(db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    users = db.scalars(select(User)).all()
    return serialize_model(users)


@app.get("/api/me")
def get_current_user_info(current_user: Annotated[User, Depends(get_current_active_user)]):
    return serialize_model(current_user)


@app.post("/api/users")
def create_user(user: dict, db: DbSession):
    if 'password' not in user:
        raise HTTPException(status_code=400, detail="Password required")
    user_data = user.copy()
    user_data['password_hash'] = get_password_hash(user_data.pop('password'))
    user_data['role'] = UserRole.customer
    user_data['is_active'] = True
    new_user = User(**user_data)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "user": {"email": new_user.email, "first_name": new_user.first_name}}


@app.put("/api/users/{user_id}")
def update_user(user_id: int, user_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    db_user = db.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in user_data.items():
        if key == "password":
            value = get_password_hash(value)
            key = "password_hash"
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user


# Cart
@app.get("/api/cart")
def get_cart(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    cart = db.scalar(select(Cart).where(Cart.user_id == current_user.id))
    if not cart:
        cart = Cart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return {
        "id": cart.id,
        "user_id": cart.user_id,
        "items": [
            {
                "id": ci.id,
                "cart_id": ci.cart_id,
                "product_id": ci.product_id,
                "quantity": ci.quantity,
                "product": {
                    "id": ci.product.id,
                    "name": ci.product.name,
                    "price": ci.product.price,
                    "sku": ci.product.sku,
                    "slug": ci.product.slug
                } if ci.product else None,
                "added_at": ci.added_at.isoformat() if ci.added_at else None
            }
            for ci in cart.items
        ] if cart.items else [],
        "created_at": cart.created_at.isoformat() if cart.created_at else None,
        "updated_at": cart.updated_at.isoformat() if cart.updated_at else None
    }


@app.post("/api/cart/items")
def add_to_cart(item: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    cart = db.scalar(select(Cart).where(Cart.user_id == current_user.id))
    if not cart:
        cart = Cart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    
    existing_item = db.scalar(select(CartItem).where(CartItem.cart_id == cart.id, CartItem.product_id == item["product_id"]))
    if existing_item:
        existing_item.quantity += item["quantity"]
    else:
        cart_item = CartItem(cart_id=cart.id, **item)
        db.add(cart_item)
    db.commit()
    return {"message": "Item added to cart"}


@app.put("/api/cart/items/{item_id}")
def update_cart_item(item_id: int, item_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    cart_item = db.get(CartItem, item_id)
    if not cart_item or cart_item.cart.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    quantity = int(item_data.get("quantity", 0))
    if quantity <= 0:
        db.delete(cart_item)
    else:
        cart_item.quantity = quantity
    db.commit()
    return {"message": "Cart updated"}


@app.delete("/api/cart/items/{item_id}")
def remove_cart_item(item_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    cart_item = db.get(CartItem, item_id)
    if not cart_item or cart_item.cart.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(cart_item)
    db.commit()
    return {"message": "Item removed from cart"}


# Wishlist
@app.get("/api/wishlist")
def get_wishlist(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    wishlist_items = db.scalars(
        select(Wishlist)
        .where(Wishlist.user_id == current_user.id)
        .options(selectinload(Wishlist.product))
    ).all()
    return [
        {
            "id": w.id,
            "user_id": w.user_id,
            "product_id": w.product_id,
            "product": {
                "id": w.product.id,
                "name": w.product.name,
                "price": w.product.price,
                "old_price": w.product.old_price,
                "sku": w.product.sku,
                "slug": w.product.slug,
                "badge": w.product.badge.value if w.product.badge and hasattr(w.product.badge, 'value') else str(w.product.badge) if w.product.badge else None
            } if w.product else None,
            "added_at": w.added_at.isoformat() if w.added_at else None
        }
        for w in wishlist_items
    ]


@app.post("/api/wishlist")
def add_to_wishlist(item_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    product_id = item_data.get("product_id")
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required")
    # Check if product exists
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if already in wishlist
    existing = db.scalar(
        select(Wishlist)
        .where(Wishlist.user_id == current_user.id, Wishlist.product_id == product_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Product already in wishlist")
    
    wishlist_item = Wishlist(user_id=current_user.id, product_id=product_id)
    db.add(wishlist_item)
    db.commit()
    return {"message": "Product added to wishlist"}


@app.delete("/api/wishlist/{product_id}")
def remove_from_wishlist(product_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    wishlist_item = db.scalar(
        select(Wishlist)
        .where(Wishlist.user_id == current_user.id, Wishlist.product_id == product_id)
    )
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Product not in wishlist")
    
    db.delete(wishlist_item)
    db.commit()
    return {"message": "Product removed from wishlist"}


# Notifications
@app.get("/api/notifications")
def get_notifications(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    notifications = db.scalars(select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())).all()
    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "type": n.type.value if hasattr(n.type, 'value') else str(n.type),
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifications
    ]


@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    notification = db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}


def check_low_stock_notifications(db: Session):
    """Перевірка та створення повідомлень про низький запас для менеджерів та адмінів"""
    inventory_items = db.scalars(select(Inventory).options(selectinload(Inventory.product))).all()
    staff_users = db.scalars(
        select(User).where(User.role.in_([UserRole.admin, UserRole.manager]))
    ).all()
    
    if not staff_users:
        return 0
    
    for staff_user in staff_users:
        db.execute(delete(Notification).where(
            Notification.type == NotificationType.low_stock,
            Notification.user_id == staff_user.id,
            Notification.is_read == False
        ))
    
    low_stock_items = []
    for item in inventory_items:
        min_alert = item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity
        if item.quantity < min_alert:
            low_stock_items.append(item)
    
    for staff_user in staff_users:
        for item in low_stock_items:
            min_alert = item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity
            notification = Notification(
                user_id=staff_user.id,
                type=NotificationType.low_stock,
                title=f"⚠️ Низький запас товару",
                message=f"Товар '{item.product.name}': {item.quantity} од. (мін. {min_alert}, макс. {item.max_quantity})"
            )
            db.add(notification)
    
    db.commit()
    return len(low_stock_items)


@app.get("/api/notifications/check-low-stock")
def check_low_stock(db: DbSession, current_user: Annotated[User, Depends(get_current_staff_user)]):
    """Примусова перевірка низького запасу"""
    count = check_low_stock_notifications(db)
    return {"message": f"Перевірку выполнено. Знайдено {count} товарів з низьким запасом", "count": count}


if __name__ == "__main__":
    from database import SessionLocal
    db = SessionLocal()
    try:
        check_low_stock_notifications(db)
    finally:
        db.close()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
