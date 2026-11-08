"""Application settings, read from the environment and validated at startup.

A missing or invalid value stops the app from booting, so configuration mistakes
surface at deploy time instead of on a patient's request.
"""

from enum import StrEnum
from functools import lru_cache
from typing import Annotated, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

CommaSeparated = Annotated[list[str], NoDecode]


_LOCAL_IP_HASH_SECRET = "local-development-only"  # noqa: S105
_LOCAL_JWT_SECRET = "local-development-only-jwt-signing-secret"  # noqa: S105
_LOCAL_ENCRYPTION_KEY = "local-development-only-encryption-key"
_MIN_JWT_SECRET_LENGTH = 32


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Environment = Environment.LOCAL
    log_level: str = "INFO"

    database_url: SecretStr
    db_pool_size: int = Field(default=5, ge=1)
    db_max_overflow: int = Field(default=5, ge=0)
    # Serverless hosts freeze idle instances, so pooled connections can't be reused safely.
    db_null_pool: bool = False

    cors_origins: CommaSeparated = []
    allowed_hosts: CommaSeparated = ["localhost", "127.0.0.1"]

    # Header holding the real client IP when a trusted proxy sits in front of the API.
    # Leave empty when clients connect directly, because clients can forge this header.
    client_ip_header: str | None = None
    # Keys the IP hashes used for rate limiting, so stored hashes can't be reversed by guessing.
    ip_hash_secret: SecretStr = SecretStr(_LOCAL_IP_HASH_SECRET)
    contact_rate_limit_per_hour: int = Field(default=5, ge=1)

    # Signs access tokens. Required when deployed.
    jwt_secret: SecretStr = SecretStr(_LOCAL_JWT_SECRET)
    # Encrypts CNIC numbers. Required when deployed. Changing it makes stored values unreadable.
    encryption_key: SecretStr = SecretStr(_LOCAL_ENCRYPTION_KEY)
    access_token_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_days: int = Field(default=14, ge=1, le=60)

    # Uploads go to this S3 bucket when set, otherwise to a local folder in development.
    s3_bucket: str | None = None
    s3_region: str = "ap-southeast-2"
    # Our own names, because serverless hosts reserve AWS_ACCESS_KEY_ID and set it to their own
    # role. Passed to S3 explicitly so the host's credentials are never used by mistake.
    s3_access_key_id: str | None = None
    s3_secret_access_key: SecretStr | None = None
    local_upload_dir: str = ".uploads"

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def _split_commas(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("database_url")
    @classmethod
    def _require_async_driver(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must start with postgresql+asyncpg://")
        return value

    @model_validator(mode="after")
    def _forbid_wildcards_when_deployed(self) -> Self:
        if self.environment in {Environment.STAGING, Environment.PRODUCTION}:
            if "*" in self.cors_origins:
                raise ValueError("CORS_ORIGINS cannot contain * because cookies are used")
            if "*" in self.allowed_hosts:
                raise ValueError("ALLOWED_HOSTS cannot contain * when deployed")
            if self.ip_hash_secret.get_secret_value() == _LOCAL_IP_HASH_SECRET:
                raise ValueError("IP_HASH_SECRET must be set when deployed")
            secret = self.jwt_secret.get_secret_value()
            if secret == _LOCAL_JWT_SECRET or len(secret) < _MIN_JWT_SECRET_LENGTH:
                raise ValueError("JWT_SECRET must be a long random value when deployed")
            key = self.encryption_key.get_secret_value()
            if key == _LOCAL_ENCRYPTION_KEY or len(key) < _MIN_JWT_SECRET_LENGTH:
                raise ValueError("ENCRYPTION_KEY must be a long random value when deployed")
            if self.s3_bucket and not (self.s3_access_key_id and self.s3_secret_access_key):
                raise ValueError(
                    "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set with S3_BUCKET"
                )
        return self

    @property
    def docs_enabled(self) -> bool:
        return self.environment is not Environment.PRODUCTION

    @property
    def secure_cookies(self) -> bool:
        return self.environment in {Environment.STAGING, Environment.PRODUCTION}

    @property
    def json_logs(self) -> bool:
        return self.environment in {Environment.STAGING, Environment.PRODUCTION}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # Required values come from the environment.
