import models
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded

from config import settings, validate_settings
from logging_config import configure_logging, get_logger
from routers import admin, auth, brands, cart, categories, inventory, notifications, orders, password_reset, products, promo, search, stats, suppliers, supply, users, wishlist
from security import add_request_id_middleware, add_security_headers_middleware, add_timing_middleware, custom_rate_limit_handler, limiter

validate_settings()
logger = get_logger(__name__)
configure_logging(debug=settings.debug)

app = FastAPI(title="BuildShop API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time", "Content-Disposition"],
    max_age=3600,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.middleware("http")(add_request_id_middleware)
app.middleware("http")(add_security_headers_middleware)
app.middleware("http")(add_timing_middleware)

for router_module in [auth, password_reset, users, products, categories, brands, suppliers, inventory, orders, cart, wishlist, promo, notifications, admin, supply, search, stats]:
    app.include_router(router_module.router)
