"""The full record of one order for staff: who did what and when, money, ratings and complaints.

Built from the tables that already record each step (assignments, session events, reviews,
complaints and the wallet ledger), so the history can't drift from what actually happened.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.storage import Storage
from khidmat_api.modules.bookings.models import (
    AssignmentStatus,
    Booking,
    BookingAssignment,
    BookingStatus,
    SessionEvent,
    SessionStatus,
    TreatmentSession,
)
from khidmat_api.modules.bookings.service import session_money
from khidmat_api.modules.bookings.views import StaffBookingView, staff_booking_views
from khidmat_api.modules.feedback.models import Complaint, Review
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.providers.models import Provider
from khidmat_api.modules.wallet.models import WalletTransaction, WalletTransactionType

TimelineType = Literal[
    "ORDER_PLACED",
    "OFFERED",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
    "SESSION",
    "RATED",
    "COMPLAINT_RAISED",
    "COMPLAINT_CLOSED",
    "ORDER_CANCELLED",
]


_TIMELINE_ORDER: dict[TimelineType, int] = {
    "ORDER_PLACED": 0,
    "OFFERED": 1,
    "ACCEPTED": 2,
    "REJECTED": 2,
    "WITHDRAWN": 2,
    "SESSION": 3,
    "RATED": 4,
    "COMPLAINT_RAISED": 5,
    "COMPLAINT_CLOSED": 6,
    "ORDER_CANCELLED": 7,
}

_RESPONSE_TYPES: dict[str, TimelineType] = {
    AssignmentStatus.ACCEPTED: "ACCEPTED",
    AssignmentStatus.REJECTED: "REJECTED",
    AssignmentStatus.WITHDRAWN: "WITHDRAWN",
}


class StaffSessionDetail(BaseModel):
    id: UUID
    sequence: int
    provider_id: UUID
    provider_name: str | None
    scheduled_at: datetime
    status: str
    arrived_at: datetime | None
    completed_at: datetime | None
    pain_score: int | None
    notes: str | None
    cancel_reason: str | None
    price_pkr: int
    commission_pkr: int
    commission_charged: bool
    rating: int | None
    review_comment: str | None


class AssignmentView(BaseModel):
    provider_id: UUID
    provider_name: str | None
    status: str
    reject_reason: str | None
    offered_at: datetime
    responded_at: datetime | None
    assigned_by_name: str | None


class BookingComplaint(BaseModel):
    id: UUID
    text: str
    status: str
    resolution: str | None
    created_at: datetime
    resolved_at: datetime | None


class TimelineEntry(BaseModel):
    at: datetime
    type: TimelineType
    actor_name: str | None = None
    session_sequence: int | None = None
    status: str | None = None
    note: str | None = None


class StaffBookingDetail(BaseModel):
    booking: StaffBookingView
    patient_id: UUID
    booked_by_id: UUID
    provider_id: UUID | None
    preferred_gender: str | None
    lat: float | None
    lng: float | None
    cancelled_at: datetime | None
    updated_at: datetime
    commission_total_pkr: int
    commission_charged_pkr: int
    sessions: list[StaffSessionDetail]
    assignments: list[AssignmentView]
    complaints: list[BookingComplaint]
    timeline: list[TimelineEntry]


class _Names:
    """Looks up each user or provider name once per request."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._users: dict[UUID, str | None] = {}
        self._providers: dict[UUID, str | None] = {}

    async def user(self, user_id: UUID | None) -> str | None:
        if user_id is None:
            return None
        if user_id not in self._users:
            user = await self._session.get(User, user_id)
            self._users[user_id] = (user.name or user.phone) if user else None
        return self._users[user_id]

    async def provider(self, provider_id: UUID) -> str | None:
        if provider_id not in self._providers:
            provider = await self._session.get(Provider, provider_id)
            self._providers[provider_id] = await self.user(provider.user_id) if provider else None
        return self._providers[provider_id]


async def staff_booking_detail(
    session: AsyncSession, storage: Storage, booking: Booking
) -> StaffBookingDetail:
    names = _Names(session)
    view = (await staff_booking_views(session, storage, [booking]))[0]

    rows = list(
        await session.scalars(
            select(TreatmentSession)
            .where(TreatmentSession.booking_id == booking.id)
            .order_by(TreatmentSession.sequence)
        )
    )
    session_ids = [row.id for row in rows]
    sequence_of = {row.id: row.sequence for row in rows}
    reviews = {
        review.session_id: review
        for review in await session.scalars(
            select(Review).where(Review.session_id.in_(session_ids))
        )
    }
    charged = {
        row.session_id: -row.amount_pkr
        for row in await session.scalars(
            select(WalletTransaction).where(
                WalletTransaction.session_id.in_(session_ids),
                WalletTransaction.type == WalletTransactionType.COMMISSION,
            )
        )
        if row.session_id is not None
    }

    sessions: list[StaffSessionDetail] = []
    for row in rows:
        price, commission = session_money(booking, row.sequence)
        review = reviews.get(row.id)
        sessions.append(
            StaffSessionDetail(
                id=row.id,
                sequence=row.sequence,
                provider_id=row.provider_id,
                provider_name=await names.provider(row.provider_id),
                scheduled_at=row.scheduled_at,
                status=row.status.value,
                arrived_at=row.arrived_at,
                completed_at=row.completed_at,
                pain_score=row.pain_score,
                notes=row.notes,
                cancel_reason=row.cancel_reason,
                price_pkr=price,
                commission_pkr=commission,
                commission_charged=row.id in charged,
                rating=review.rating if review else None,
                review_comment=review.comment if review else None,
            )
        )

    assignment_rows = list(
        await session.scalars(
            select(BookingAssignment)
            .where(BookingAssignment.booking_id == booking.id)
            .order_by(BookingAssignment.created_at)
        )
    )
    assignments = [
        AssignmentView(
            provider_id=row.provider_id,
            provider_name=await names.provider(row.provider_id),
            status=row.status.value,
            reject_reason=row.reject_reason,
            offered_at=row.created_at,
            responded_at=row.responded_at,
            assigned_by_name=await names.user(row.assigned_by_id),
        )
        for row in assignment_rows
    ]

    complaint_rows = list(
        await session.scalars(
            select(Complaint)
            .where(Complaint.booking_id == booking.id)
            .order_by(Complaint.created_at)
        )
    )
    complaints = [
        BookingComplaint(
            id=row.id,
            text=row.text,
            status=row.status.value,
            resolution=row.resolution,
            created_at=row.created_at,
            resolved_at=row.resolved_at,
        )
        for row in complaint_rows
    ]

    timeline = [
        TimelineEntry(
            at=booking.created_at,
            type="ORDER_PLACED",
            actor_name=await names.user(booking.booked_by_id),
        )
    ]
    for assignment in assignments:
        timeline.append(
            TimelineEntry(
                at=assignment.offered_at,
                type="OFFERED",
                actor_name=assignment.assigned_by_name,
                note=assignment.provider_name,
            )
        )
        response = _RESPONSE_TYPES.get(assignment.status)
        if assignment.responded_at is not None and response is not None:
            timeline.append(
                TimelineEntry(
                    at=assignment.responded_at,
                    type=response,
                    actor_name=assignment.provider_name,
                    note=assignment.reject_reason,
                )
            )
    # Event times come from the database clock, which reads the start of each transaction, while
    # acceptance times come from Python. So each session's steps are kept in the order they were
    # saved, and the first session never shows before the acceptance that created it.
    accepted_at = max(
        (a.responded_at for a in assignments if a.status == "ACCEPTED" and a.responded_at),
        default=None,
    )
    if session_ids:
        events = await session.scalars(
            select(SessionEvent)
            .where(SessionEvent.session_id.in_(session_ids))
            # UUIDv7 ids are time-ordered, so they keep events from one transaction in order.
            .order_by(SessionEvent.created_at, SessionEvent.id)
        )
        latest: dict[UUID, datetime] = {}
        for event in events:
            sequence = sequence_of.get(event.session_id)
            at = event.created_at
            if sequence == 1 and accepted_at is not None:
                at = max(at, accepted_at)
            at = max(at, latest.get(event.session_id, at))
            latest[event.session_id] = at
            timeline.append(
                TimelineEntry(
                    at=at,
                    type="SESSION",
                    actor_name=await names.user(event.actor_id),
                    session_sequence=sequence_of.get(event.session_id),
                    status=event.status.value,
                )
            )
    for session_id, review in reviews.items():
        timeline.append(
            TimelineEntry(
                at=review.created_at,
                type="RATED",
                actor_name=await names.user(review.reviewer_id),
                session_sequence=sequence_of.get(session_id),
                status=str(review.rating),
                note=review.comment,
            )
        )
    for complaint in complaints:
        timeline.append(TimelineEntry(at=complaint.created_at, type="COMPLAINT_RAISED"))
        if complaint.resolved_at is not None:
            timeline.append(
                TimelineEntry(
                    at=complaint.resolved_at,
                    type="COMPLAINT_CLOSED",
                    status=complaint.status,
                    note=complaint.resolution,
                )
            )
    if booking.cancelled_at is not None:
        timeline.append(
            TimelineEntry(
                at=booking.cancelled_at, type="ORDER_CANCELLED", note=booking.cancel_reason
            )
        )
    # Steps with exactly the same time, such as those saved together, keep their logical order.
    timeline.sort(key=lambda entry: (entry.at, _TIMELINE_ORDER[entry.type]))

    commission_total = sum(
        session_money(booking, n)[1] for n in range(1, booking.sessions_count + 1)
    )
    return StaffBookingDetail(
        booking=view,
        patient_id=booking.patient_id,
        booked_by_id=booking.booked_by_id,
        provider_id=booking.provider_id,
        preferred_gender=booking.preferred_gender.value if booking.preferred_gender else None,
        lat=booking.lat,
        lng=booking.lng,
        cancelled_at=booking.cancelled_at,
        updated_at=booking.updated_at,
        commission_total_pkr=commission_total,
        commission_charged_pkr=sum(charged.values()),
        sessions=sessions,
        assignments=assignments,
        complaints=complaints,
        timeline=timeline,
    )


async def provider_booking_stats(session: AsyncSession, provider_id: UUID) -> dict[str, int]:
    """Counts shown on a physiotherapist's record and dashboard."""
    completed = await session.scalar(
        select(func.count())
        .select_from(TreatmentSession)
        .where(
            TreatmentSession.provider_id == provider_id,
            TreatmentSession.status == SessionStatus.COMPLETED,
        )
    )
    cancelled = await session.scalar(
        select(func.count())
        .select_from(TreatmentSession)
        .where(
            TreatmentSession.provider_id == provider_id,
            TreatmentSession.status.in_((SessionStatus.CANCELLED, SessionStatus.NO_SHOW)),
        )
    )
    orders = await session.scalar(
        select(func.count()).select_from(Booking).where(Booking.provider_id == provider_id)
    )
    active = await session.scalar(
        select(func.count())
        .select_from(Booking)
        .where(Booking.provider_id == provider_id, Booking.status == BookingStatus.ACTIVE)
    )
    rejected = await session.scalar(
        select(func.count())
        .select_from(BookingAssignment)
        .where(
            BookingAssignment.provider_id == provider_id,
            BookingAssignment.status == AssignmentStatus.REJECTED,
        )
    )
    return {
        "sessions_completed": completed or 0,
        "sessions_cancelled": cancelled or 0,
        "orders_total": orders or 0,
        "orders_active": active or 0,
        "offers_rejected": rejected or 0,
    }
