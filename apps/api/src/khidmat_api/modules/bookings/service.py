"""The order lifecycle: booking, acceptance, sessions, contact rules and commission."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.enums import Gender
from khidmat_api.core.errors import ConflictError, ForbiddenError, NotFoundError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.bookings.models import (
    AssignmentStatus,
    Booking,
    BookingAssignment,
    BookingStatus,
    SessionEvent,
    SessionStatus,
    TreatmentSession,
)
from khidmat_api.modules.catalog.models import Area, ServicePackage, ServiceType
from khidmat_api.modules.catalog.settings_service import (
    get_platform_settings,
    require_commission_bps,
)
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.patients.models import Patient
from khidmat_api.modules.payments.models import Payment
from khidmat_api.modules.providers.models import Provider, ProviderStatus
from khidmat_api.modules.providers.service import (
    SESSION_MINUTES,
    get_availability,
    get_provider_lists,
    is_within_availability,
)
from khidmat_api.modules.wallet.service import charge_commission

# Numbers are exchanged from this point before a session, and cancelling stops.
CONTACT_AND_LOCK_WINDOW = timedelta(hours=2)
_OPEN_SESSION_STATUSES = (SessionStatus.SCHEDULED, SessionStatus.ON_THE_WAY, SessionStatus.ARRIVED)
_NEXT_STATUS = {
    SessionStatus.SCHEDULED: SessionStatus.ON_THE_WAY,
    SessionStatus.ON_THE_WAY: SessionStatus.ARRIVED,
    SessionStatus.ARRIVED: SessionStatus.COMPLETED,
}


class CancelLockedError(ConflictError):
    code = "cancel_locked"
    message = (
        "This session starts within 2 hours, so it can't be cancelled. Please contact support."
    )


def contact_visible(session_row: TreatmentSession, *, now: datetime | None = None) -> bool:
    """True only from 2 hours before an open session until that session ends."""
    now = now or datetime.now(UTC)
    return (
        session_row.status in _OPEN_SESSION_STATUSES
        and now >= session_row.scheduled_at - CONTACT_AND_LOCK_WINDOW
    )


def is_cancel_locked(session_row: TreatmentSession, *, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return session_row.scheduled_at - now <= CONTACT_AND_LOCK_WINDOW


def session_money(booking: Booking, sequence_done: int) -> tuple[int, int]:
    """Amount and commission for one session. The last session absorbs any rounding remainder."""
    base = booking.price_total_pkr // booking.sessions_count
    total_commission = round(booking.price_total_pkr * booking.commission_bps / 10000)
    base_commission = total_commission // booking.sessions_count
    if sequence_done + 1 >= booking.sessions_count:
        return (
            booking.price_total_pkr - base * (booking.sessions_count - 1),
            total_commission - base_commission * (booking.sessions_count - 1),
        )
    return base, base_commission


async def _require_bookable_provider(
    session: AsyncSession,
    provider_id: UUID,
    service_type_id: UUID,
    area_id: UUID,
    start_at: datetime,
) -> Provider:
    provider = await session.get(Provider, provider_id)
    if provider is None or provider.status != ProviderStatus.APPROVED:
        raise ConflictError("This physiotherapist isn't available.")
    minimum = (await get_platform_settings(session)).minimum_balance_pkr
    if provider.balance_pkr < minimum:
        raise ConflictError("This physiotherapist isn't available right now.")
    services, areas = await get_provider_lists(session, provider_id)
    if service_type_id not in services:
        raise ConflictError("This physiotherapist doesn't offer this treatment.")
    if area_id not in areas:
        raise ConflictError("This physiotherapist doesn't cover this area.")
    await _require_free_slot(session, provider, start_at)
    return provider


async def _require_free_slot(
    session: AsyncSession,
    provider: Provider,
    start_at: datetime,
    *,
    ignore_session: UUID | None = None,
) -> None:
    if not is_within_availability(await get_availability(session, provider.id), start_at):
        raise ConflictError("The physiotherapist isn't available at this time.")
    window = timedelta(minutes=SESSION_MINUTES)
    query = select(TreatmentSession.id).where(
        TreatmentSession.provider_id == provider.id,
        TreatmentSession.status.in_(_OPEN_SESSION_STATUSES),
        TreatmentSession.scheduled_at > start_at - window,
        TreatmentSession.scheduled_at < start_at + window,
    )
    if ignore_session is not None:
        query = query.where(TreatmentSession.id != ignore_session)
    if await session.scalar(query.limit(1)) is not None:
        raise ConflictError("This time was just taken. Please choose another.")


@dataclass(frozen=True)
class BookingInput:
    patient_id: UUID
    service_type_id: UUID
    package_id: UUID
    provider_id: UUID
    address_line: str
    area_id: UUID
    lat: float | None
    lng: float | None
    start_at: datetime
    condition: str
    preferred_gender: Gender | None


async def create_booking(session: AsyncSession, user: User, data: BookingInput) -> Booking:
    if data.start_at <= datetime.now(UTC) + timedelta(minutes=30):
        raise ConflictError("Choose a time at least 30 minutes from now.")
    patient = await session.get(Patient, data.patient_id)
    if patient is None or patient.owner_id != user.id:
        raise NotFoundError("This patient was not found.")
    package = await session.get(ServicePackage, data.package_id)
    if package is None or not package.is_active or package.service_type_id != data.service_type_id:
        raise ConflictError("This package isn't available.")
    service = await session.get(ServiceType, data.service_type_id)
    area = await session.get(Area, data.area_id)
    if service is None or not service.is_active or area is None or not area.is_active:
        raise ConflictError("This service or area isn't available.")
    commission = await require_commission_bps(session)
    await _require_bookable_provider(
        session, data.provider_id, data.service_type_id, data.area_id, data.start_at
    )

    booking = Booking(
        patient_id=patient.id,
        booked_by_id=user.id,
        service_type_id=data.service_type_id,
        package_id=package.id,
        provider_id=data.provider_id,
        preferred_provider_id=data.provider_id,
        preferred_gender=data.preferred_gender,
        status=BookingStatus.AWAITING_ACCEPTANCE,
        sessions_count=package.sessions_count,
        price_total_pkr=package.price_pkr,
        commission_bps=commission,
        address_line=data.address_line,
        area_id=data.area_id,
        lat=data.lat,
        lng=data.lng,
        preferred_start_at=data.start_at,
        condition=data.condition,
    )
    session.add(booking)
    await session.flush()
    session.add(
        BookingAssignment(
            booking_id=booking.id,
            provider_id=data.provider_id,
            assigned_by_id=user.id,
            status=AssignmentStatus.OFFERED,
        )
    )
    await session.commit()
    await session.refresh(booking)
    return booking


async def _open_assignment(session: AsyncSession, booking_id: UUID) -> BookingAssignment | None:
    return await session.scalar(
        select(BookingAssignment).where(
            BookingAssignment.booking_id == booking_id,
            BookingAssignment.status.in_((AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED)),
        )
    )


async def _add_session(
    session: AsyncSession, booking: Booking, provider_id: UUID, start_at: datetime, actor_id: UUID
) -> TreatmentSession:
    last = await session.scalar(
        select(func.max(TreatmentSession.sequence)).where(TreatmentSession.booking_id == booking.id)
    )
    row = TreatmentSession(
        booking_id=booking.id,
        provider_id=provider_id,
        sequence=(last or 0) + 1,
        scheduled_at=start_at,
        status=SessionStatus.SCHEDULED,
    )
    session.add(row)
    await session.flush()
    session.add(SessionEvent(session_id=row.id, status=SessionStatus.SCHEDULED, actor_id=actor_id))
    return row


async def _provider_booking(session: AsyncSession, booking_id: UUID, provider: Provider) -> Booking:
    booking = await session.get(Booking, booking_id, with_for_update=True)
    if booking is None or booking.provider_id != provider.id:
        raise NotFoundError("This job was not found.")
    return booking


async def respond_to_offer(
    session: AsyncSession,
    booking_id: UUID,
    provider: Provider,
    user: User,
    *,
    accept: bool,
    reason: str | None,
) -> Booking:
    booking = await _provider_booking(session, booking_id, provider)
    assignment = await _open_assignment(session, booking.id)
    if (
        booking.status != BookingStatus.AWAITING_ACCEPTANCE
        or assignment is None
        or assignment.status != AssignmentStatus.OFFERED
    ):
        raise ConflictError("This offer is no longer open.")
    assignment.responded_at = datetime.now(UTC)

    if accept:
        minimum = (await get_platform_settings(session)).minimum_balance_pkr
        if provider.balance_pkr < minimum:
            raise ConflictError(
                f"Your balance is below the Rs {minimum:,} minimum. Top up to accept new orders."
            )
        if provider.status != ProviderStatus.APPROVED:
            raise ForbiddenError("Your account isn't approved.")
        await _require_free_slot(session, provider, booking.preferred_start_at)
        assignment.status = AssignmentStatus.ACCEPTED
        booking.status = BookingStatus.ACTIVE
        await _add_session(session, booking, provider.id, booking.preferred_start_at, user.id)
    else:
        if not reason:
            raise ConflictError("Please give a reason.")
        assignment.status = AssignmentStatus.REJECTED
        assignment.reject_reason = reason
        booking.status = BookingStatus.PENDING_ASSIGNMENT
        booking.provider_id = None
    await session.commit()
    return booking


async def choose_new_provider(
    session: AsyncSession, booking_id: UUID, user: User, provider_id: UUID, start_at: datetime
) -> Booking:
    """After a rejection the patient picks someone else."""
    booking = await session.get(Booking, booking_id, with_for_update=True)
    if booking is None or booking.booked_by_id != user.id:
        raise NotFoundError("This booking was not found.")
    if booking.status != BookingStatus.PENDING_ASSIGNMENT:
        raise ConflictError("This booking can't be reassigned now.")
    return await _offer(session, booking, provider_id, start_at, assigned_by=user.id)


async def _offer(
    session: AsyncSession,
    booking: Booking,
    provider_id: UUID,
    start_at: datetime,
    *,
    assigned_by: UUID,
) -> Booking:
    if start_at <= datetime.now(UTC) + timedelta(minutes=30):
        raise ConflictError("Choose a time at least 30 minutes from now.")
    await _require_bookable_provider(
        session, provider_id, booking.service_type_id, booking.area_id, start_at
    )
    booking.provider_id = provider_id
    booking.preferred_start_at = start_at
    booking.status = BookingStatus.AWAITING_ACCEPTANCE
    session.add(
        BookingAssignment(
            booking_id=booking.id,
            provider_id=provider_id,
            assigned_by_id=assigned_by,
            status=AssignmentStatus.OFFERED,
        )
    )
    await session.commit()
    return booking


async def admin_assign_provider(
    session: AsyncSession,
    booking_id: UUID,
    provider_id: UUID,
    start_at: datetime,
    *,
    actor: User,
    ip_address: str,
) -> Booking:
    booking = await session.get(Booking, booking_id, with_for_update=True)
    if booking is None:
        raise NotFoundError("This booking was not found.")
    if booking.status not in {BookingStatus.PENDING_ASSIGNMENT, BookingStatus.AWAITING_ACCEPTANCE}:
        raise ConflictError("This booking can't be reassigned now.")
    open_assignment = await _open_assignment(session, booking.id)
    if open_assignment is not None:
        open_assignment.status = AssignmentStatus.WITHDRAWN
        open_assignment.responded_at = datetime.now(UTC)
        await session.flush()
    record_audit(
        session,
        actor_id=actor.id,
        action="booking.assigned",
        entity_type="booking",
        entity_id=str(booking.id),
        metadata={"provider_id": str(provider_id)},
        ip_address=ip_address,
    )
    return await _offer(session, booking, provider_id, start_at, assigned_by=actor.id)


async def schedule_next_session(
    session: AsyncSession, booking_id: UUID, provider: Provider, user: User, start_at: datetime
) -> TreatmentSession:
    booking = await _provider_booking(session, booking_id, provider)
    if booking.status != BookingStatus.ACTIVE:
        raise ConflictError("This booking isn't active.")
    if start_at <= datetime.now(UTC):
        raise ConflictError("Choose a future time.")
    used = await session.scalar(
        select(func.count())
        .select_from(TreatmentSession)
        .where(
            TreatmentSession.booking_id == booking.id,
            TreatmentSession.status.in_((*_OPEN_SESSION_STATUSES, SessionStatus.COMPLETED)),
        )
    )
    if (used or 0) >= booking.sessions_count:
        raise ConflictError("All sessions in this package are already scheduled.")
    await _require_free_slot(session, provider, start_at)
    row = await _add_session(session, booking, provider.id, start_at, user.id)
    await session.commit()
    return row


async def _get_provider_session(
    session: AsyncSession, session_id: UUID, provider: Provider
) -> tuple[TreatmentSession, Booking]:
    row = await session.get(TreatmentSession, session_id, with_for_update=True)
    if row is None or row.provider_id != provider.id:
        raise NotFoundError("This session was not found.")
    booking = await session.get(Booking, row.booking_id, with_for_update=True)
    if booking is None:
        raise NotFoundError("This session was not found.")
    return row, booking


async def _finish_booking_if_done(session: AsyncSession, booking: Booking) -> None:
    completed = await session.scalar(
        select(func.count())
        .select_from(TreatmentSession)
        .where(
            TreatmentSession.booking_id == booking.id,
            TreatmentSession.status == SessionStatus.COMPLETED,
        )
    )
    if (completed or 0) >= booking.sessions_count:
        booking.status = BookingStatus.COMPLETED


async def advance_session(
    session: AsyncSession,
    session_id: UUID,
    provider: Provider,
    user: User,
    target: SessionStatus,
    *,
    pain_score: int | None,
    notes: str | None,
) -> TreatmentSession:
    row, booking = await _get_provider_session(session, session_id, provider)
    if _NEXT_STATUS.get(row.status) != target:
        raise ConflictError("This session can't move to that status now.")
    now = datetime.now(UTC)
    if target == SessionStatus.ARRIVED:
        row.arrived_at = now
    if target == SessionStatus.COMPLETED:
        if pain_score is None:
            raise ConflictError("Enter the pain score before completing the session.")
        row.pain_score = pain_score
        row.notes = notes
        row.completed_at = now
        done = await session.scalar(
            select(func.count())
            .select_from(TreatmentSession)
            .where(
                TreatmentSession.booking_id == booking.id,
                TreatmentSession.status == SessionStatus.COMPLETED,
            )
        )
        amount, commission = session_money(booking, done or 0)
        session.add(
            Payment(
                booking_id=booking.id,
                session_id=row.id,
                amount_pkr=amount,
                commission_pkr=commission,
                provider_payout_pkr=amount - commission,
                collected_by_provider_id=provider.id,
                recorded_by_id=user.id,
                collected_at=now,
            )
        )
        await charge_commission(session, provider.id, row.id, commission)
    row.status = target
    session.add(SessionEvent(session_id=row.id, status=target, actor_id=user.id))
    await session.flush()
    if target == SessionStatus.COMPLETED:
        await _finish_booking_if_done(session, booking)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("This session was already completed.") from exc
    return row


async def _cancel_session_row(
    session: AsyncSession, row: TreatmentSession, actor_id: UUID, reason: str
) -> None:
    row.status = SessionStatus.CANCELLED
    row.cancel_reason = reason
    session.add(SessionEvent(session_id=row.id, status=SessionStatus.CANCELLED, actor_id=actor_id))


async def cancel_session(
    session: AsyncSession, session_id: UUID, user: User, reason: str, *, provider: Provider | None
) -> TreatmentSession:
    """The patient or the physiotherapist can cancel until 2 hours before the session."""
    row = await session.get(TreatmentSession, session_id, with_for_update=True)
    if row is None:
        raise NotFoundError("This session was not found.")
    booking = await session.get(Booking, row.booking_id)
    owns = (provider is not None and row.provider_id == provider.id) or (
        booking is not None and booking.booked_by_id == user.id
    )
    if not owns:
        raise NotFoundError("This session was not found.")
    if row.status != SessionStatus.SCHEDULED:
        raise ConflictError("This session can't be cancelled now.")
    if is_cancel_locked(row):
        raise CancelLockedError
    await _cancel_session_row(session, row, user.id, reason)
    await session.commit()
    return row


async def cancel_booking(
    session: AsyncSession, booking_id: UUID, user: User, reason: str
) -> Booking:
    booking = await session.get(Booking, booking_id, with_for_update=True)
    if booking is None or booking.booked_by_id != user.id:
        raise NotFoundError("This booking was not found.")
    if booking.status in {BookingStatus.COMPLETED, BookingStatus.CANCELLED}:
        raise ConflictError("This booking is already closed.")
    rows = list(
        await session.scalars(
            select(TreatmentSession).where(
                TreatmentSession.booking_id == booking.id,
                TreatmentSession.status.in_(_OPEN_SESSION_STATUSES),
            )
        )
    )
    if any(row.status != SessionStatus.SCHEDULED or is_cancel_locked(row) for row in rows):
        raise CancelLockedError
    for row in rows:
        await _cancel_session_row(session, row, user.id, reason)
    assignment = await _open_assignment(session, booking.id)
    if assignment is not None:
        assignment.status = AssignmentStatus.WITHDRAWN
    booking.status = BookingStatus.CANCELLED
    booking.cancel_reason = reason
    booking.cancelled_at = datetime.now(UTC)
    await session.commit()
    return booking


async def admin_close_session(
    session: AsyncSession,
    session_id: UUID,
    status: SessionStatus,
    reason: str,
    *,
    actor: User,
    ip_address: str,
) -> TreatmentSession:
    """Only staff can act inside the 2-hour lock. No commission is charged for these."""
    row = await session.get(TreatmentSession, session_id, with_for_update=True)
    if row is None:
        raise NotFoundError("This session was not found.")
    if row.status not in _OPEN_SESSION_STATUSES:
        raise ConflictError("This session is already closed.")
    row.status = status
    row.cancel_reason = reason
    session.add(SessionEvent(session_id=row.id, status=status, actor_id=actor.id))
    record_audit(
        session,
        actor_id=actor.id,
        action=f"session.{status.value.lower()}",
        entity_type="treatment_session",
        entity_id=str(row.id),
        metadata={"reason": reason},
        ip_address=ip_address,
    )
    await session.commit()
    return row


# Reading ----------------------------------------------------------------------------------------


async def list_sessions_for_bookings(
    session: AsyncSession, booking_ids: list[UUID]
) -> dict[UUID, list[TreatmentSession]]:
    if not booking_ids:
        return {}
    rows = await session.scalars(
        select(TreatmentSession)
        .where(TreatmentSession.booking_id.in_(booking_ids))
        .order_by(TreatmentSession.sequence)
    )
    grouped: dict[UUID, list[TreatmentSession]] = {}
    for row in rows:
        grouped.setdefault(row.booking_id, []).append(row)
    return grouped


async def list_bookings(
    session: AsyncSession,
    *,
    booked_by: UUID | None = None,
    provider_id: UUID | None = None,
    status: BookingStatus | None = None,
    offset: int,
    limit: int,
) -> tuple[list[Booking], int]:
    filters: list[Any] = []
    if booked_by is not None:
        filters.append(Booking.booked_by_id == booked_by)
    if provider_id is not None:
        filters.append(Booking.provider_id == provider_id)
    if status is not None:
        filters.append(Booking.status == status)
    total = await session.scalar(select(func.count()).select_from(Booking).where(*filters))
    rows = await session.scalars(
        select(Booking)
        .where(*filters)
        .order_by(Booking.created_at.desc(), Booking.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total or 0


async def busy_times(
    session: AsyncSession, provider_id: UUID, start: datetime, end: datetime
) -> list[datetime]:
    rows = await session.scalars(
        select(TreatmentSession.scheduled_at).where(
            TreatmentSession.provider_id == provider_id,
            TreatmentSession.status.in_(_OPEN_SESSION_STATUSES),
            TreatmentSession.scheduled_at >= start,
            TreatmentSession.scheduled_at < end,
        )
    )
    return list(rows)


async def count_bookings(session: AsyncSession, status: BookingStatus) -> int:
    count = await session.scalar(
        select(func.count()).select_from(Booking).where(Booking.status == status)
    )
    return count or 0
