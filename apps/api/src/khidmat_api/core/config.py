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

    seed_admin_phone: str | None = None

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
        return self

    @property
    def docs_enabled(self) -> bool:
        return self.environment is not Environment.PRODUCTION

    @property
    def json_logs(self) -> bool:
        return self.environment in {Environment.STAGING, Environment.PRODUCTION}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # Required values come from the environment.
