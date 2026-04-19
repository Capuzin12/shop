"""
Logging configuration for BuildShop API
JSON-formatted logging for container and cloud environments
"""

import json
import logging
import sys
from datetime import datetime
from typing import Optional, Any, Dict
from contextvars import ContextVar
import uuid

# Context variable for storing request_id per request
request_id_context: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id_context: ContextVar[Optional[int]] = ContextVar('user_id', default=None)


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())


def get_request_id() -> str:
    """Get the current request ID from context."""
    request_id = request_id_context.get()
    return request_id or generate_request_id()


def set_request_id(request_id: str) -> None:
    """Set the request ID in context."""
    request_id_context.set(request_id)


def set_user_id(user_id: Optional[int]) -> None:
    """Set the user ID in context."""
    user_id_context.set(user_id)


def get_user_id() -> Optional[int]:
    """Get the user ID from context."""
    return user_id_context.get()


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data: Dict[str, Any] = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'request_id': get_request_id(),
        }
        
        # Add user_id if available
        user_id = get_user_id()
        if user_id:
            log_data['user_id'] = user_id
        
        # Add exception info if present
        if record.exc_info:
            log_data['exc_info'] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, 'extra_data'):
            log_data.update(record.extra_data)
        
        return json.dumps(log_data, default=str)


def configure_logging(debug: bool = False) -> logging.Logger:
    """Configure and return the root logger."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler with JSON formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if debug else logging.INFO)
    console_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(console_handler)
    
    # Suppress noisy logs from libraries
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a named logger."""
    logger = logging.getLogger(name)
    return logger


# Convenience function for logging with extra context
def log_with_context(logger: logging.Logger, level: int, message: str, **extra_data) -> None:
    """Log with extra context data."""
    record = logger.makeRecord(
        logger.name, level, "(unknown file)", 0, message, (), None
    )
    record.extra_data = extra_data
    logger.handle(record)

