"""When a physiotherapist can be booked: weekly hours, slot length, time off, sessions and holds.

Every check that decides whether a time is free goes through this module, so the calendar a
patient sees, the slot list staff use and the check made when booking can never disagree.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from khidmat_api.core.errors import ConflictError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.bookings.models import (
    AssignmentStatus,
    Booking,
    BookingAssignment,
    BookingStatus,
    SessionStatus,
    TreatmentSession,
)
from khidmat_api.modules.providers.models import Availability, Provider, ProviderTimeOff
from khidmat_api.modules.providers.service import LOCAL_TIMEZONE, get_availability

OPEN_SESSION_STATUSES = (SessionStatus.SCHEDULED, SessionStatus.ON_THE_WAY, SessionStatus.ARRIVED)
# Patients can't book a time that starts sooner than this.
BOOKING_LEAD = timedelta(minutes=30)
BOOKING_HORIZON_DAYS = 60
# The longest a session can run. Used to find sessions that started before a window but overlap it.
_LONGEST_SESSION = timedelta(hours=3)

Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class Slot:
    start_at: datetime
    available: bool


@dataclass(frozen=True)
class DayPlan:
    day: date
    slots: list[Slot]


def overlaps(first: Interval, second: Interval) -> bool:
    return first[0] < second[1] and second[0] < first[1]


def local_midnight(day: date) -> datetime:
    return datetime.combine(day, time.min, LOCAL_TIMEZONE)


def _weekday(day: date) -> int:
    return (day.weekday() + 1) % 7  # Python's Monday=0 becomes our Sunday=0.


def hold_active(now: datetime | None = None) -> ColumnElement[bool]:
    """Offers that still hold their time. A missing deadline holds until someone acts."""
    now = now or datetime.now(UTC)
    return or_(Booking.hold_expires_at.is_(None), Booking.hold_expires_at > now)


async def busy_intervals(
    session: AsyncSession,
    provider_id: UUID,
    start: datetime,
    end: datetime,
    *,
    ignore_session: UUID | None = None,
    ignore_booking: UUID | None = None,
) -> list[Interval]:
    """Open sessions plus offers still waiting for a reply, which hold their time."""
    sessions = select(TreatmentSession.scheduled_at, TreatmentSession.duration_minutes).where(
        TreatmentSession.provider_id == provider_id,
        TreatmentSession.status.in_(OPEN_SESSION_STATUSES),
        TreatmentSession.scheduled_at >= start - _LONGEST_SESSION,
        TreatmentSession.scheduled_at < end,
    )
    if ignore_session is not None:
        sessions = sessions.where(TreatmentSession.id != ignore_session)
    holds = select(Booking.preferred_start_at, Booking.duration_minutes).where(
        Booking.provider_id == provider_id,
        Booking.status == BookingStatus.AWAITING_ACCEPTANCE,
        hold_active(),
        Booking.preferred_start_at >= start - _LONGEST_SESSION,
        Booking.preferred_start_at < end,
    )
    if ignore_booking is not None:
        holds = holds.where(Booking.id != ignore_booking)
    rows = [*(await session.execute(sessions)).all(), *(await session.execute(holds)).all()]
    intervals = [(at, at + timedelta(minutes=minutes)) for at, minutes in rows]
    return [interval for interval in intervals if overlaps(interval, (start, end))]


async def time_off_intervals(
    session: AsyncSession, provider_id: UUID, start: datetime, end: datetime
) -> list[Interval]:
    rows = await session.execute(
        select(ProviderTimeOff.start_at, ProviderTimeOff.end_at).where(
            ProviderTimeOff.provider_id == provider_id,
            ProviderTimeOff.start_at < end,
            ProviderTimeOff.end_at > start,
        )
    )
    return [(row.start_at, row.end_at) for row in rows]


def fits_weekly_hours(rows: list[Availability], start: datetime, minutes: int) -> bool:
    local = start.astimezone(LOCAL_TIMEZONE)
    minute = local.hour * 60 + local.minute
    return any(
        row.day_of_week == _weekday(local.date())
        and row.start_minute <= minute
        and minute + minutes <= row.end_minute
        for row in rows
    )


def plan_day(
    rows: list[Availability],
    day: date,
    *,
    slot_minutes: int,
    busy: list[Interval],
    time_off: list[Interval],
    earliest: datetime,
) -> list[Slot]:
    """Every start time on a day. Taken times stay in the list, marked unavailable.

    Times inside time off, in the past or too soon to reach are left out entirely: they were
    never open, so there is nothing to show.
    """
    length = timedelta(minutes=slot_minutes)
    slots: dict[datetime, Slot] = {}
    for row in rows:
        if row.day_of_week != _weekday(day):
            continue
        minute = row.start_minute
        while minute + slot_minutes <= row.end_minute:
            start = local_midnight(day) + timedelta(minutes=minute)
            minute += slot_minutes
            interval = (start, start + length)
            if start < earliest or any(overlaps(interval, off) for off in time_off):
                continue
            taken = any(overlaps(interval, other) for other in busy)
            slots[start] = Slot(start_at=start, available=not taken)
    return [slots[key] for key in sorted(slots)]


def booking_window(now: datetime | None = None) -> tuple[date, date]:
    today = (now or datetime.now(UTC)).astimezone(LOCAL_TIMEZONE).date()
    return today, today + timedelta(days=BOOKING_HORIZON_DAYS)


async def plan_days(
    session: AsyncSession, provider: Provider, first: date, days: int
) -> list[DayPlan]:
    """The bookable calendar for a run of days, limited to today and the next 60 days."""
    today, last = booking_window()
    start_day = max(first, today)
    end_day = min(first + timedelta(days=days), last + timedelta(days=1))
    if start_day >= end_day:
        return []
    start, end = local_midnight(start_day), local_midnight(end_day)
    rows = await get_availability(session, provider.id)
    busy = await busy_intervals(session, provider.id, start, end)
    time_off = await time_off_intervals(session, provider.id, start, end)
    earliest = datetime.now(UTC) + BOOKING_LEAD
    plans = []
    for offset in range((end_day - start_day).days):
        day = start_day + timedelta(days=offset)
        plans.append(
            DayPlan(
                day=day,
                slots=plan_day(
                    rows,
                    day,
                    slot_minutes=provider.slot_minutes,
                    busy=busy,
                    time_off=time_off,
                    earliest=earliest,
                ),
            )
        )
    return plans


async def free_slots(session: AsyncSession, provider: Provider, day: date) -> list[datetime]:
    plans = await plan_days(session, provider, day, 1)
    return [slot.start_at for plan in plans for slot in plan.slots if slot.available]


async def require_free_slot(
    session: AsyncSession,
    provider: Provider,
    start_at: datetime,
    minutes: int,
    *,
    ignore_session: UUID | None = None,
    ignore_booking: UUID | None = None,
    within_hours: bool = True,
) -> None:
    """Free means no session, waiting offer or time off then. Booking from a calendar also needs
    the time inside weekly hours; an open request picked by the physio doesn't, because picking
    it is their own yes to that time."""
    if within_hours and not fits_weekly_hours(
        await get_availability(session, provider.id), start_at, minutes
    ):
        raise ConflictError("The physiotherapist isn't available at this time.")
    interval = (start_at, start_at + timedelta(minutes=minutes))
    if await time_off_intervals(session, provider.id, *interval):
        raise ConflictError("The physiotherapist is away at this time. Please choose another.")
    busy = await busy_intervals(
        session,
        provider.id,
        *interval,
        ignore_session=ignore_session,
        ignore_booking=ignore_booking,
    )
    if busy:
        raise ConflictError("This time was just taken. Please choose another.")


# Holds ------------------------------------------------------------------------------------------


def hold_deadline(now: datetime, start_at: datetime, hours: int) -> datetime:
    """When an offer's hold runs out: after the set hours, or 1 hour before the visit if sooner.

    A visit less than about an hour away can still be accepted until 10 minutes before it.
    """
    deadline = now + timedelta(hours=hours)
    latest = start_at - timedelta(hours=1)
    if latest <= now + timedelta(minutes=15):
        latest = start_at - timedelta(minutes=10)
    return min(deadline, latest)


async def release_offer(
    session: AsyncSession,
    booking: Booking,
    *,
    outcome: AssignmentStatus,
    actor_id: UUID | None,
    ip_address: str | None = None,
) -> None:
    """End a waiting offer and send the order back to the team to find someone else."""
    assignment = await session.scalar(
        select(BookingAssignment).where(
            BookingAssignment.booking_id == booking.id,
            BookingAssignment.status == AssignmentStatus.OFFERED,
        )
    )
    now = datetime.now(UTC)
    if assignment is not None:
        assignment.status = outcome
        assignment.responded_at = now
    provider_id = booking.provider_id
    booking.status = BookingStatus.PENDING_ASSIGNMENT
    booking.provider_id = None
    booking.hold_expires_at = None
    record_audit(
        session,
        actor_id=actor_id,
        action="booking.hold_expired"
        if outcome == AssignmentStatus.EXPIRED
        else "booking.hold_released",
        entity_type="booking",
        entity_id=str(booking.id),
        metadata={"provider_id": str(provider_id)} if provider_id else None,
        ip_address=ip_address,
    )


async def expire_holds(session: AsyncSession) -> list[Booking]:
    """Release every offer whose reply time has passed. Safe to call on any request.

    Nothing else needs to run on a timer: an expired hold already stops blocking the calendar,
    and this tidies up the order's status the next time anyone looks.
    """
    rows = list(
        await session.scalars(
            select(Booking)
            .where(
                Booking.status == BookingStatus.AWAITING_ACCEPTANCE,
                Booking.hold_expires_at <= datetime.now(UTC),
            )
            .with_for_update(skip_locked=True)
            .limit(100)
        )
    )
    for booking in rows:
        await release_offer(session, booking, outcome=AssignmentStatus.EXPIRED, actor_id=None)
    if rows:
        await session.commit()
    return rows
