"""Ratings after sessions, and complaints."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.bookings.models import Booking, SessionStatus, TreatmentSession
from khidmat_api.modules.feedback.models import Complaint, ComplaintStatus, Review
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.providers.service import update_provider_rating

LOW_RATING = 2


async def create_review(
    session: AsyncSession, session_id: UUID, user: User, rating: int, comment: str | None
) -> Review:
    row = await session.get(TreatmentSession, session_id)
    booking = await session.get(Booking, row.booking_id) if row else None
    if row is None or booking is None or booking.booked_by_id != user.id:
        raise NotFoundError("This session was not found.")
    if row.status != SessionStatus.COMPLETED:
        raise ConflictError("You can rate a session after it's completed.")
    review = Review(
        session_id=row.id,
        reviewer_id=user.id,
        provider_id=row.provider_id,
        rating=rating,
        comment=comment,
    )
    session.add(review)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("You already rated this session.") from exc
    await update_provider_rating(session, row.provider_id, rating)
    await session.commit()
    return review


async def reviews_for_sessions(
    session: AsyncSession, session_ids: list[UUID]
) -> dict[UUID, Review]:
    if not session_ids:
        return {}
    rows = await session.scalars(select(Review).where(Review.session_id.in_(session_ids)))
    return {row.session_id: row for row in rows}


async def create_complaint(
    session: AsyncSession, booking_id: UUID, user: User, text: str, session_id: UUID | None
) -> Complaint:
    booking = await session.get(Booking, booking_id)
    if booking is None or booking.booked_by_id != user.id:
        raise NotFoundError("This booking was not found.")
    complaint = Complaint(
        booking_id=booking.id, session_id=session_id, raised_by_id=user.id, text=text
    )
    session.add(complaint)
    await session.commit()
    return complaint


async def list_complaints(
    session: AsyncSession,
    *,
    status: ComplaintStatus | None,
    offset: int,
    limit: int,
    booking_ids: list[UUID] | None = None,
) -> tuple[list[Complaint], int]:
    filters: list[Any] = [Complaint.status == status] if status is not None else []
    if booking_ids is not None:
        filters.append(Complaint.booking_id.in_(booking_ids))
    total = await session.scalar(select(func.count()).select_from(Complaint).where(*filters))
    rows = await session.scalars(
        select(Complaint)
        .where(*filters)
        .order_by(Complaint.created_at.desc(), Complaint.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total or 0


async def list_reviews(
    session: AsyncSession, *, provider_id: UUID | None, offset: int, limit: int
) -> tuple[list[Review], int]:
    filters = [Review.provider_id == provider_id] if provider_id is not None else []
    total = await session.scalar(select(func.count()).select_from(Review).where(*filters))
    rows = await session.scalars(
        select(Review)
        .where(*filters)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total or 0


async def list_low_ratings(session: AsyncSession, *, limit: int) -> list[Review]:
    rows = await session.scalars(
        select(Review)
        .where(Review.rating <= LOW_RATING)
        .order_by(Review.created_at.desc())
        .limit(limit)
    )
    return list(rows)


async def update_complaint(
    session: AsyncSession,
    complaint_id: UUID,
    status: ComplaintStatus,
    resolution: str | None,
    *,
    actor: User,
    ip_address: str,
) -> Complaint:
    complaint = await session.get(Complaint, complaint_id)
    if complaint is None:
        raise NotFoundError("This complaint was not found.")
    closing = status in {ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED}
    if closing and not resolution:
        raise ConflictError("Write what was decided before closing this complaint.")
    complaint.status = status
    complaint.resolution = resolution
    complaint.resolved_at = datetime.now(UTC) if closing else None
    record_audit(
        session,
        actor_id=actor.id,
        action="complaint.updated",
        entity_type="complaint",
        entity_id=str(complaint.id),
        metadata={"status": status.value},
        ip_address=ip_address,
    )
    await session.commit()
    return complaint


async def count_open_complaints(session: AsyncSession) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(Complaint)
        .where(Complaint.status.in_((ComplaintStatus.OPEN, ComplaintStatus.IN_PROGRESS)))
    )
    return count or 0
