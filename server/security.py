"""
Security middleware and rate limiting for BuildShop API
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import logging
from logging_config import get_logger, set_request_id, set_user_id, get_request_id
from errors import RateLimitError, exception_to_http_exception
from config import settings
from typing import Optional

logger = get_logger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


async def add_request_id_middleware(request: Request, call_next):
    """
    Middleware to add request_id to all requests and responses.
    Accepts X-Request-ID header if provided, otherwise generates a new one.
    """
    # Get or generate request_id
    request_id = request.headers.get('X-Request-ID')
    if not request_id:
        from logging_config import generate_request_id
        request_id = generate_request_id()
    
    # Set in context
    set_request_id(request_id)
    
    # Try to extract user_id from JWT token if present
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        try:
            from jose import jwt
            from config import settings
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
            # Don't set user_id here as we don't have DB context yet; it's set in route handlers
        except Exception:
            pass  # Invalid token will be handled by auth routes
    
    # Call the next middleware/route
    response = await call_next(request)
    
    # Add request_id to response headers
    response.headers['X-Request-ID'] = request_id
    
    return response


async def add_security_headers_middleware(request: Request, call_next):
    """
    Middleware to add security headers to all responses.
    """
    response = await call_next(request)
    
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # HSTS header only in production
    if settings.is_production():
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # CSP header
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    
    return response


async def add_timing_middleware(request: Request, call_next):
    """
    Middleware to log request timing and detect slow requests.
    """
    start_time = time.time()
    
    response = await call_next(request)
    
    duration_ms = (time.time() - start_time) * 1000
    
    # Log timing
    logger.info(
        f'{request.method} {request.url.path}',
        extra={
            'method': request.method,
            'path': request.url.path,
            'status_code': response.status_code,
            'duration_ms': round(duration_ms, 2),
            'request_id': get_request_id(),
        }
    )
    
    # Alert on slow requests (>1000ms for critical endpoints)
    critical_paths = ['/token', '/api/orders', '/api/inventory']
    is_critical = any(request.url.path.startswith(path) for path in critical_paths)
    
    if is_critical and duration_ms > 1000:
        logger.warning(
            f'Slow {request.method} {request.url.path}',
            extra={
                'method': request.method,
                'path': request.url.path,
                'duration_ms': round(duration_ms, 2),
                'threshold_ms': 1000,
                'request_id': get_request_id(),
            }
        )
    
    # Add timing header
    response.headers['X-Response-Time'] = str(round(duration_ms, 2))
    
    return response


def get_rate_limit_key(request: Request) -> str:
    """
    Custom rate limit key that includes endpoint for per-endpoint limiting.
    """
    remote_address = get_remote_address(request)
    return f'{remote_address}:{request.url.path}'


def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors.
    """
    retry_after = 60  # Default retry after
    
    # Extract retry_after from exception if available
    if hasattr(exc, 'detail'):
        parts = str(exc.detail).split()
        if parts:
            try:
                retry_after = int(parts[-1].strip('ms'))
                if retry_after < 1:
                    retry_after = 60
            except (ValueError, IndexError):
                pass
    
    error = RateLimitError(retry_after=retry_after)
    response = JSONResponse(
        status_code=error.status_code,
        content=error.to_dict()
    )
    response.headers['Retry-After'] = str(retry_after)
    response.headers['X-Request-ID'] = get_request_id()
    
    logger.warning(
        'Rate limit exceeded',
        extra={
            'client_ip': get_remote_address(request),
            'path': request.url.path,
            'retry_after': retry_after,
            'request_id': get_request_id(),
        }
    )
    
    return response

