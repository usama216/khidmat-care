"""Session ratings and complaints."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, enum_type


class ComplaintStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Review(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
        Index("ix_reviews_provider_id_rating", "provider_id", "rating"),
    )

    session_id: Mapped[UUID] = mapped_column(ForeignKey("treatment_sessions.id"), unique=True)
    reviewer_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id"))
    rating: Mapped[int]
    comment: Mapped[str | None] = mapped_column(Text)


class Complaint(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "complaints"
    __table_args__ = (Index("ix_complaints_status_created_at", "status", "created_at"),)

    booking_id: Mapped[UUID] = mapped_column(ForeignKey("bookings.id"), index=True)
    session_id: Mapped[UUID | None] = mapped_column(ForeignKey("treatment_sessions.id"), index=True)
    raised_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[ComplaintStatus] = mapped_column(
        enum_type(ComplaintStatus, "status"), default=ComplaintStatus.OPEN
    )
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None]
