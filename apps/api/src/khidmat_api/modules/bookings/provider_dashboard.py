"""The numbers on a physiotherapist's dashboard. Computed on request, so they're never stale."""

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.bookings.admin_detail import provider_booking_stats
from khidmat_api.modules.bookings.models import (
    Booking,
    BookingStatus,
    SessionStatus,
    TreatmentSession,
)
from khidmat_api.modules.bookings.service import session_money
from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.modules.catalog.settings_service import get_platform_settings
from khidmat_api.modules.patients.models import Patient
from khidmat_api.modules.providers.models import Provider
from khidmat_api.modules.providers.service import LOCAL_TIMEZONE
from khidmat_api.modules.wallet.models import WalletTransaction, WalletTransactionType

_UPCOMING_LIMIT = 5
_OPEN = (SessionStatus.SCHEDULED, SessionStatus.ON_THE_WAY, SessionStatus.ARRIVED)


class UpcomingSession(BaseModel):
    session_id: UUID
    booking_id: UUID
    booking_number: int
    sequence: int
    sessions_count: int
    scheduled_at: datetime
    status: str
    patient_name: str
    area_name: str
    service_name: str


class ProviderDashboard(BaseModel):
    status: str
    balance_pkr: int
    minimum_balance_pkr: int
    can_accept_orders: bool
    rating_avg: float
    rating_count: int
    new_offers: int
    active_orders: int
    sessions_today: int
    sessions_upcoming: int
    sessions_completed: int
    completed_this_month: int
    collected_this_month_pkr: int
    commission_this_month_pkr: int
    upcoming: list[UpcomingSession]


def _month_start(now: datetime) -> datetime:
    local = now.astimezone(LOCAL_TIMEZONE)
    return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)


def _day_bounds(now: datetime) -> tuple[datetime, datetime]:
    local = now.astimezone(LOCAL_TIMEZONE)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start.replace(hour=23, minute=59, second=59, microsecond=999_999)
    return start.astimezone(UTC), end.astimezone(UTC)


async def provider_dashboard(session: AsyncSession, provider: Provider) -> ProviderDashboard:
    now = datetime.now(UTC)
    month_start = _month_start(now)
    day_start, day_end = _day_bounds(now)
    platform = await get_platform_settings(session)
    stats = await provider_booking_stats(session, provider.id)

    async def _count_bookings(status: BookingStatus) -> int:
        count = await session.scalar(
            select(func.count())
            .select_from(Booking)
            .where(Booking.provider_id == provider.id, Booking.status == status)
        )
        return count or 0

    async def _count_sessions(*conditions: object) -> int:
        count = await session.scalar(
            select(func.count())
            .select_from(TreatmentSession)
            .where(TreatmentSession.provider_id == provider.id, *conditions)  # type: ignore[arg-type]
        )
        return count or 0

    # Cash collected this month: each completed session's share of its order's price.
    completed_rows = (
        await session.execute(
            select(TreatmentSession.sequence, Booking)
            .join(Booking, Booking.id == TreatmentSession.booking_id)
            .where(
                TreatmentSession.provider_id == provider.id,
                TreatmentSession.status == SessionStatus.COMPLETED,
                TreatmentSession.completed_at >= month_start,
            )
        )
    ).all()
    collected = sum(session_money(booking, sequence)[0] for sequence, booking in completed_rows)
    commission = await session.scalar(
        select(func.coalesce(func.sum(-WalletTransaction.amount_pkr), 0)).where(
            WalletTransaction.provider_id == provider.id,
            WalletTransaction.type == WalletTransactionType.COMMISSION,
            WalletTransaction.created_at >= month_start,
        )
    )

    upcoming_rows = (
        await session.execute(
            select(TreatmentSession, Booking)
            .join(Booking, Booking.id == TreatmentSession.booking_id)
            .where(
                TreatmentSession.provider_id == provider.id,
                TreatmentSession.status.in_(_OPEN),
                # Includes today's earlier sessions that are still in progress.
                TreatmentSession.scheduled_at >= day_start,
            )
            .order_by(TreatmentSession.scheduled_at)
            .limit(_UPCOMING_LIMIT)
        )
    ).all()
    upcoming = []
    for row, booking in upcoming_rows:
        patient = await session.get(Patient, booking.patient_id)
        area = await session.get(Area, booking.area_id)
        service = await session.get(ServiceType, booking.service_type_id)
        upcoming.append(
            UpcomingSession(
                session_id=row.id,
                booking_id=booking.id,
                booking_number=booking.number,
                sequence=row.sequence,
                sessions_count=booking.sessions_count,
                scheduled_at=row.scheduled_at,
                status=row.status.value,
                patient_name=patient.name if patient else "",
                area_name=area.name if area else "",
                service_name=service.name if service else "",
            )
        )

    return ProviderDashboard(
        status=provider.status.value,
        balance_pkr=provider.balance_pkr,
        minimum_balance_pkr=platform.minimum_balance_pkr,
        can_accept_orders=provider.balance_pkr >= platform.minimum_balance_pkr,
        rating_avg=provider.rating_avg,
        rating_count=provider.rating_count,
        new_offers=await _count_bookings(BookingStatus.AWAITING_ACCEPTANCE),
        active_orders=await _count_bookings(BookingStatus.ACTIVE),
        sessions_today=await _count_sessions(
            TreatmentSession.status.in_((*_OPEN, SessionStatus.COMPLETED)),
            TreatmentSession.scheduled_at >= day_start,
            TreatmentSession.scheduled_at <= day_end,
        ),
        sessions_upcoming=await _count_sessions(
            TreatmentSession.status == SessionStatus.SCHEDULED,
            TreatmentSession.scheduled_at >= now,
        ),
        sessions_completed=stats["sessions_completed"],
        completed_this_month=len(completed_rows),
        collected_this_month_pkr=collected,
        commission_this_month_pkr=int(commission or 0),
        upcoming=upcoming,
    )
