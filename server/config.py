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
                    'Set SECRET_KEY environment variable to a strong random value.'
                )
        return v
    
    @validator('jwt_algorithm')
    def validate_jwt_algorithm(cls, v):
        """Ensure JWT algorithm is secure."""
        valid_algorithms = ('HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512')
        if v not in valid_algorithms:
            raise ValueError(f'JWT_ALGORITHM must be one of {valid_algorithms}')
        return v
    
    @validator('database_url')
    def validate_database_url(cls, v):
        """Validate database URL format."""
        if not v or len(v) < 10:
            raise ValueError('DATABASE_URL is invalid or missing')
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

