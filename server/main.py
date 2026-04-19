from datetime import datetime, timedelta
from difflib import SequenceMatcher
import os
import re
from typing import Annotated
import unicodedata

import models  # noqa: F401 — реєстрація ORM-моделей
from fastapi import Depends, FastAPI, HTTPException, Response, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import func, select, inspect, delete, case, text
from sqlalchemy.orm import Session, selectinload

from database import SessionLocal
from models import Category, Product, User, UserRole, Inventory, Brand, Order, OrderItem, Cart, CartItem, Notification, NotificationType, Wishlist, DeliveryMethod, PaymentMethod, InventoryMovement, MovementType, ProductAttribute, Review, OrderStatus, OrderMessage, AuditLog, ClientError
from logging_config import configure_logging, get_logger, set_request_id, set_user_id, get_request_id, generate_request_id
from config import settings, validate_settings
from security import add_request_id_middleware, add_security_headers_middleware, add_timing_middleware, limiter
from errors import log_error

# Validate settings on startup
validate_settings()

# Configure logging
logger = get_logger(__name__)
configure_logging(debug=settings.debug)

logger.info('BuildShop API starting', extra={'environment': settings.environment, 'debug': settings.debug})

# Auth settings
SECRET_KEY = settings.secret_key
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.jwt_access_ttl_min
CORS_ORIGINS = settings.get_cors_origins()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

app = FastAPI(title="BuildShop API")
app.state.limiter = limiter

_schema_patched = False


def ensure_runtime_schema(db: Session):
    """Best-effort lightweight patch for older app.db without latest notification columns."""
    global _schema_patched
    if _schema_patched:
        return

    table_info = db.execute(text("PRAGMA table_info(notifications)")).all()
    existing_columns = {row[1] for row in table_info}
    statements = []
    if "target_path" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_path TEXT")
    if "target_product_id" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_product_id INTEGER")
    if "target_inventory_id" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_inventory_id INTEGER")
    if "target_order_id" not in existing_columns:
        statements.append("ALTER TABLE notifications ADD COLUMN target_order_id INTEGER")

    if statements:
        for sql in statements:
            db.execute(text(sql))
        db.commit()

    table_info = db.execute(text("PRAGMA table_info(client_errors)")).all()
    if not table_info:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS client_errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                path TEXT,
                message TEXT NOT NULL,
                stack TEXT,
                component_stack TEXT,
                request_id TEXT,
                user_agent TEXT,
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON client_errors(created_at)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_client_errors_user_id ON client_errors(user_id)"))
        db.commit()

    _schema_patched = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware in reverse order (last added = first executed)
app.middleware('http')(add_timing_middleware)
app.middleware('http')(add_security_headers_middleware)
app.middleware('http')(add_request_id_middleware)



@app.get("/health/live")
def health_live():
    return {"status": "ok", "service": "buildshop-api"}


@app.get("/health/ready")
def health_ready(response: Response):
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "database": "error"}
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        ensure_runtime_schema(db)
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
    # Handle enums
    if hasattr(obj, 'value') and hasattr(obj, 'name'):
        return obj.value
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


def serialize_order_summary(order: Order):
    return {
        "id": order.id,
        "user_id": order.user_id,
        "contact_name": order.contact_name,
        "contact_phone": order.contact_phone,
        "contact_email": order.contact_email,
        "delivery_city": order.delivery_city,
        "delivery_address": order.delivery_address,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "subtotal": order.subtotal,
        "delivery_cost": order.delivery_cost,
        "discount": order.discount,
        "total": order.total,
        "delivery_method": order.delivery_method.value if hasattr(order.delivery_method, "value") else order.delivery_method,
        "payment_method": order.payment_method.value if hasattr(order.payment_method, "value") else order.payment_method,
        "payment_status": order.payment_status.value if hasattr(order.payment_status, "value") else order.payment_status,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "product_sku": item.product_sku,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
            }
            for item in (order.items or [])
        ],
    }


def get_order_status_ua(status_value: str) -> str:
    status_map = {
        "new": "Нове",
        "processing": "В обробці",
        "shipped": "Відправлено",
        "delivered": "Доставлено",
        "picked_up": "Забрано",
        "cancelled": "Скасовано",
        "refunded": "Повернено",
    }
    return status_map.get(status_value, status_value)


def create_low_stock_notifications(
    db: Session,
    inventory_items: list[Inventory],
    recipient_roles: list[UserRole] | None = None,
) -> int:
    """Create unread low-stock notifications with deep-link metadata."""
    if recipient_roles is None:
        recipient_roles = [UserRole.admin]

    valid_items = [item for item in (inventory_items or []) if item and item.product]
    low_stock_items: list[Inventory] = []
    for item in valid_items:
        min_alert = item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity
        if int(item.quantity or 0) < int(min_alert or 0):
            low_stock_items.append(item)

    if not low_stock_items:
        return 0

    recipients = db.scalars(
        select(User).where(User.role.in_(recipient_roles), User.is_active == True)
    ).all()
    if not recipients:
        return 0

    created = 0
    for recipient in recipients:
        for item in low_stock_items:
            min_alert = item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity
            db.execute(
                delete(Notification).where(
                    Notification.user_id == recipient.id,
                    Notification.type == NotificationType.low_stock,
                    Notification.target_product_id == item.product_id,
                    Notification.is_read == False,
                )
            )
            db.add(Notification(
                user_id=recipient.id,
                type=NotificationType.low_stock,
                title="Низький запас товару",
                message=f"Товар '{item.product.name}' має низький запас: {item.quantity} од. (мін. {min_alert}, макс. {item.max_quantity})",
                target_path="/admin/inventory",
                target_product_id=item.product_id,
                target_inventory_id=item.id,
            ))
            created += 1
    return created


ORDER_STATUS_FLOW: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.new: {OrderStatus.processing, OrderStatus.cancelled},
    OrderStatus.processing: {OrderStatus.shipped, OrderStatus.cancelled},
    OrderStatus.shipped: {OrderStatus.delivered, OrderStatus.picked_up},
    OrderStatus.delivered: {OrderStatus.refunded},
    OrderStatus.picked_up: {OrderStatus.refunded},
    OrderStatus.cancelled: set(),
    OrderStatus.refunded: set(),
}


def parse_order_status(value) -> OrderStatus:
    if isinstance(value, OrderStatus):
        return value
    try:
        return OrderStatus(str(value))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid order status")


def ensure_status_transition_allowed(old_status: OrderStatus, new_status: OrderStatus):
    if old_status == new_status:
        return
    allowed_next = ORDER_STATUS_FLOW.get(old_status, set())
    if new_status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_STATUS_TRANSITION",
                "message": f"Перехід зі статусу '{old_status.value}' у '{new_status.value}' неможливий",
            },
        )


def restock_order_items(db: Session, order: Order, note_prefix: str = "Повернення на склад"):
    for item in order.items or []:
        if not item.product_id:
            continue
        inventory = db.scalar(select(Inventory).where(Inventory.product_id == item.product_id))
        if not inventory:
            inventory = Inventory(product_id=item.product_id, quantity=0, min_quantity=0, max_quantity=9999)
            db.add(inventory)
            db.flush()

        quantity_before = int(inventory.quantity or 0)
        inventory.quantity = quantity_before + int(item.quantity or 0)
        quantity_after = inventory.quantity
        db.add(inventory)
        db.add(
            InventoryMovement(
                product_id=item.product_id,
                order_id=order.id,
                type=MovementType.return_,
                quantity=int(item.quantity or 0),
                quantity_before=quantity_before,
                quantity_after=quantity_after,
                note=f"{note_prefix}: замовлення #{order.id}",
            )
        )


def serialize_order_message(message: OrderMessage):
    sender_role = message.sender.role.value if message.sender and hasattr(message.sender.role, "value") else None
    return {
        "id": message.id,
        "order_id": message.order_id,
        "sender_id": message.sender_id,
        "is_from_staff": message.is_from_staff,
        "body": message.body,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "sender": {
            "id": message.sender.id,
            "first_name": message.sender.first_name,
            "last_name": message.sender.last_name,
            "role": sender_role,
        } if message.sender else None,
    }


def can_user_review_product(db: Session, user_id: int, product_id: int) -> bool:
    delivered_count = db.scalar(
        select(func.count())
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.user_id == user_id,
            OrderItem.product_id == product_id,
            Order.status.in_([OrderStatus.delivered, OrderStatus.picked_up]),
        )
    ) or 0
    return delivered_count > 0


def resolve_notification_target_path(notification: Notification, current_user: User) -> str:
    """Ensure every notification has an actionable target path."""
    if notification.target_path:
        return notification.target_path

    role = current_user.role
    notif_type = notification.type.value if hasattr(notification.type, "value") else str(notification.type)

    if notification.target_order_id:
        return "/manager?tab=orders" if can_manage_sales(role) else "/profile"

    if notification.target_inventory_id or notification.target_product_id:
        if can_manage_warehouse(role):
            return "/admin/inventory" if role == UserRole.admin else "/manager"
        if can_manage_catalog(role):
            return "/admin/products"
        return "/catalog"

    if notif_type == NotificationType.order_status.value:
        return "/manager?tab=orders" if can_manage_sales(role) else "/profile"
    if notif_type in (NotificationType.low_stock.value, NotificationType.supply_arrival.value):
        if can_manage_warehouse(role):
            return "/admin/inventory" if role == UserRole.admin else "/manager"
        return "/catalog"

    return "/notifications"


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


async def get_optional_user(token: Annotated[str | None, Depends(oauth2_optional_scheme)], db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    email: str | None = payload.get("sub")
    if not email:
        return None
    return db.scalar(select(User).where(User.email == email))


async def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


def can_manage_catalog(role: UserRole) -> bool:
    return role in (UserRole.admin, UserRole.content_manager, UserRole.manager)


def can_manage_warehouse(role: UserRole) -> bool:
    return role in (UserRole.admin, UserRole.warehouse_manager, UserRole.manager)


def can_manage_sales(role: UserRole) -> bool:
    return role in (UserRole.admin, UserRole.sales_processor, UserRole.manager)


async def get_current_staff_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role not in (
        UserRole.admin,
        UserRole.manager,
        UserRole.content_manager,
        UserRole.warehouse_manager,
        UserRole.sales_processor,
    ):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_catalog_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if not can_manage_catalog(current_user.role):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_warehouse_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if not can_manage_warehouse(current_user.role):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_sales_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if not can_manage_sales(current_user.role):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


DbSession = Annotated[Session, Depends(get_db)]


@app.get("/api/feature-flags")
def get_feature_flags(current_user: Annotated[User | None, Depends(get_optional_user)] = None):
    is_staff = bool(current_user and current_user.role in {
        UserRole.admin,
        UserRole.manager,
        UserRole.content_manager,
        UserRole.sales_processor,
        UserRole.warehouse_manager,
    })
    return {
        "flags": {
            "experimentalCatalogSuggestions": True,
            "enhancedErrorReporting": True,
            "apiRetryFor5xx": True,
            "staffDiagnosticsPanel": is_staff,
        }
    }


@app.post("/api/errors", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def create_client_error(
    request: Request,
    payload: dict,
    db: DbSession,
    current_user: Annotated[User | None, Depends(get_optional_user)] = None,
):
    message = str((payload or {}).get("message") or "").strip()
    if len(message) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CLIENT_ERROR", "message": "Повідомлення помилки занадто коротке"},
        )

    client_error = ClientError(
        user_id=current_user.id if current_user else None,
        path=str((payload or {}).get("path") or "")[:255],
        message=message[:500],
        stack=str((payload or {}).get("stack") or "")[:8000],
        component_stack=str((payload or {}).get("component_stack") or "")[:8000],
        request_id=str((payload or {}).get("request_id") or get_request_id() or "")[:64],
        user_agent=str((payload or {}).get("user_agent") or request.headers.get("user-agent") or "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(client_error)
    db.commit()
    db.refresh(client_error)

    short_code = f"FE-{client_error.id:06d}"
    logger.warning(
        "Client UI error captured",
        extra={
            "client_error_id": client_error.id,
            "error_code": short_code,
            "path": client_error.path,
            "request_id": client_error.request_id,
            "user_id": current_user.id if current_user else None,
        },
    )

    return {
        "ok": True,
        "error_code": short_code,
        "id": client_error.id,
    }


@app.post("/token")
@limiter.limit("5/minute")
async def login_for_access_token(request: Request, form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f'Failed login attempt for {form_data.username}', extra={'username': form_data.username})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Set user_id in logging context
    if user:
        set_user_id(user.id)
        logger.info(f'User {user.email} logged in', extra={'user_id': user.id, 'email': user.email})
    
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
def create_category(category: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_catalog_user)]):
    new_category = Category(**category)
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@app.put("/api/categories/{category_id}")
def update_category(category_id: int, category: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_catalog_user)]):
    db_category = db.get(Category, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in category.items():
        setattr(db_category, key, value)
    db.commit()
    db.refresh(db_category)
    return db_category


@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_catalog_user)]):
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
    brand_ids: str | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    page: int = 1,
    limit: int = 12
 ):
    from sqlalchemy import or_, and_, func
    
    query = select(Product).where(Product.is_active == True)
    search_terms = []
    facet_search_conditions = []
    search_mode = "strict"
    search_hint = None
    
    # Advanced search logic
    if search:
        search_terms = [term.strip() for term in search.split() if term.strip()]
        search_conditions = []
        
        for term in search_terms:
            # Check for field-specific searches like "brand:bosch" or "category:tools"
            if ":" in term:
                field, value = term.split(":", 1)
                field = field.lower().strip()
                value = value.strip()
                
                if field == "brand" and value:
                    # Search in brand name
                    search_conditions.append(
                        and_(
                            Product.brand_id.isnot(None),
                            Brand.name.ilike(f"%{value}%")
                        )
                    )
                elif field == "category" and value:
                    # Search in category name
                    search_conditions.append(
                        and_(
                            Product.category_id.isnot(None),
                            Category.name.ilike(f"%{value}%")
                        )
                    )
                elif field == "sku" and value:
                    search_conditions.append(Product.sku.ilike(f"%{value}%"))
                elif field == "price" and value:
                    # Handle price ranges like "price:<100" or "price:50-200"
                    if value.startswith("<"):
                        try:
                            max_p = float(value[1:])
                            search_conditions.append(Product.price < max_p)
                        except ValueError:
                            pass
                    elif value.startswith(">"):
                        try:
                            min_p = float(value[1:])
                            search_conditions.append(Product.price > min_p)
                        except ValueError:
                            pass
                    elif "-" in value:
                        try:
                            min_p, max_p = value.split("-", 1)
                            min_p, max_p = float(min_p), float(max_p)
                            search_conditions.append(and_(Product.price >= min_p, Product.price <= max_p))
                        except ValueError:
                            pass
                    else:
                        try:
                            exact_price = float(value)
                            search_conditions.append(Product.price == exact_price)
                        except ValueError:
                            pass
                else:
                    # Unknown field prefix, treat as general search
                    search_conditions.append(
                        or_(
                            Product.name.ilike(f"%{term}%"),
                            Product.description.ilike(f"%{term}%"),
                            Product.sku.ilike(f"%{term}%"),
                            and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")),
                            and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%"))
                        )
                    )
            else:
                # General search term
                search_conditions.append(
                    or_(
                        Product.name.ilike(f"%{term}%"),
                        Product.description.ilike(f"%{term}%"),
                        Product.sku.ilike(f"%{term}%"),
                        and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")),
                        and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%"))
                    )
                )
        
        if search_conditions:
            query = query.where(and_(*search_conditions))
    
    # Join with Brand and Category for search and facets
    query = query.outerjoin(Brand, Product.brand_id == Brand.id).outerjoin(Category, Product.category_id == Category.id)
    
    if category_id:
        query = query.where(Product.category_id == category_id)
    
    parsed_brand_ids: list[int] = []
    if brand_ids:
        try:
            parsed_brand_ids = [int(value) for value in brand_ids.split(",") if value.strip()]
        except ValueError:
            parsed_brand_ids = []
    if parsed_brand_ids:
        query = query.where(Product.brand_id.in_(parsed_brand_ids))
    
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
    elif sort_by == "newest":
        order = Product.created_at.desc()
    elif sort_by == "popular":
        order = Product.is_featured.desc()
    elif sort_by == "rating":
        # For now, sort by featured as proxy for popularity
        order = Product.is_featured.desc()
    elif sort_by == "discount":
        # Sort by discount percentage (old_price - price) / old_price
        order = func.coalesce((Product.old_price - Product.price) / Product.old_price, 0).desc() if sort_order == "desc" else func.coalesce((Product.old_price - Product.price) / Product.old_price, 0).asc()
    else:
        order = Product.name.asc() if sort_order == "asc" else Product.name.desc()

    offset = (page - 1) * limit
    query = query.order_by(order).offset(offset).limit(limit)
    products = db.scalars(query).all()

    if search and total == 0:
        fuzzy_query = (
            select(Product)
            .where(Product.is_active == True)
            .outerjoin(Brand, Product.brand_id == Brand.id)
            .outerjoin(Category, Product.category_id == Category.id)
        )
        if category_id:
            fuzzy_query = fuzzy_query.where(Product.category_id == category_id)
        if parsed_brand_ids:
            fuzzy_query = fuzzy_query.where(Product.brand_id.in_(parsed_brand_ids))
        if min_price is not None:
            fuzzy_query = fuzzy_query.where(Product.price >= min_price)
        if max_price is not None:
            fuzzy_query = fuzzy_query.where(Product.price <= max_price)

        candidates = db.scalars(fuzzy_query.limit(500)).all()
        fuzzy_ranked = rank_fuzzy_products(search, candidates)
        total = len(fuzzy_ranked)
        total_pages = (total + limit - 1) // limit if total > 0 else 0
        products = [item[0] for item in fuzzy_ranked[offset: offset + limit]]
        search_mode = "fuzzy"
        if fuzzy_ranked:
            search_hint = fuzzy_ranked[0][0].name

    total_pages = (total + limit - 1) // limit if total > 0 else 0

    # Simple serialization for API response
    # Для оптимізації: отримуємо всі залишки інвентаря одним запитом
    product_ids = [p.id for p in products]
    inventory_map = {inv.product_id: inv.quantity for inv in db.execute(select(Inventory.product_id, Inventory.quantity).where(Inventory.product_id.in_(product_ids))).all()}

    products_data = [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "price": p.price,
            "old_price": p.old_price,
            "unit": p.unit,
            "icon": p.icon,
            "description": p.description,
            "badge": p.badge.value if p.badge and hasattr(p.badge, "value") else str(p.badge) if p.badge else None,
            "is_featured": p.is_featured,
            "is_active": p.is_active,
            "category_id": p.category_id,
            "brand_id": p.brand_id,
            "sku": p.sku,
            "category_name": p.category.name if p.category else None,
            "brand_name": p.brand.name if p.brand else None,
            # Додаємо залишок на складі (quantity)
            "quantity": inventory_map.get(p.id, 0),
            # Додаємо in_stock для зручності (true/false)
            "in_stock": inventory_map.get(p.id, 0) > 0,
        }
        for p in products
    ]

    # Enhanced facets
    facets = {}
    
    # Brand facets
    brand_facets_query = select(
        Brand.id,
        Brand.name,
        func.count(Product.id)
    ).join(Product, Product.brand_id == Brand.id).where(Product.is_active == True)
    
    # Apply same filters to facets
    if search:
        # Re-apply search conditions to facets
        facet_search_conditions = []
        for term in search_terms:
            if ":" in term:
                field, value = term.split(":", 1)
                field = field.lower().strip()
                value = value.strip()
                
                if field == "brand" and value:
                    facet_search_conditions.append(Brand.name.ilike(f"%{value}%"))
                elif field == "category" and value:
                    facet_search_conditions.append(Category.name.ilike(f"%{value}%"))
                elif field == "sku" and value:
                    facet_search_conditions.append(Product.sku.ilike(f"%{value}%"))
                else:
                    facet_search_conditions.append(
                        or_(
                            Product.name.ilike(f"%{term}%"),
                            Product.description.ilike(f"%{term}%"),
                            Product.sku.ilike(f"%{term}%"),
                            Brand.name.ilike(f"%{term}%"),
                            Category.name.ilike(f"%{term}%")
                        )
                    )
            else:
                facet_search_conditions.append(
                    or_(
                        Product.name.ilike(f"%{term}%"),
                        Product.description.ilike(f"%{term}%"),
                        Product.sku.ilike(f"%{term}%"),
                        Brand.name.ilike(f"%{term}%"),
                        Category.name.ilike(f"%{term}%")
                    )
                )
        
        if facet_search_conditions:
            brand_facets_query = brand_facets_query.where(and_(*facet_search_conditions))
    
    brand_facets_query = brand_facets_query.outerjoin(Category, Product.category_id == Category.id)
    
    if category_id:
        brand_facets_query = brand_facets_query.where(Product.category_id == category_id)
    if min_price is not None:
        brand_facets_query = brand_facets_query.where(Product.price >= min_price)
    if max_price is not None:
        brand_facets_query = brand_facets_query.where(Product.price <= max_price)
    
    brand_facets_query = brand_facets_query.group_by(Brand.id, Brand.name).order_by(Brand.name.asc())
    brand_facets = [
        {"id": row[0], "name": row[1], "count": row[2]}
        for row in db.execute(brand_facets_query).all()
    ]
    facets["brands"] = brand_facets
    
    # Category facets
    category_facets_query = select(
        Category.id,
        Category.name,
        func.count(Product.id)
    ).join(Product, Product.category_id == Category.id).where(Product.is_active == True)
    
    # Apply same filters
    if search and facet_search_conditions:
        category_facets_query = category_facets_query.where(and_(*facet_search_conditions))
    
    category_facets_query = category_facets_query.outerjoin(Brand, Product.brand_id == Brand.id)
    
    if parsed_brand_ids:
        category_facets_query = category_facets_query.where(Product.brand_id.in_(parsed_brand_ids))
    if min_price is not None:
        category_facets_query = category_facets_query.where(Product.price >= min_price)
    if max_price is not None:
        category_facets_query = category_facets_query.where(Product.price <= max_price)
    
    category_facets_query = category_facets_query.group_by(Category.id, Category.name).order_by(Category.name.asc())
    category_facets = [
        {"id": row[0], "name": row[1], "count": row[2]}
        for row in db.execute(category_facets_query).all()
    ]
    facets["categories"] = category_facets
    
    # Price range facets
    price_stats_query = select(
        func.min(Product.price),
        func.max(Product.price),
        func.avg(Product.price)
    ).where(Product.is_active == True)
    
    # Apply filters to price stats
    if search and facet_search_conditions:
        price_stats_query = price_stats_query.where(and_(*facet_search_conditions))
    if category_id:
        price_stats_query = price_stats_query.where(Product.category_id == category_id)
    if parsed_brand_ids:
        price_stats_query = price_stats_query.where(Product.brand_id.in_(parsed_brand_ids))
    
    price_stats = db.execute(price_stats_query).first()
    if price_stats:
        facets["price"] = {
            "min": price_stats[0],
            "max": price_stats[1],
            "avg": round(price_stats[2], 2) if price_stats[2] else None
        }
    
    # Availability facets
    availability_query = select(
        func.sum(case((Inventory.quantity > 0, 1), else_=0)),
        func.sum(case((Inventory.quantity == 0, 1), else_=0)),
        func.count(Product.id)
    ).outerjoin(Inventory, Product.id == Inventory.product_id).where(Product.is_active == True)
    
    # Apply filters
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
        facets["availability"] = {
            "in_stock": availability_stats[0] or 0,
            "out_of_stock": availability_stats[1] or 0,
            "total": availability_stats[2] or 0
        }

    return {
        "products": products_data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "facets": facets,
        "search_mode": search_mode,
        "search_hint": search_hint,
    }


@app.get("/api/search/suggestions")
def search_suggestions(q: str, db: DbSession):
    query = (q or "").strip()
    if len(query) < 1:  # Allow single character searches for live search
        return {"products": [], "categories": [], "brands": []}

    # Split query into terms for better matching
    search_terms = [term.strip() for term in query.split() if term.strip()]
    
    # Build search conditions for each term
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
                # General search for unknown prefixes
                product_conditions.append(
                    or_(
                        Product.name.ilike(f"%{term}%"),
                        Product.description.ilike(f"%{term}%"),
                        Product.sku.ilike(f"%{term}%"),
                        and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")),
                        and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%"))
                    )
                )
                category_conditions.append(Category.name.ilike(f"%{term}%"))
                brand_conditions.append(Brand.name.ilike(f"%{term}%"))
        else:
            # General search term
            product_conditions.append(
                or_(
                    Product.name.ilike(f"%{term}%"),
                    Product.description.ilike(f"%{term}%"),
                    Product.sku.ilike(f"%{term}%"),
                    and_(Product.brand_id.isnot(None), Brand.name.ilike(f"%{term}%")),
                    and_(Product.category_id.isnot(None), Category.name.ilike(f"%{term}%"))
                )
            )
            category_conditions.append(Category.name.ilike(f"%{term}%"))
            brand_conditions.append(Brand.name.ilike(f"%{term}%"))

    # Apply conditions
    products_query = select(Product).where(Product.is_active == True)
    if product_conditions:
        products_query = products_query.where(and_(*product_conditions))
    products_query = products_query.outerjoin(Brand, Product.brand_id == Brand.id).outerjoin(Category, Product.category_id == Category.id)
    
    categories_query = select(Category).where(Category.is_active == True)
    if category_conditions:
        categories_query = categories_query.where(and_(*category_conditions))
    
    brands_query = select(Brand).where(Brand.is_active == True)
    if brand_conditions:
        brands_query = brands_query.where(and_(*brand_conditions))

    products = db.scalars(
        products_query
        .order_by(Product.is_featured.desc(), Product.name.asc())
        .limit(8)
    ).all()

    search_mode = "strict"
    if not products:
        fallback_candidates = db.scalars(
            select(Product)
            .where(Product.is_active == True)
            .outerjoin(Brand, Product.brand_id == Brand.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .limit(500)
        ).all()
        products = [item[0] for item in rank_fuzzy_products(query, fallback_candidates, limit=8)]
        search_mode = "fuzzy"

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
                "old_price": product.old_price,
                "slug": product.slug,
                "description": product.description,
                "quantity": stock_map.get(product.id, 0),
                "brand_name": product.brand.name if product.brand else None,
                "category_name": product.category.name if product.category else None,
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


@app.get("/api/products/{product_id}")
def get_product(product_id: int, db: DbSession):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    inventory = db.scalar(select(Inventory).where(Inventory.product_id == product.id))
    stock_quantity = inventory.quantity if inventory and inventory.quantity is not None else 0
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
        "category_name": product.category.name if product.category else None,
        "brand_id": product.brand_id,
        "brand_name": product.brand.name if product.brand else None,
        "sku": product.sku,
        "description": product.description,
        "quantity": stock_quantity,
        "in_stock": stock_quantity > 0,
    }


def serialize_review(review: Review):
    return {
        "id": review.id,
        "product_id": review.product_id,
        "user_id": review.user_id,
        "rating": review.rating,
        "comment": review.comment,
        "is_approved": review.is_approved,
        "admin_reply": review.admin_reply,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "author": {
            "id": review.user.id,
            "first_name": review.user.first_name,
            "last_name": review.user.last_name,
            "role": review.user.role.value if hasattr(review.user.role, "value") else str(review.user.role),
        } if review.user else None,
    }


@app.get("/api/products/{product_id}/reviews")
def get_product_reviews(product_id: int, db: DbSession, current_user: Annotated[User | None, Depends(get_optional_user)] = None):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = db.scalars(
        select(Review)
        .where(Review.product_id == product_id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
    ).all()

    visible_reviews = []
    for review in reviews:
        if review.is_approved:
            visible_reviews.append(review)
            continue
        if current_user and (review.user_id == current_user.id or can_manage_catalog(current_user.role)):
            visible_reviews.append(review)

    avg_rating = round(sum(r.rating for r in visible_reviews) / len(visible_reviews), 1) if visible_reviews else None
    can_review = False
    review_requirement = "Щоб залишити відгук, замовлення з цим товаром має бути доставлене або забране."
    if current_user:
        can_review = can_user_review_product(db, current_user.id, product_id)
    return {
        "reviews": [serialize_review(review) for review in visible_reviews],
        "total": len(visible_reviews),
        "avg_rating": avg_rating,
        "can_review": can_review,
        "review_requirement": review_requirement,
    }


@app.post("/api/products/{product_id}/reviews")
def create_or_update_review(
    product_id: int,
    payload: dict,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")

    if not can_user_review_product(db, current_user.id, product_id):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "REVIEW_NOT_ALLOWED",
                "message": "Відгук можна залишити лише після статусу 'Доставлено' або 'Забрано' для цього товару.",
            },
        )

    raw_rating = payload.get("rating")
    try:
        rating = int(raw_rating)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail={"code": "INVALID_REVIEW_RATING", "message": "Оцінка має бути числом від 1 до 5"})

    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail={"code": "INVALID_REVIEW_RATING", "message": "Оцінка має бути від 1 до 5"})

    comment = str(payload.get("comment") or "").strip()
    if len(comment) < 5:
        raise HTTPException(status_code=400, detail={"code": "INVALID_REVIEW_COMMENT", "message": "Відгук має містити щонайменше 5 символів"})
    comment = comment[:1500]

    existing_review = db.scalar(
        select(Review).where(Review.product_id == product_id, Review.user_id == current_user.id)
    )

    if existing_review:
        existing_review.rating = rating
        existing_review.comment = comment
        existing_review.is_approved = True
        existing_review.created_at = datetime.utcnow()
        db.add(existing_review)
        review = existing_review
    else:
        review = Review(
            product_id=product_id,
            user_id=current_user.id,
            rating=rating,
            comment=comment,
            is_approved=True,
        )
        db.add(review)

    db.commit()
    db.refresh(review)
    review = db.scalar(select(Review).where(Review.id == review.id).options(selectinload(Review.user)))
    return serialize_review(review)


@app.get("/api/users/{user_id}/public")
def get_public_user_profile(user_id: int, db: DbSession):
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    reviews = db.scalars(
        select(Review)
        .where(Review.user_id == user_id, Review.is_approved == True)
        .options(selectinload(Review.product))
        .order_by(Review.created_at.desc())
        .limit(10)
    ).all()

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "reviews_count": db.scalar(select(func.count()).select_from(Review).where(Review.user_id == user_id, Review.is_approved == True)) or 0,
        "recent_reviews": [
            {
                "id": review.id,
                "rating": review.rating,
                "comment": review.comment,
                "created_at": review.created_at.isoformat() if review.created_at else None,
                "product": {
                    "id": review.product.id,
                    "name": review.product.name,
                } if review.product else None,
            }
            for review in reviews
        ],
    }


@app.post("/api/products")
def create_product(product: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_catalog_user)]):
    new_product = Product(**product)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return serialize_model(new_product)


@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_catalog_user)]):
    db_product = db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product.items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return serialize_model(db_product)


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_catalog_user)]):
    db_product = db.get(Product, product_id)
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted"}


# Inventory
@app.get("/api/inventory")
def get_inventory(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_warehouse_user)],
    q: str | None = None,
):
    query = select(Inventory).options(selectinload(Inventory.product))
    if q:
        normalized = f"%{str(q).strip().lower()}%"
        query = (
            query
            .join(Product, Inventory.product_id == Product.id)
            .where(
                or_(
                    func.lower(Product.name).like(normalized),
                    func.lower(Product.sku).like(normalized),
                    func.lower(func.coalesce(Inventory.location, "")).like(normalized),
                )
            )
        )

    inventory_items = db.scalars(query.order_by(Inventory.updated_at.desc())).all()
    result = []
    for item in inventory_items:
        product = item.product
        result.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": product.name if product else "Unknown",
            "product_sku": product.sku if product else None,
            "quantity": item.quantity,
            "min_quantity": item.min_quantity,
            "max_quantity": item.max_quantity,
            "location": item.location,
            "min_quantity_alert": item.min_quantity_alert if item.min_quantity_alert is not None else item.min_quantity,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None
        })
    return result


@app.put("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, inventory_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_warehouse_user)]):
    db_inventory = db.get(Inventory, inventory_id)
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    try:
        old_quantity = db_inventory.quantity
        for key, value in inventory_data.items():
            setattr(db_inventory, key, value)

        if 'quantity' in inventory_data:
            min_alert = db_inventory.min_quantity_alert or db_inventory.min_quantity
            if old_quantity >= min_alert and db_inventory.quantity < min_alert:
                create_low_stock_notifications(db, [db_inventory])

            if old_quantity == 0 and db_inventory.quantity > 0:
                subscribers = db.scalars(select(Wishlist).where(Wishlist.product_id == db_inventory.product_id)).all()
                for subscription in subscribers:
                    db.add(Notification(
                        user_id=subscription.user_id,
                        type=NotificationType.system,
                        title="Товар знову в наявності",
                        message=f"Товар '{db_inventory.product.name}' знову доступний для замовлення.",
                        target_path=f"/product/{db_inventory.product_id}",
                        target_product_id=db_inventory.product_id,
                    ))

        db.commit()
        db.refresh(db_inventory)
        return serialize_model(db_inventory)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


# Orders
@app.get("/api/orders")
def get_orders(db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if not can_manage_sales(current_user.role):
        query = query.where(Order.user_id == current_user.id)
    orders = db.scalars(query).all()
    return [serialize_order_summary(order) for order in orders]


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_manage_sales(current_user.role) and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return serialize_order_summary(order)


@app.post("/api/orders")
def create_order(order_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    if not isinstance(order_data, dict):
        raise HTTPException(status_code=400, detail={"code": "INVALID_ORDER_PAYLOAD", "message": "Некоректний формат замовлення"})

    def _clean_text(value, max_len: int = 255) -> str:
        text = str(value or "").strip()
        return text[:max_len]

    def _normalize_phone(value: str) -> str:
        raw = str(value or "").strip()
        cleaned = re.sub(r"[^\d+]", "", raw)
        if cleaned.startswith("00"):
            cleaned = f"+{cleaned[2:]}"
        if not cleaned.startswith("+") and cleaned.startswith("0") and len(cleaned) == 10:
            cleaned = f"+38{cleaned}"
        return cleaned

    def _parse_non_negative(name: str, value, default: float = 0.0) -> float:
        if value in (None, ""):
            return default
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail={"code": "INVALID_NUMERIC_FIELD", "field": name, "message": f"Поле {name} має бути числом"})
        if parsed < 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_NUMERIC_FIELD", "field": name, "message": f"Поле {name} не може бути від'ємним"})
        return parsed

    items_raw = order_data.get("items")
    if not isinstance(items_raw, list) or not items_raw:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_ITEMS", "message": "Замовлення має містити хоча б один товар"})

    contact_name = _clean_text(order_data.get("contact_name"), 200)
    if not contact_name:
        fallback_name = " ".join(part for part in [current_user.first_name, current_user.last_name] if part).strip()
        contact_name = fallback_name or _clean_text(current_user.email.split("@")[0], 200)
    if len(contact_name) < 2:
        raise HTTPException(status_code=400, detail={"code": "INVALID_CONTACT_NAME", "field": "contact_name", "message": "Вкажіть коректне ім'я отримувача"})

    contact_phone = _normalize_phone(order_data.get("contact_phone"))
    if not contact_phone:
        contact_phone = _normalize_phone(current_user.phone)
    if not re.match(r"^\+?\d{10,15}$", contact_phone):
        raise HTTPException(status_code=400, detail={"code": "INVALID_CONTACT_PHONE", "field": "contact_phone", "message": "Вкажіть коректний номер телефону"})

    contact_email = _clean_text(order_data.get("contact_email"), 255) or _clean_text(current_user.email, 255)
    if contact_email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", contact_email):
        raise HTTPException(status_code=400, detail={"code": "INVALID_CONTACT_EMAIL", "field": "contact_email", "message": "Email має некоректний формат"})

    delivery_city = _clean_text(order_data.get("delivery_city"), 100)
    delivery_address = _clean_text(order_data.get("delivery_address"), 500)
    if not delivery_city:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DELIVERY_CITY", "field": "delivery_city", "message": "Вкажіть місто доставки"})
    if not delivery_address:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DELIVERY_ADDRESS", "field": "delivery_address", "message": "Вкажіть адресу доставки"})

    delivery_method_input = order_data.get("delivery_method") or DeliveryMethod.nova_poshta
    payment_method_input = order_data.get("payment_method") or PaymentMethod.card
    try:
        delivery_method = DeliveryMethod(delivery_method_input) if isinstance(delivery_method_input, str) else delivery_method_input
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DELIVERY_METHOD", "field": "delivery_method", "message": "Некоректний спосіб доставки"})
    try:
        payment_method = PaymentMethod(payment_method_input) if isinstance(payment_method_input, str) else payment_method_input
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PAYMENT_METHOD", "field": "payment_method", "message": "Некоректний спосіб оплати"})

    delivery_cost = _parse_non_negative("delivery_cost", order_data.get("delivery_cost"), 0.0)
    discount = _parse_non_negative("discount", order_data.get("discount"), 0.0)
    comment = _clean_text(order_data.get("comment"), 1000)

    merged_items: dict[int, int] = {}
    for idx, item in enumerate(items_raw):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "index": idx, "message": "Некоректний формат позиції замовлення"})
        try:
            product_id = int(item.get("product_id", 0))
            quantity = int(item.get("quantity", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "index": idx, "message": "Товар або кількість мають некоректний формат"})

        if product_id <= 0 or quantity <= 0:
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "index": idx, "message": "Кожна позиція має містити коректні product_id та quantity"})
        if quantity > 999:
            raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM_QUANTITY", "index": idx, "message": "Кількість в одній позиції не може перевищувати 999"})

        merged_items[product_id] = merged_items.get(product_id, 0) + quantity

    items_data = [{"product_id": product_id, "quantity": qty} for product_id, qty in merged_items.items()]

    filtered_data = {
        "contact_name": contact_name,
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        "delivery_city": delivery_city,
        "delivery_address": delivery_address,
        "delivery_method": delivery_method,
        "payment_method": payment_method,
        "delivery_cost": delivery_cost,
        "discount": discount,
        "comment": comment,
    }
    if order_data.get("address_id"):
        filtered_data["address_id"] = order_data.get("address_id")
    if order_data.get("promo_code_id"):
        filtered_data["promo_code_id"] = order_data.get("promo_code_id")

    try:
        order = Order(user_id=current_user.id, **filtered_data)
        db.add(order)
        db.flush()

        subtotal = 0.0
        inventory_changes: list[tuple[int, int, int, int]] = []
        # (product_id, qty, quantity_before, quantity_after)

        for item in items_data:
            product_id = item.get("product_id")
            quantity = int(item.get("quantity", 0))
            if not product_id or quantity <= 0:
                raise HTTPException(status_code=400, detail={"code": "INVALID_ITEM", "message": "Кожна позиція має містити коректні product_id та quantity"})

            product = db.get(Product, product_id)
            if not product:
                raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "product_id": product_id, "message": f"Товар #{product_id} не знайдено"})
            if not product.is_active:
                raise HTTPException(status_code=400, detail={"code": "PRODUCT_INACTIVE", "product_id": product_id, "message": f"Товар '{product.name}' недоступний для замовлення"})

            inventory = db.scalar(select(Inventory).where(Inventory.product_id == product_id))
            available_quantity = inventory.quantity if inventory and inventory.quantity else 0
            if available_quantity < quantity:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "INSUFFICIENT_STOCK",
                        "product_id": product_id,
                        "product_name": product.name,
                        "requested": quantity,
                        "available": available_quantity,
                        "message": f"Недостатньо залишку для товару '{product.name}'",
                    }
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

            quantity_before = inventory.quantity
            inventory.quantity -= quantity
            quantity_after = inventory.quantity
            db.add(inventory)
            inventory_changes.append((product_id, quantity, quantity_before, quantity_after))

        delivery_cost = float(order.delivery_cost or 0)
        discount = float(order.discount or 0)
        if discount > subtotal + delivery_cost:
            discount = subtotal + delivery_cost
            order.discount = discount
        order.subtotal = subtotal
        order.total = max(subtotal + delivery_cost - discount, 0)

        for product_id, quantity, quantity_before, quantity_after in inventory_changes:
            db.add(InventoryMovement(
                product_id=product_id,
                order_id=order.id,
                type=MovementType.sale,
                quantity=-quantity,
                quantity_before=quantity_before,
                quantity_after=quantity_after,
                note=f"Автосписання: замовлення #{order.id}"
            ))

        # Create clickable low-stock notifications for affected items right after stock deduction.
        if inventory_changes:
            affected_product_ids = [change[0] for change in inventory_changes]
            affected_inventory = db.scalars(
                select(Inventory)
                .where(Inventory.product_id.in_(affected_product_ids))
                .options(selectinload(Inventory.product))
            ).all()
            create_low_stock_notifications(db, affected_inventory)

        # Clear user's cart in the same transaction
        cart = db.scalar(select(Cart).where(Cart.user_id == current_user.id))
        if cart:
            db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))

        db.refresh(order)

        # Notify customer about successful order creation
        if order.user_id:
            status_ua = get_order_status_ua(
                order.status.value if hasattr(order.status, "value") else str(order.status)
            )
            db.add(Notification(
                user_id=order.user_id,
                type=NotificationType.order_status,
                title=f"Замовлення #{order.id} створено",
                message=f"Ваше замовлення #{order.id} успішно оформлено зі статусом '{status_ua}'.",
                target_path="/profile",
                target_order_id=order.id,
            ))
        sales_users = db.scalars(
            select(User).where(
                User.role.in_([UserRole.admin, UserRole.sales_processor, UserRole.manager]),
                User.is_active == True,
            )
        ).all()
        for sales_user in sales_users:
            db.add(Notification(
                user_id=sales_user.id,
                type=NotificationType.order_status,
                title=f"Нове замовлення #{order.id}",
                message=f"Надійшло нове замовлення на суму {order.total} грн.",
                target_path="/manager?tab=orders",
                target_order_id=order.id,
            ))
        db.commit()

        # Return a safe, flat payload to avoid post-commit serialization failures
        return {
            "id": order.id,
            "user_id": order.user_id,
            "status": order.status.value if hasattr(order.status, "value") else order.status,
            "subtotal": order.subtotal,
            "delivery_cost": order.delivery_cost,
            "discount": order.discount,
            "total": order.total,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.put("/api/orders/{order_id}")
@limiter.limit("30/minute")
def update_order(request: Request, order_id: int, order_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_sales_user)]):
    from audit_log import create_order_status_change_audit, create_audit_log
    
    set_user_id(current_user.id)
    
    db_order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        old_status = parse_order_status(db_order.status)
        new_status = old_status

        if "status" in order_data:
            new_status = parse_order_status(order_data.get("status"))
            ensure_status_transition_allowed(old_status, new_status)
            db_order.status = new_status

        allowed_fields = {
            "tracking_number",
            "admin_note",
            "payment_status",
            "delivery_method",
            "payment_method",
        }
        changes = {}
        for key, value in order_data.items():
            if key in allowed_fields:
                old_value = getattr(db_order, key, None)
                if old_value != value:
                    changes[key] = {'from': old_value, 'to': value}
                setattr(db_order, key, value)

        if old_status != new_status and new_status == OrderStatus.cancelled:
            restock_order_items(db, db_order, note_prefix="Скасування замовлення")
            
            # Audit log for cancellation
            create_audit_log(
                db, current_user.id, 'status_change', 'order', order_id,
                {'from': old_status.value, 'to': new_status.value},
                request=request
            )

        if old_status != new_status and db_order.user_id is None and db_order.contact_email:
            linked_user = db.scalar(select(User).where(User.email == db_order.contact_email))
            if linked_user:
                db_order.user_id = linked_user.id

        if old_status != new_status and db_order.user_id is not None:
            old_status_ua = get_order_status_ua(old_status.value)
            new_status_ua = get_order_status_ua(new_status.value)
            db.add(Notification(
                user_id=db_order.user_id,
                type=NotificationType.order_status,
                title=f"Статус замовлення #{db_order.id} змінено",
                message=f"Ваше замовлення #{db_order.id} змінило статус з '{old_status_ua}' на '{new_status_ua}'",
                target_path="/profile",
                target_order_id=db_order.id,
            ))
            
            # Audit log for status change
            create_order_status_change_audit(
                db, current_user.id, order_id, old_status.value, new_status.value,
                request=request
            )

        db.commit()
        db.refresh(db_order)
        logger.info(f'Order {order_id} updated', extra={'order_id': order_id, 'user_id': current_user.id})
        return serialize_model(db_order)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f'Error updating order {order_id}', extra={'order_id': order_id, 'error': str(e)})
        raise


@app.post("/api/orders/{order_id}/cancel")
def cancel_order(order_id: int, payload: dict | None, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    order = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items)))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id and not can_manage_sales(current_user.role):
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        old_status = parse_order_status(order.status)
        if old_status not in (OrderStatus.new, OrderStatus.processing):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "CANCEL_NOT_ALLOWED",
                    "message": "Скасування доступне лише для замовлень зі статусом 'Нове' або 'В обробці'.",
                },
            )

        reason = str((payload or {}).get("reason") or "").strip()
        if reason:
            order.admin_note = f"{order.admin_note + chr(10) if order.admin_note else ''}Скасовано клієнтом: {reason[:300]}"

        order.status = OrderStatus.cancelled
        restock_order_items(db, order, note_prefix="Скасування клієнтом")

        staff_users = db.scalars(
            select(User).where(
                User.role.in_([UserRole.admin, UserRole.sales_processor, UserRole.manager]),
                User.is_active == True,
            )
        ).all()
        for staff in staff_users:
            db.add(Notification(
                user_id=staff.id,
                type=NotificationType.order_status,
                title=f"Клієнт скасував замовлення #{order.id}",
                message=f"Замовлення #{order.id} скасовано клієнтом {current_user.first_name} {current_user.last_name}.",
                target_path="/manager?tab=orders",
                target_order_id=order.id,
            ))

        db.commit()
        db.refresh(order)
        return serialize_order_summary(order)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@app.get("/api/orders/{order_id}/messages")
def get_order_messages(order_id: int, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_manage_sales(current_user.role) and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    messages = db.scalars(
        select(OrderMessage)
        .where(OrderMessage.order_id == order_id)
        .options(selectinload(OrderMessage.sender))
        .order_by(OrderMessage.created_at.asc())
    ).all()
    return {
        "order_id": order_id,
        "messages": [serialize_order_message(message) for message in messages],
    }


@app.post("/api/orders/{order_id}/messages")
@limiter.limit("30/minute")
def create_order_message(request: Request, order_id: int, payload: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    set_user_id(current_user.id)
    
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_manage_sales(current_user.role) and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        body = str((payload or {}).get("body") or "").strip()
        if len(body) < 2:
            raise HTTPException(status_code=400, detail={"code": "INVALID_MESSAGE", "message": "Повідомлення має містити щонайменше 2 символи"})
        body = body[:1200]

        is_from_staff = can_manage_sales(current_user.role)
        message = OrderMessage(
            order_id=order.id,
            sender_id=current_user.id,
            body=body,
            is_from_staff=is_from_staff,
        )
        db.add(message)
        db.flush()

        recipient_ids: list[int] = []
        if is_from_staff:
            if order.user_id:
                recipient_ids = [order.user_id]
        else:
            recipient_ids = [
                user.id for user in db.scalars(
                    select(User).where(
                        User.role.in_([UserRole.admin, UserRole.sales_processor, UserRole.manager]),
                        User.is_active == True,
                    )
                ).all()
            ]

        for recipient_id in recipient_ids:
            if recipient_id == current_user.id:
                continue
            db.add(Notification(
                user_id=recipient_id,
                type=NotificationType.system,
                title=f"Нове повідомлення по замовленню #{order.id}",
                message=body[:180],
                target_path="/profile" if not is_from_staff else "/manager?tab=orders",
                target_order_id=order.id,
            ))

        db.commit()
        message = db.scalar(select(OrderMessage).where(OrderMessage.id == message.id).options(selectinload(OrderMessage.sender)))
        logger.info(f'Order message created', extra={'order_id': order_id, 'user_id': current_user.id, 'is_staff': is_from_staff})
        return serialize_order_message(message)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f'Error creating order message', extra={'order_id': order_id, 'error': str(e)})
        raise


# Users (admin only)
@app.get("/api/users")
def get_users(db: DbSession, current_user: Annotated[User, Depends(get_current_admin_user)]):
    users = db.scalars(select(User)).all()
    return serialize_model(users)


@app.get("/api/me")
def get_current_user_info(current_user: Annotated[User, Depends(get_current_active_user)]):
    return serialize_model(current_user)


@app.patch("/api/me")
def update_current_user_info(user_data: dict, db: DbSession, current_user: Annotated[User, Depends(get_current_active_user)]):
    allowed_fields = {"phone", "first_name", "last_name"}
    payload = {key: value for key, value in (user_data or {}).items() if key in allowed_fields}

    def _clean_text(value, max_len: int = 100) -> str:
        return str(value or "").strip()[:max_len]

    if "first_name" in payload:
        first_name = _clean_text(payload.get("first_name"), 100)
        if not first_name:
            raise HTTPException(status_code=400, detail={"code": "INVALID_FIRST_NAME", "field": "first_name", "message": "Ім'я не може бути порожнім"})
        current_user.first_name = first_name

    if "last_name" in payload:
        last_name = _clean_text(payload.get("last_name"), 100)
        if not last_name:
            raise HTTPException(status_code=400, detail={"code": "INVALID_LAST_NAME", "field": "last_name", "message": "Прізвище не може бути порожнім"})
        current_user.last_name = last_name

    if "phone" in payload:
        raw_phone = str(payload.get("phone") or "").strip()
        if raw_phone == "":
            current_user.phone = None
        else:
            normalized = re.sub(r"[^\d+]", "", raw_phone)
            if normalized.startswith("00"):
                normalized = f"+{normalized[2:]}"
            if not normalized.startswith("+") and normalized.startswith("0") and len(normalized) == 10:
                normalized = f"+38{normalized}"
            if not re.match(r"^\+?\d{10,15}$", normalized):
                raise HTTPException(status_code=400, detail={"code": "INVALID_PHONE", "field": "phone", "message": "Номер телефону має бути у форматі +380XXXXXXXXX"})
            current_user.phone = normalized

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
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
    allowed_fields = {"email", "first_name", "last_name", "phone", "role", "is_active", "password"}
    for key, value in user_data.items():
        if key not in allowed_fields:
            continue
        if key == "password":
            if not value:
                continue
            value = get_password_hash(value)
            key = "password_hash"
        elif key == "role":
            try:
                value = UserRole(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid user role")
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

    cart_product_ids = [ci.product_id for ci in (cart.items or [])]
    stock_map = {
        product_id: quantity
        for product_id, quantity in db.execute(
            select(Inventory.product_id, Inventory.quantity).where(Inventory.product_id.in_(cart_product_ids))
        ).all()
    }
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
                    "old_price": ci.product.old_price,
                    "sku": ci.product.sku,
                    "slug": ci.product.slug,
                    "description": ci.product.description,
                    "quantity": stock_map.get(ci.product.id, 0),
                    "in_stock": stock_map.get(ci.product.id, 0) > 0,
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
            "target_path": resolve_notification_target_path(n, current_user),
            "target_product_id": n.target_product_id,
            "target_inventory_id": n.target_inventory_id,
            "target_order_id": n.target_order_id,
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
    """Перевірка та створення повідомлень про низький запас для адміністраторів"""
    inventory_items = db.scalars(select(Inventory).options(selectinload(Inventory.product))).all()
    staff_users = db.scalars(select(User).where(User.role == UserRole.admin)).all()
    
    if not staff_users:
        return 0
    
    for staff_user in staff_users:
        db.execute(delete(Notification).where(
            Notification.type == NotificationType.low_stock,
            Notification.user_id == staff_user.id,
            Notification.is_read == False
        ))
    
    low_count = create_low_stock_notifications(db, inventory_items, recipient_roles=[UserRole.admin])
    
    db.commit()
    return low_count


@app.get("/api/notifications/check-low-stock")
def check_low_stock(db: DbSession, current_user: Annotated[User, Depends(get_current_warehouse_user)]):
    """Примусова перевірка низького запасу"""
    count = check_low_stock_notifications(db)
    return {"message": f"Перевірку выполнено. Знайдено {count} товарів з низьким запасом", "count": count}


# ============================================================
# AUDIT LOGS (Admin Only)
# ============================================================

@app.get("/api/audit-logs")
def get_audit_logs(
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_admin_user)],
    resource_type: str | None = None,
    resource_id: int | None = None,
    user_id: int | None = None,
    action: str | None = None,
    limit: int = 100,
):
    """Get audit logs (admin only)."""
    from audit_log import get_audit_logs as get_audit_logs_helper
    
    set_user_id(current_user.id)
    
    logs = get_audit_logs_helper(
        db,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        action=action,
        limit=limit
    )
    
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user.email if log.user else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "changes": log.changes_json,
            "request_id": log.request_id,
            "ip_address": log.ip_address,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


if __name__ == "__main__":
    from database import SessionLocal
    db = SessionLocal()
    try:
        check_low_stock_notifications(db)
    finally:
        db.close()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
