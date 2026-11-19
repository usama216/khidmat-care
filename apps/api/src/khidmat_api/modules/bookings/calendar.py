"""A physiotherapist's calendar: sessions, offers waiting for a reply and time off.

The physiotherapist sees it in their panel, and staff see the same view on the physio's record.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Literal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.modules.bookings.models import (
    Booking,
    BookingStatus,
    TreatmentSession,
)
from khidmat_api.modules.bookings.schedule import (
    OPEN_SESSION_STATUSES,
    hold_active,
    local_midnight,
)
from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.modules.patients.models import Patient
from khidmat_api.modules.providers.models import Provider, ProviderTimeOff
from khidmat_api.modules.providers.service import get_availability

MAX_CALENDAR_DAYS = 42
MAX_TIME_OFF = timedelta(days=62)


class WeeklyHours(BaseModel):
    day_of_week: int
    start_minute: int
    end_minute: int


class TimeOffView(BaseModel):
    id: UUID
    start_at: datetime
    end_at: datetime
    reason: str | None


class CalendarEvent(BaseModel):
    kind: Literal["SESSION", "OFFER"]
    booking_id: UUID
    booking_number: int
    session_id: UUID | None
    sequence: int | None
    sessions_count: int
    start_at: datetime
    end_at: datetime
    # A session's status, or AWAITING for an offer that still needs a reply.
    status: str
    patient_name: str
    service_name: str
    area_name: str
    visit_type: str
    hold_expires_at: datetime | None


class CalendarView(BaseModel):
    start: date
    days: int
    slot_minutes: int
    weekly_hours: list[WeeklyHours]
    time_off: list[TimeOffView]
    events: list[CalendarEvent]


async def _labels(
    session: AsyncSession, bookings: list[Booking]
) -> dict[UUID, tuple[str, str, str]]:
    labels: dict[UUID, tuple[str, str, str]] = {}
    for booking in bookings:
        patient = await session.get(Patient, booking.patient_id)
        service = await session.get(ServiceType, booking.service_type_id)
        area = await session.get(Area, booking.area_id)
        labels[booking.id] = (
            patient.name if patient else "",
            service.name if service else "",
            area.name if area else "",
        )
    return labels


async def provider_calendar(
    session: AsyncSession, provider: Provider, first: date, days: int
) -> CalendarView:
    days = max(1, min(days, MAX_CALENDAR_DAYS))
    start, end = local_midnight(first), local_midnight(first + timedelta(days=days))
    session_rows = list(
        await session.execute(
            select(TreatmentSession, Booking)
            .join(Booking, Booking.id == TreatmentSession.booking_id)
            .where(
                TreatmentSession.provider_id == provider.id,
                TreatmentSession.scheduled_at >= start,
                TreatmentSession.scheduled_at < end,
            )
            .order_by(TreatmentSession.scheduled_at)
        )
    )
    offers = list(
        await session.scalars(
            select(Booking).where(
                Booking.provider_id == provider.id,
                Booking.status == BookingStatus.AWAITING_ACCEPTANCE,
                hold_active(),
                Booking.preferred_start_at >= start,
                Booking.preferred_start_at < end,
            )
        )
    )
    labels = await _labels(session, [booking for _, booking in session_rows] + offers)

    events = [
        CalendarEvent(
            kind="SESSION",
            booking_id=booking.id,
            booking_number=booking.number,
            session_id=row.id,
            sequence=row.sequence,
            sessions_count=booking.sessions_count,
            start_at=row.scheduled_at,
            end_at=row.scheduled_at + timedelta(minutes=row.duration_minutes),
            status=row.status.value,
            patient_name=labels[booking.id][0],
            service_name=labels[booking.id][1],
            area_name=labels[booking.id][2],
            visit_type=booking.visit_type.value,
            hold_expires_at=None,
        )
        for row, booking in session_rows
    ]
    events += [
        CalendarEvent(
            kind="OFFER",
            booking_id=booking.id,
            booking_number=booking.number,
            session_id=None,
            sequence=None,
            sessions_count=booking.sessions_count,
            start_at=booking.preferred_start_at,
            end_at=booking.preferred_start_at + timedelta(minutes=booking.duration_minutes),
            status="AWAITING",
            patient_name=labels[booking.id][0],
            service_name=labels[booking.id][1],
            area_name=labels[booking.id][2],
            visit_type=booking.visit_type.value,
            hold_expires_at=booking.hold_expires_at,
        )
        for booking in offers
    ]
    events.sort(key=lambda event: event.start_at)

    time_off = await session.scalars(
        select(ProviderTimeOff)
        .where(
            ProviderTimeOff.provider_id == provider.id,
            ProviderTimeOff.start_at < end,
            ProviderTimeOff.end_at > start,
        )
        .order_by(ProviderTimeOff.start_at)
    )
    return CalendarView(
        start=first,
        days=days,
        slot_minutes=provider.slot_minutes,
        weekly_hours=[
            WeeklyHours(
                day_of_week=row.day_of_week,
                start_minute=row.start_minute,
                end_minute=row.end_minute,
            )
            for row in await get_availability(session, provider.id)
        ],
        time_off=[
            TimeOffView(id=row.id, start_at=row.start_at, end_at=row.end_at, reason=row.reason)
            for row in time_off
        ],
        events=events,
    )


async def add_time_off(
    session: AsyncSession,
    provider: Provider,
    start_at: datetime,
    end_at: datetime,
    reason: str | None,
) -> ProviderTimeOff:
    """Block time. Booked sessions and waiting offers must be dealt with first, so a patient is
    never left with a visit nobody will come to."""
    if end_at <= start_at:
        raise ConflictError("The end must be after the start.")
    if end_at <= datetime.now(UTC):
        raise ConflictError("This time has already passed.")
    if end_at - start_at > MAX_TIME_OFF:
        raise ConflictError("Block at most 62 days at a time.")
    booked = (
        await session.execute(
            select(Booking.number, TreatmentSession.scheduled_at, TreatmentSession.duration_minutes)
            .join(Booking, Booking.id == TreatmentSession.booking_id)
            .where(
                TreatmentSession.provider_id == provider.id,
                TreatmentSession.status.in_(OPEN_SESSION_STATUSES),
                TreatmentSession.scheduled_at < end_at,
                TreatmentSession.scheduled_at >= start_at - timedelta(hours=3),
            )
        )
    ).all()
    for number, at, minutes in booked:
        if at + timedelta(minutes=minutes) > start_at:
            raise ConflictError(
                f"You have a session for order KC-{number} in this time. "
                "Cancel it or contact support before blocking this time."
            )
    waiting = await session.scalar(
        select(Booking.number).where(
            Booking.provider_id == provider.id,
            Booking.status == BookingStatus.AWAITING_ACCEPTANCE,
            hold_active(),
            Booking.preferred_start_at < end_at,
            Booking.preferred_start_at >= start_at - timedelta(hours=3),
        )
    )
    if waiting is not None:
        raise ConflictError(
            f"Order KC-{waiting} is waiting for your reply in this time. Reply to it first."
        )
    row = ProviderTimeOff(
        provider_id=provider.id, start_at=start_at, end_at=end_at, reason=reason or None
    )
    session.add(row)
    await session.commit()
    return row


async def delete_time_off(session: AsyncSession, provider: Provider, time_off_id: UUID) -> None:
    result = await session.execute(
        delete(ProviderTimeOff).where(
            ProviderTimeOff.id == time_off_id, ProviderTimeOff.provider_id == provider.id
        )
    )
    if not result.rowcount:  # type: ignore[attr-defined]
        raise NotFoundError("This blocked time was not found.")
    await session.commit()
