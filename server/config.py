"""
Configuration management for BuildShop API using Pydantic Settings
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, validator
import re


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Core settings
    debug: bool = Field(default=False, env='DEBUG')
    environment: str = Field(default='development', env='ENVIRONMENT')
    
    # Database
    database_url: str = Field(default='sqlite:///./app.db', env='DATABASE_URL')
    
    # JWT/Auth
    secret_key: str = Field(default='dev-only-secret-change-me', env='SECRET_KEY')
    jwt_algorithm: str = Field(default='HS256', env='JWT_ALGORITHM')
    jwt_access_ttl_min: int = Field(default=30, env='JWT_ACCESS_TTL_MIN')
    jwt_refresh_ttl_min: int = Field(default=1440, env='JWT_REFRESH_TTL_MIN')  # 24 hours
    auth_cookie_name: str = Field(default='access_token', env='AUTH_COOKIE_NAME')
    auth_cookie_samesite: str = Field(default='lax', env='AUTH_COOKIE_SAMESITE')
    auth_cookie_secure: bool = Field(default=True, env='AUTH_COOKIE_SECURE')  # HTTPS only
    
    # CORS
    cors_origins: str = Field(default='http://localhost:5173', env='CORS_ORIGINS')
    # Опційно: regex для Origin (напр. усі Vercel preview), якщо не хочете перелічувати кожен URL у CORS_ORIGINS
    cors_origin_regex: Optional[str] = Field(default=None, env='CORS_ORIGIN_REGEX')
    
    # API Server
    api_host: str = Field(default='0.0.0.0', env='API_HOST')
    api_port: int = Field(default=8000, env='API_PORT')
    
    # Rate limiting
    rate_limit_enabled: bool = Field(default=True, env='RATE_LIMIT_ENABLED')
    rate_limit_requests_per_minute: int = Field(default=100, env='RATE_LIMIT_REQUESTS_PER_MINUTE')
    rate_limit_login_per_minute: int = Field(default=5, env='RATE_LIMIT_LOGIN_PER_MINUTE')
    rate_limit_api_per_minute: int = Field(default=100, env='RATE_LIMIT_API_PER_MINUTE')
    
    # Security
    max_login_attempts: int = Field(default=5, env='MAX_LOGIN_ATTEMPTS')
    login_attempt_window_minutes: int = Field(default=15, env='LOGIN_ATTEMPT_WINDOW_MINUTES')
    min_password_length: int = Field(default=12, env='MIN_PASSWORD_LENGTH')
    require_special_char_in_password: bool = Field(default=True, env='REQUIRE_SPECIAL_CHAR')
    session_timeout_minutes: int = Field(default=30, env='SESSION_TIMEOUT_MINUTES')
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        case_sensitive = False
    
    @validator('secret_key')
    def validate_secret_key(cls, v):
        """Ensure secret key is not the default dev key in production."""
        if v == 'dev-only-secret-change-me':
            env = os.getenv('ENVIRONMENT', 'development')
            if env in ('production', 'prod', 'staging'):
                raise ValueError(
                    'SECRET_KEY must not be the default dev key in production. '
                    'Set SECRET_KEY environment variable to a strong random value (min 32 chars).'
                )
        # In production, enforce minimum key length
        if os.getenv('ENVIRONMENT', 'development') in ('production', 'prod'):
            if len(str(v)) < 32:
                raise ValueError('SECRET_KEY must be at least 32 characters in production')
        return v
    
    @validator('jwt_algorithm')
    def validate_jwt_algorithm(cls, v):
        """Ensure JWT algorithm is secure."""
        # HS256 is acceptable but RS256 is better for distributed systems
        valid_algorithms = ('HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512')
        if v not in valid_algorithms:
            raise ValueError(f'JWT_ALGORITHM must be one of {valid_algorithms}')
        return v

    @validator('auth_cookie_samesite')
    def validate_auth_cookie_samesite(cls, v):
        allowed = {'lax', 'strict', 'none'}
        value = str(v or '').strip().lower()
        if value not in allowed:
            raise ValueError(f'AUTH_COOKIE_SAMESITE must be one of {tuple(sorted(allowed))}')
        return value
    
    @validator('database_url')
    def validate_database_url(cls, v):
        """Validate database URL format."""
        if not v or len(v) < 10:
            raise ValueError('DATABASE_URL is invalid or missing')
        # Warn if SQLite in production (should use PostgreSQL)
        if v.startswith('sqlite') and os.getenv('ENVIRONMENT', 'development') in ('production', 'prod'):
            import warnings
            warnings.warn('SQLite should not be used in production. Use PostgreSQL instead.')
        return v

    @validator('cors_origin_regex')
    def validate_cors_origin_regex(cls, v):
        if v is None or not str(v).strip():
            return None
        s = str(v).strip()
        try:
            re.compile(s)
        except re.error as e:
            raise ValueError(f'CORS_ORIGIN_REGEX is not a valid regex: {e}') from e
        return s
    
    @validator('auth_cookie_secure')
    def validate_auth_cookie_secure(cls, v):
        """Enforce secure cookies in production."""
        if os.getenv('ENVIRONMENT', 'development') in ('production', 'prod'):
            if not v:
                raise ValueError('AUTH_COOKIE_SECURE must be True in production')
        return v
    
    def get_cors_origins(self) -> List[str]:
        """Parse and return CORS origins as list."""
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]
    
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment in ('production', 'prod')
    
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment in ('development', 'dev', 'local')


# Create global settings instance
settings = Settings()


def validate_settings() -> None:
    """Validate all settings on startup."""
    # Check required environment variables
    if settings.is_production():
        if settings.secret_key == 'dev-only-secret-change-me':
            raise ValueError('SECRET_KEY must be configured in production')
        if settings.debug:
            raise ValueError('DEBUG mode must be disabled in production')

