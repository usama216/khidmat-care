"""Bookings, provider assignments and the treatment sessions they produce."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.enums import Gender
from khidmat_api.core.models import (
    Base,
    CreatedAtMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    enum_type,
)


class BookingStatus(StrEnum):
    PENDING_ASSIGNMENT = "PENDING_ASSIGNMENT"
    AWAITING_ACCEPTANCE = "AWAITING_ACCEPTANCE"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class AssignmentStatus(StrEnum):
    OFFERED = "OFFERED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class SessionStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    ON_THE_WAY = "ON_THE_WAY"
    ARRIVED = "ARRIVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class Booking(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("sessions_count > 0", name="sessions_count_positive"),
        CheckConstraint("price_total_pkr >= 0", name="price_not_negative"),
        CheckConstraint("commission_bps BETWEEN 0 AND 10000", name="commission_bps_range"),
        CheckConstraint("lat BETWEEN -90 AND 90", name="lat_range"),
        CheckConstraint("lng BETWEEN -180 AND 180", name="lng_range"),
        Index("ix_bookings_status_created_at", "status", "created_at"),
    )

    # Short number for phone and WhatsApp support, e.g. KC-1001. Never used for access control.
    number: Mapped[int] = mapped_column(Identity(start=1001), unique=True)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    booked_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    service_type_id: Mapped[UUID] = mapped_column(ForeignKey("service_types.id"), index=True)
    package_id: Mapped[UUID] = mapped_column(ForeignKey("service_packages.id"), index=True)
    provider_id: Mapped[UUID | None] = mapped_column(ForeignKey("providers.id"), index=True)
    preferred_provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id"), index=True
    )
    preferred_gender: Mapped[Gender | None] = mapped_column(enum_type(Gender, "preferred_gender"))
    status: Mapped[BookingStatus] = mapped_column(
        enum_type(BookingStatus, "status"), default=BookingStatus.AWAITING_ACCEPTANCE
    )

    # Copied when booking, so later price or address edits don't rewrite history.
    sessions_count: Mapped[int]
    price_total_pkr: Mapped[int]
    commission_bps: Mapped[int]  # Basis points: 2000 = 20%.
    address_line: Mapped[str] = mapped_column(String(500))
    area_id: Mapped[UUID] = mapped_column(ForeignKey("areas.id"), index=True)
    lat: Mapped[float | None]
    lng: Mapped[float | None]

    preferred_start_at: Mapped[datetime]
    condition: Mapped[str] = mapped_column(Text)
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None]


class BookingAttachment(Base):
    __tablename__ = "booking_attachments"

    booking_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[UUID] = mapped_column(
        ForeignKey("file_assets.id"), primary_key=True, unique=True
    )


class BookingAssignment(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """One offer to a provider. The provider accepts or rejects a whole booking once."""

    __tablename__ = "booking_assignments"
    __table_args__ = (
        Index(
            "uq_booking_assignments_one_open_per_booking",
            "booking_id",
            unique=True,
            postgresql_where=text("status IN ('OFFERED', 'ACCEPTED')"),
        ),
        Index("ix_booking_assignments_booking_id", "booking_id"),
        Index("ix_booking_assignments_provider_id_status", "provider_id", "status"),
    )

    booking_id: Mapped[UUID] = mapped_column(ForeignKey("bookings.id"))
    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id"))
    assigned_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        enum_type(AssignmentStatus, "status"), default=AssignmentStatus.OFFERED
    )
    reject_reason: Mapped[str | None] = mapped_column(Text)
    responded_at: Mapped[datetime | None]


class TreatmentSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "treatment_sessions"
    __table_args__ = (
        UniqueConstraint("booking_id", "sequence", name="uq_treatment_sessions_booking_sequence"),
        CheckConstraint("sequence > 0", name="sequence_positive"),
        CheckConstraint("pain_score BETWEEN 0 AND 10", name="pain_score_range"),
        Index("ix_treatment_sessions_provider_id_scheduled_at", "provider_id", "scheduled_at"),
    )

    booking_id: Mapped[UUID] = mapped_column(ForeignKey("bookings.id"))
    # Can differ from the booking's provider when a replacement covers a session.
    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id"))
    sequence: Mapped[int]
    scheduled_at: Mapped[datetime]
    status: Mapped[SessionStatus] = mapped_column(
        enum_type(SessionStatus, "status"), default=SessionStatus.SCHEDULED
    )
    arrived_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    pain_score: Mapped[int | None]
    notes: Mapped[str | None] = mapped_column(Text)
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class SessionEvent(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Status history, used to track reliability and settle disputes."""

    __tablename__ = "session_events"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("treatment_sessions.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[SessionStatus] = mapped_column(enum_type(SessionStatus, "status"))
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
