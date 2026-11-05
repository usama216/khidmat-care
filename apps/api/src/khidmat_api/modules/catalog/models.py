"""What the platform sells and where: services, packages, areas and platform settings."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, UUIDPrimaryKeyMixin, enum_type


class ServiceCategory(StrEnum):
    PHYSIO = "PHYSIO"
    NURSING = "NURSING"
    DOCTOR = "DOCTOR"
    LAB = "LAB"


class Area(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "areas"
    __table_args__ = (UniqueConstraint("city", "name", name="uq_areas_city_name"),)

    name: Mapped[str] = mapped_column(String(80))
    name_urdu: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80), default="Lahore")
    is_active: Mapped[bool] = mapped_column(default=True)


class ServiceType(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "service_types"
    __table_args__ = (Index("ix_service_types_category_is_active", "category", "is_active"),)

    slug: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[ServiceCategory] = mapped_column(
        enum_type(ServiceCategory, "category"), default=ServiceCategory.PHYSIO
    )
    name: Mapped[str] = mapped_column(String(120))
    name_urdu: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    description_urdu: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)


class ServicePackage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "service_packages"
    __table_args__ = (
        CheckConstraint("sessions_count > 0", name="sessions_count_positive"),
        CheckConstraint("price_pkr >= 0", name="price_not_negative"),
        Index("ix_service_packages_service_type_id_is_active", "service_type_id", "is_active"),
    )

    service_type_id: Mapped[UUID] = mapped_column(ForeignKey("service_types.id"))
    sessions_count: Mapped[int]
    price_pkr: Mapped[int]  # Whole rupees for the package. Money is never stored as a float.
    is_active: Mapped[bool] = mapped_column(default=True)


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)  # e.g. commission.default_bps
    value: Mapped[Any] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
