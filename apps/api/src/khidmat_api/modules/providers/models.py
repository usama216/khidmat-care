"""Healthcare providers: profile, verification documents, services, areas and availability."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.enums import Gender
from khidmat_api.core.models import (
    Base,
    CreatedAtMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    enum_type,
)


class ProviderStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class DocumentType(StrEnum):
    CNIC_FRONT = "CNIC_FRONT"
    CNIC_BACK = "CNIC_BACK"
    DEGREE = "DEGREE"
    LICENSE = "LICENSE"
    OTHER = "OTHER"


class Provider(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "providers"
    __table_args__ = (
        CheckConstraint("experience_years >= 0", name="experience_not_negative"),
        CheckConstraint("rating_avg BETWEEN 0 AND 5", name="rating_avg_range"),
        CheckConstraint("rating_count >= 0", name="rating_count_not_negative"),
        Index("ix_providers_status_gender", "status", "gender"),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    gender: Mapped[Gender] = mapped_column(enum_type(Gender, "gender"))
    # The CNIC is encrypted so a database leak doesn't expose it. A keyed hash of the number
    # still lets the database enforce one account per CNIC.
    cnic_encrypted: Mapped[str] = mapped_column(Text)
    cnic_hash: Mapped[str] = mapped_column(String(128), unique=True)
    qualification: Mapped[str] = mapped_column(String(200))
    experience_years: Mapped[int]
    bio: Mapped[str | None] = mapped_column(Text)
    photo_file_id: Mapped[UUID | None] = mapped_column(ForeignKey("file_assets.id"), unique=True)
    status: Mapped[ProviderStatus] = mapped_column(
        enum_type(ProviderStatus, "status"), default=ProviderStatus.DRAFT
    )
    status_reason: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None]
    agreement_accepted_at: Mapped[datetime | None]
    # Each completed check with its time, e.g. {"cnic": "2026-11-06T10:00:00+00:00"}.
    # Who did it is in the audit log.
    verification_checks: Mapped[dict[str, str]] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    # Prepaid balance. Kept here for quick checks; wallet_transactions is the full history.
    balance_pkr: Mapped[int] = mapped_column(default=0, server_default="0")
    approved_at: Mapped[datetime | None]
    # Denormalised from reviews so listing and filtering providers doesn't aggregate each time.
    rating_avg: Mapped[float] = mapped_column(default=0)
    rating_count: Mapped[int] = mapped_column(default=0)


class ProviderService(Base):
    __tablename__ = "provider_services"

    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), primary_key=True
    )
    service_type_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_types.id"), primary_key=True, index=True
    )


class ProviderArea(Base):
    __tablename__ = "provider_areas"

    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), primary_key=True
    )
    area_id: Mapped[UUID] = mapped_column(ForeignKey("areas.id"), primary_key=True, index=True)


class ProviderDocument(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "provider_documents"

    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[DocumentType] = mapped_column(enum_type(DocumentType, "type"))
    file_id: Mapped[UUID] = mapped_column(ForeignKey("file_assets.id"), unique=True)
    verified_at: Mapped[datetime | None]


class Availability(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "availabilities"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="day_of_week_range"),
        CheckConstraint(
            "start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute",
            name="minutes_valid",
        ),
        Index("ix_availabilities_provider_id_day_of_week", "provider_id", "day_of_week"),
    )

    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"))
    day_of_week: Mapped[int]  # 0 = Sunday ... 6 = Saturday
    start_minute: Mapped[int]  # Minutes from midnight, Asia/Karachi. 540 = 09:00.
    end_minute: Mapped[int]
