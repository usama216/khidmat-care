"""Accounts and login credentials."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import (
    Base,
    CreatedAtMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    enum_type,
)


class Role(StrEnum):
    PATIENT = "PATIENT"
    PROVIDER = "PROVIDER"
    ADMIN = "ADMIN"
    OPERATIONS = "OPERATIONS"
    VERIFICATION = "VERIFICATION"
    FINANCE = "FINANCE"
    SUPPORT = "SUPPORT"


class Locale(StrEnum):
    EN = "EN"
    UR = "UR"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_signup_ip_hash_created_at", "signup_ip_hash", "created_at"),)

    phone: Mapped[str] = mapped_column(String(16), unique=True)  # E.164: +923001234567
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(enum_type(Role, "role"), default=Role.PATIENT)
    locale: Mapped[Locale] = mapped_column(enum_type(Locale, "locale"), default=Locale.EN)
    is_active: Mapped[bool] = mapped_column(default=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # Set for admin-issued temporary passwords. Blocks the dashboard until changed.
    must_change_password: Mapped[bool] = mapped_column(default=False, server_default="false")
    password_changed_at: Mapped[datetime | None]
    # Limits sign-ups from one address. A keyed hash, so the raw IP is never stored.
    signup_ip_hash: Mapped[str | None] = mapped_column(String(64))
    failed_login_count: Mapped[int] = mapped_column(default=0, server_default="0")
    locked_until: Mapped[datetime | None]


class OtpCode(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "otp_codes"
    __table_args__ = (Index("ix_otp_codes_phone_created_at", "phone", "created_at"),)

    phone: Mapped[str] = mapped_column(String(16))
    code_hash: Mapped[str] = mapped_column(String(128))  # The plain code is never stored.
    expires_at: Mapped[datetime]
    attempts: Mapped[int] = mapped_column(default=0)
    consumed_at: Mapped[datetime | None]


class RefreshToken(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    # Tokens from one login share a family, so reusing an old token can revoke all of them.
    family_id: Mapped[UUID] = mapped_column(index=True)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    user_agent: Mapped[str | None] = mapped_column(String(512))
    ip_address: Mapped[str | None] = mapped_column(String(45))
