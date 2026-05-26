from models import Base
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded
from starlette.middleware import Middleware
from typing import Any, cast

from config import settings, validate_settings
from logging_config import configure_logging, get_logger
from routers import admin, auth, brands, cart, categories, inventory, notifications, orders, password_reset, products, promo, search, stats, suppliers, supply, users, wishlist
from security import add_request_id_middleware, add_security_headers_middleware, add_timing_middleware, custom_rate_limit_handler, limiter

validate_settings()
logger = get_logger(__name__)
configure_logging(debug=settings.debug)


async def _rate_limit_exception_handler(request, exc):
    return custom_rate_limit_handler(request, exc)

app = FastAPI(
    title="BuildShop API",
    middleware=[
                Middleware(
                    cast(Any, CORSMiddleware),
                    allow_origins=settings.get_cors_origins(),
                    allow_origin_regex=(settings.cors_origin_regex or None),
                    allow_credentials=True,
                    allow_methods=["*"],
                    allow_headers=["*"],
                    expose_headers=["X-Request-ID", "X-Response-Time", "Content-Disposition"],
                    max_age=3600,
                ),
        Middleware(cast(Any, GZipMiddleware), minimum_size=1024),
    ],
)
app.state.limiter = limiter
app.state.models_base = Base
app.add_exception_handler(RateLimitExceeded, _rate_limit_exception_handler)
app.middleware("http")(add_request_id_middleware)
app.middleware("http")(add_security_headers_middleware)
app.middleware("http")(add_timing_middleware)

# Log configured CORS origins on startup for easier debugging in deployment
logger.info("CORS origins: %s", settings.get_cors_origins())
if settings.cors_origin_regex:
    logger.info("CORS origin regex: %s", settings.cors_origin_regex)

for router_module in [auth, password_reset, users, products, categories, brands, suppliers, inventory, orders, cart, wishlist, promo, notifications, admin, supply, search, stats]:
    app.include_router(router_module.router)
