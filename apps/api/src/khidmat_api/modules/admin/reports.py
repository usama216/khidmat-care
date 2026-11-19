"""Business reports: orders, sessions, money, demand and the busiest physiotherapists.

Months are calendar months in Lahore time, so a session at 1 am on the 1st counts in the new month.
"""

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from khidmat_api.modules.bookings.models import (
    AssignmentStatus,
    Booking,
    BookingAssignment,
    BookingStatus,
)
from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.payments.models import Payment
from khidmat_api.modules.providers.models import Provider
from khidmat_api.modules.providers.service import LOCAL_TIMEZONE

_ZONE = "Asia/Karachi"


class MonthRow(BaseModel):
    month: str  # "2026-11"
    orders: int
    completed_orders: int
    cancelled_orders: int
    sessions_completed: int
    collected_pkr: int
    commission_pkr: int


class CountRow(BaseModel):
    name: str
    orders: int


class PhysioRow(BaseModel):
    provider_id: UUID
    name: str | None
    sessions_completed: int
    collected_pkr: int
    commission_pkr: int
    rating_avg: float
    rating_count: int


class ReportTotals(BaseModel):
    orders: int
    sessions_completed: int
    collected_pkr: int
    commission_pkr: int
    new_patients: int
    offers_rejected: int
    offers_expired: int
    needs_physio_now: int


class Report(BaseModel):
    months: int
    since: datetime
    totals: ReportTotals
    by_month: list[MonthRow]
    status_counts: dict[str, int]
    by_service: list[CountRow]
    by_area: list[CountRow]
    top_physios: list[PhysioRow]


def _month_start(months: int) -> datetime:
    """The first moment of the month `months - 1` months ago, in Lahore time."""
    now = datetime.now(UTC).astimezone(LOCAL_TIMEZONE)
    year, month = now.year, now.month - (months - 1)
    while month <= 0:
        month += 12
        year -= 1
    return datetime(year, month, 1, tzinfo=LOCAL_TIMEZONE)


def _month_key(column: InstrumentedAttribute[datetime]) -> ColumnElement[str]:
    return func.to_char(func.timezone(_ZONE, column), "YYYY-MM")


def _month_keys(since: datetime, months: int) -> list[str]:
    keys = []
    year, month = since.year, since.month
    for _ in range(months):
        keys.append(f"{year}-{month:02d}")
        month += 1
        if month > 12:
            month, year = 1, year + 1
    return keys


async def build_report(session: AsyncSession, months: int) -> Report:
    since = _month_start(months)
    keys = _month_keys(since, months)
    counts = [name for name in MonthRow.model_fields if name != "month"]
    rows: dict[str, dict[str, int]] = {key: dict.fromkeys(counts, 0) for key in keys}

    ordered_month = _month_key(Booking.created_at)
    ordered = await session.execute(
        select(ordered_month, Booking.status, func.count())
        .where(Booking.created_at >= since)
        .group_by(ordered_month, Booking.status)
    )
    for key, status, count in ordered:
        if key not in rows:
            continue
        rows[key]["orders"] += count
        if status == BookingStatus.COMPLETED:
            rows[key]["completed_orders"] += count
        elif status == BookingStatus.CANCELLED:
            rows[key]["cancelled_orders"] += count

    paid_month = _month_key(Payment.collected_at)
    paid = await session.execute(
        select(
            paid_month,
            func.count(),
            func.coalesce(func.sum(Payment.amount_pkr), 0),
            func.coalesce(func.sum(Payment.commission_pkr), 0),
        )
        .where(Payment.collected_at >= since)
        .group_by(paid_month)
    )
    for key, count, amount, commission in paid:
        if key in rows:
            rows[key]["sessions_completed"] = count
            rows[key]["collected_pkr"] = int(amount)
            rows[key]["commission_pkr"] = int(commission)
    by_month = [MonthRow(month=key, **rows[key]) for key in keys]

    status_counts = {
        status.value: count
        for status, count in await session.execute(
            select(Booking.status, func.count()).group_by(Booking.status)
        )
    }
    by_service = [
        CountRow(name=name, orders=count)
        for name, count in await session.execute(
            select(ServiceType.name, func.count(Booking.id))
            .join(Booking, Booking.service_type_id == ServiceType.id)
            .where(Booking.created_at >= since)
            .group_by(ServiceType.name)
            .order_by(func.count(Booking.id).desc())
        )
    ]
    by_area = [
        CountRow(name=name, orders=count)
        for name, count in await session.execute(
            select(Area.name, func.count(Booking.id))
            .join(Booking, Booking.area_id == Area.id)
            .where(Booking.created_at >= since)
            .group_by(Area.name)
            .order_by(func.count(Booking.id).desc())
            .limit(15)
        )
    ]
    sessions_done = func.count(Payment.id)
    top_physios = [
        PhysioRow(
            provider_id=provider.id,
            name=name,
            sessions_completed=count,
            collected_pkr=int(amount),
            commission_pkr=int(commission),
            rating_avg=provider.rating_avg,
            rating_count=provider.rating_count,
        )
        for provider, name, count, amount, commission in await session.execute(
            select(
                Provider,
                User.name,
                sessions_done,
                func.coalesce(func.sum(Payment.amount_pkr), 0),
                func.coalesce(func.sum(Payment.commission_pkr), 0),
            )
            .join(Payment, Payment.collected_by_provider_id == Provider.id)
            .join(User, User.id == Provider.user_id)
            .where(Payment.collected_at >= since)
            .group_by(Provider.id, User.name)
            .order_by(sessions_done.desc())
            .limit(10)
        )
    ]

    responses = dict(
        (
            await session.execute(
                select(BookingAssignment.status, func.count())
                .where(
                    BookingAssignment.responded_at >= since,
                    BookingAssignment.status.in_(
                        (AssignmentStatus.REJECTED, AssignmentStatus.EXPIRED)
                    ),
                )
                .group_by(BookingAssignment.status)
            )
        ).all()
    )
    new_patients = await session.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == Role.PATIENT, User.created_at >= since)
    )
    totals = ReportTotals(
        orders=sum(row.orders for row in by_month),
        sessions_completed=sum(row.sessions_completed for row in by_month),
        collected_pkr=sum(row.collected_pkr for row in by_month),
        commission_pkr=sum(row.commission_pkr for row in by_month),
        new_patients=new_patients or 0,
        offers_rejected=responses.get(AssignmentStatus.REJECTED, 0),
        offers_expired=responses.get(AssignmentStatus.EXPIRED, 0),
        needs_physio_now=status_counts.get(BookingStatus.PENDING_ASSIGNMENT.value, 0),
    )
    return Report(
        months=months,
        since=since,
        totals=totals,
        by_month=by_month,
        status_counts=status_counts,
        by_service=by_service,
        by_area=by_area,
        top_physios=top_physios,
    )
