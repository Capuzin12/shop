"""
Unified error handling and custom exceptions for BuildShop API
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
from logging_config import get_logger, get_request_id, log_with_context

logger = get_logger(__name__)


class AppException(Exception):
    """Base application exception with structured error details."""
    
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        return {
            'request_id': get_request_id(),
            'error_code': self.code,
            'message': self.message,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            **self.details
        }


class ValidationError(AppException):
    """Validation error."""
    
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict] = None):
        error_details = {'field': field} if field else {}
        if details:
            error_details.update(details)
        super().__init__(
            code='VALIDATION_ERROR',
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=error_details
        )


class NotFoundError(AppException):
    """Resource not found."""
    
    def __init__(self, resource: str, details: Optional[Dict] = None):
        super().__init__(
            code='NOT_FOUND',
            message=f'{resource} not found',
            status_code=status.HTTP_404_NOT_FOUND,
            details=details or {}
        )


class UnauthorizedError(AppException):
    """User not authorized."""
    
    def __init__(self, message: str = 'Unauthorized', details: Optional[Dict] = None):
        super().__init__(
            code='UNAUTHORIZED',
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details or {}
        )


class ForbiddenError(AppException):
    """User forbidden from action."""
    
    def __init__(self, message: str = 'Forbidden', details: Optional[Dict] = None):
        super().__init__(
            code='FORBIDDEN',
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details or {}
        )


class ConflictError(AppException):
    """Resource conflict."""
    
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            code='CONFLICT',
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details=details or {}
        )


class RateLimitError(AppException):
    """Rate limit exceeded."""
    
    def __init__(self, retry_after: int = 60, details: Optional[Dict] = None):
        error_details = {'retry_after': retry_after}
        if details:
            error_details.update(details)
        super().__init__(
            code='RATE_LIMIT_EXCEEDED',
            message='Too many requests. Please try again later.',
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=error_details
        )


def exception_to_http_exception(exc: AppException) -> HTTPException:
    """Convert AppException to HTTPException for FastAPI."""
    return HTTPException(
        status_code=exc.status_code,
        detail=exc.to_dict()
    )


def log_error(code: str, message: str, exception: Optional[Exception] = None, **context) -> None:
    """Log an error with context."""
    log_data = {
        'error_code': code,
        'error_message': message,
    }
    log_data.update(context)
    
    if exception:
        log_data['exception_type'] = type(exception).__name__
        log_data['exception_message'] = str(exception)
    
    log_with_context(logger, 40, message, **log_data)  # 40 = ERROR level

