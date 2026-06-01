"""
Configuration management for BuildShop API using Pydantic Settings
"""

import base64
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator, ValidationInfo
import re
import textwrap


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore',
    )

    # Core settings
    debug: bool = Field(default=False, validation_alias='DEBUG')
    environment: str = Field(default='development', validation_alias='ENVIRONMENT')

    # Database
    database_url: str = Field(default='sqlite:///./app.db', validation_alias='DATABASE_URL')

    # JWT/Auth
    secret_key: str = Field(default='dev-only-secret-change-me', validation_alias='SECRET_KEY')
    jwt_algorithm: str = Field(default='HS256', validation_alias='JWT_ALGORITHM')
    jwt_access_ttl_min: int = Field(default=30, validation_alias='JWT_ACCESS_TTL_MIN')
    jwt_refresh_ttl_min: int = Field(default=1440, validation_alias='JWT_REFRESH_TTL_MIN')  # 24 hours
    auth_cookie_name: str = Field(default='access_token', validation_alias='AUTH_COOKIE_NAME')
    refresh_cookie_name: str = Field(default='refresh_token', validation_alias='REFRESH_COOKIE_NAME')
    auth_cookie_samesite: str = Field(default='lax', validation_alias='AUTH_COOKIE_SAMESITE')
    auth_cookie_secure: bool = Field(default=True, validation_alias='AUTH_COOKIE_SECURE')  # HTTPS only
    # For RS* algorithms provide PEM keys as environment variables (raw PEM text)
    jwt_private_key: Optional[str] = Field(default=None, validation_alias='JWT_PRIVATE_KEY')
    jwt_public_key: Optional[str] = Field(default=None, validation_alias='JWT_PUBLIC_KEY')
    jwt_private_key_b64: Optional[str] = Field(default=None, validation_alias='JWT_PRIVATE_KEY_B64')
    jwt_public_key_b64: Optional[str] = Field(default=None, validation_alias='JWT_PUBLIC_KEY_B64')

    # CORS
    # Default includes localhost for dev, plus common deployment URLs
    # For production: set via CORS_ORIGINS env var (comma-separated)
    cors_origins: str = Field(
        default='http://localhost,http://localhost:5173,https://shop-eight-lac.vercel.app,https://buildshop.vercel.app',
        validation_alias='CORS_ORIGINS',
    )
    # Optional: regex for dynamic origins (e.g., all Vercel preview URLs)
    cors_origin_regex: Optional[str] = Field(default=r'^https://.*\.vercel\.app$', validation_alias='CORS_ORIGIN_REGEX')

     # API Server
    api_host: str = Field(default='0.0.0.0', validation_alias='API_HOST')  #nosec B104
    api_port: int = Field(default=8001, validation_alias='API_PORT')

    # Rate limiting
    rate_limit_enabled: bool = Field(default=True, validation_alias='RATE_LIMIT_ENABLED')
    rate_limit_requests_per_minute: int = Field(default=100, validation_alias='RATE_LIMIT_REQUESTS_PER_MINUTE')
    rate_limit_login_per_minute: int = Field(default=5, validation_alias='RATE_LIMIT_LOGIN_PER_MINUTE')
    rate_limit_api_per_minute: int = Field(default=100, validation_alias='RATE_LIMIT_API_PER_MINUTE')

    # Security
    max_login_attempts: int = Field(default=5, validation_alias='MAX_LOGIN_ATTEMPTS')
    login_attempt_window_minutes: int = Field(default=15, validation_alias='LOGIN_ATTEMPT_WINDOW_MINUTES')
    min_password_length: int = Field(default=12, validation_alias='MIN_PASSWORD_LENGTH')
    require_special_char_in_password: bool = Field(default=True, validation_alias='REQUIRE_SPECIAL_CHAR')
    session_timeout_minutes: int = Field(default=30, validation_alias='SESSION_TIMEOUT_MINUTES')

    # External integrations
    frontend_url: str = Field(default='http://localhost:5173', validation_alias='FRONTEND_URL')
    resend_api_key: str = Field(default='', validation_alias='RESEND_API_KEY')
    resend_from_email: str = Field(default='BuildShop <noreply@buildshop.ua>', validation_alias='RESEND_FROM_EMAIL')
    password_reset_ttl_minutes: int = Field(default=30, validation_alias='PASSWORD_RESET_TTL_MINUTES')
    report_font_path: str = Field(default='', validation_alias='REPORT_FONT_PATH')

    @field_validator('secret_key')
    def validate_secret_key(cls, v, info: ValidationInfo):
        """Ensure secret key is not the default dev key in production."""
        env = info.data.get('environment', 'development') if info.data else 'development'
        if v == 'dev-only-secret-change-me':
            if env in ('production', 'prod', 'staging'):
                raise ValueError(
                    'SECRET_KEY must not be the default dev key in production. '
                    'Set SECRET_KEY environment variable to a strong random value (min 32 chars).'
                )
        # In production, enforce minimum key length
        if env in ('production', 'prod'):
            if len(str(v)) < 32:
                raise ValueError('SECRET_KEY must be at least 32 characters in production')
        return v
    
    @field_validator('jwt_algorithm')
    def validate_jwt_algorithm(cls, v):
        """Ensure JWT algorithm is secure."""
        # HS256 is acceptable but RS256 is better for distributed systems
        valid_algorithms = ('HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512')
        if v not in valid_algorithms:
            raise ValueError(f'JWT_ALGORITHM must be one of {valid_algorithms}')
        # If RS* algorithm is selected ensure keys are provided via env
        if v.startswith('RS'):
            # JWT keys may be loaded from env vars JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
            # We cannot access instance values here, so just allow but runtime will validate
            pass
        return v

    @model_validator(mode='after')
    def keep_auth_cookies_distinct(self):
        if self.auth_cookie_name == self.refresh_cookie_name:
            if self.auth_cookie_name == 'refresh_token':
                self.auth_cookie_name = 'access_token'
            else:
                self.refresh_cookie_name = 'refresh_token'
        return self

    @field_validator('auth_cookie_samesite')
    def validate_auth_cookie_samesite(cls, v, info: ValidationInfo):
        allowed = {'lax', 'strict', 'none'}
        value = str(v or '').strip().lower()
        env = info.data.get('environment', 'development') if info.data else 'development'
        if env in ('production', 'prod') and value in ('', 'lax'):
            return 'none'
        if value not in allowed:
            raise ValueError(f'AUTH_COOKIE_SAMESITE must be one of {tuple(sorted(allowed))}')
        return value
    
    @field_validator('database_url')
    def validate_database_url(cls, v, info: ValidationInfo):
        """Validate database URL format."""
        if not v or len(v) < 10:
            raise ValueError('DATABASE_URL is invalid or missing')
        # Warn if SQLite in production (should use PostgreSQL)
        env = info.data.get('environment', 'development') if info.data else 'development'
        if v.startswith('sqlite') and env in ('production', 'prod'):
            import warnings
            warnings.warn('SQLite should not be used in production. Use PostgreSQL instead.')
        return v

    @field_validator('cors_origin_regex')
    def validate_cors_origin_regex(cls, v):
        if v is None or not str(v).strip():
            return None
        s = str(v).strip()
        try:
            re.compile(s)
        except re.error as e:
            raise ValueError(f'CORS_ORIGIN_REGEX is not a valid regex: {e}') from e
        return s
    
    @field_validator('auth_cookie_secure')
    def validate_auth_cookie_secure(cls, v, info: ValidationInfo):
        """Enforce secure cookies in production."""
        env = info.data.get('environment', 'development') if info.data else 'development'
        if env in ('production', 'prod'):
            if not v:
                raise ValueError('AUTH_COOKIE_SECURE must be True in production')
        return v

    @staticmethod
    def _format_der_as_pem(decoded_bytes: bytes, label: str) -> str:
        body = base64.b64encode(decoded_bytes).decode('ascii')
        wrapped = '\n'.join(textwrap.wrap(body, 64))
        return f'-----BEGIN {label}-----\n{wrapped}\n-----END {label}-----'

    @classmethod
    def _decode_pem_value(cls, value: Optional[str], encoded_value: Optional[str], label: str) -> Optional[str]:
        raw = str(value or '').strip()
        if raw:
            return raw.replace('\\n', '\n')

        encoded = str(encoded_value or '').strip()
        if not encoded:
            return None
        encoded = encoded.replace('\\n', '').replace('\r', '').replace('\n', '').strip()
        if len(encoded) % 4:
            encoded += '=' * (4 - (len(encoded) % 4))

        try:
            decoded_bytes = base64.b64decode(encoded)
        except Exception as e:
            raise ValueError(f'Invalid base64-encoded JWT key: {e}') from e

        try:
            decoded_text = decoded_bytes.decode('utf-8').strip()
        except UnicodeDecodeError:
            return cls._format_der_as_pem(decoded_bytes, label)

        if 'BEGIN' in decoded_text:
            return decoded_text.replace('\\n', '\n')

        return cls._format_der_as_pem(decoded_bytes, label)

    @property
    def resolved_jwt_private_key(self) -> Optional[str]:
        return self._decode_pem_value(self.jwt_private_key, self.jwt_private_key_b64, 'PRIVATE KEY')

    @property
    def resolved_jwt_public_key(self) -> Optional[str]:
        return self._decode_pem_value(self.jwt_public_key, self.jwt_public_key_b64, 'PUBLIC KEY')
    
    def get_cors_origins(self) -> List[str]:
        """Parse and normalize CORS origins from env (trim, add protocol if needed, drop trailing slash, dedupe)."""
        normalized: list[str] = []

        # Always allow the configured frontend origin as a safety net for deployments
        # (e.g. Render env vars can be incomplete or accidentally overwritten).
        frontend_origin = str(self.frontend_url or '').strip()
        if frontend_origin:
            if not frontend_origin.startswith('http://') and not frontend_origin.startswith('https://'):
                frontend_origin = f'https://{frontend_origin}'
            frontend_origin = frontend_origin.rstrip('/')
            normalized.append(frontend_origin)

        for origin in self.cors_origins.split(','):
            value = origin.strip()
            if not value:
                continue
            if value == "*":
                normalized.append(value)
                continue
            # Add https:// protocol if missing (e.g., "example.vercel.app" → "https://example.vercel.app")
            if not value.startswith('http://') and not value.startswith('https://'):
                value = f'https://{value}'
            value = value.rstrip('/')
            if value and value not in normalized:
                normalized.append(value)
        return normalized
    
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
        if settings.secret_key == 'dev-only-secret-change-me':  #nosec B105
            raise ValueError('SECRET_KEY must be configured in production')
        if settings.debug:
            raise ValueError('DEBUG mode must be disabled in production')
    if (settings.jwt_algorithm or 'HS256').startswith('RS'):
        if not settings.resolved_jwt_private_key:
            raise ValueError('JWT private key must be configured for RS* algorithms')
        if not settings.resolved_jwt_public_key:
            raise ValueError('JWT public key must be configured for RS* algorithms')

