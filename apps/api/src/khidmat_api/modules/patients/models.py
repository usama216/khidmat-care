"""People receiving care, and saved addresses.

A patient is separate from a login account: one family member can manage both parents, and an
elderly patient doesn't need a phone login.
"""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.enums import Gender
from khidmat_api.core.models import (
    Base,
    CreatedAtMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    enum_type,
)


class PatientRelation(StrEnum):
    SELF = "SELF"
    PARENT = "PARENT"
    SPOUSE = "SPOUSE"
    CHILD = "CHILD"
    SIBLING = "SIBLING"
    OTHER = "OTHER"


class Patient(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "patients"
    __table_args__ = (CheckConstraint("birth_year >= 1900", name="birth_year_valid"),)

    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    gender: Mapped[Gender] = mapped_column(enum_type(Gender, "gender"))
    birth_year: Mapped[int | None]  # Families often know the age, not the exact birth date.
    relation: Mapped[PatientRelation] = mapped_column(
        enum_type(PatientRelation, "relation"), default=PatientRelation.SELF
    )


class Address(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "addresses"
    __table_args__ = (
        CheckConstraint("lat BETWEEN -90 AND 90", name="lat_range"),
        CheckConstraint("lng BETWEEN -180 AND 180", name="lng_range"),
        Index(
            "uq_addresses_one_default_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str | None] = mapped_column(String(60))
    address_line: Mapped[str] = mapped_column(String(500))
    area_id: Mapped[UUID] = mapped_column(ForeignKey("areas.id"), index=True)
    lat: Mapped[float]
    lng: Mapped[float]
    is_default: Mapped[bool] = mapped_column(default=False)
