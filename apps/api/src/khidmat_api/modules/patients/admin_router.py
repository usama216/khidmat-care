"""Patient accounts for staff: who booked, for whom, and how often."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import NotFoundError
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.phone import like_patterns
from khidmat_api.modules.bookings.models import Booking, BookingStatus
from khidmat_api.modules.identity.dependencies import BookingManagerDep
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.patients.models import Patient
from khidmat_api.modules.patients.router import PatientView

router = APIRouter(prefix="/admin/patients", tags=["admin"])


class PatientAccountRow(BaseModel):
    id: UUID
    name: str | None
    phone: str
    is_active: bool
    created_at: datetime
    people_count: int
    orders_count: int


class PatientAccountDetail(PatientAccountRow):
    email: str | None
    active_orders: int
    completed_orders: int
    cancelled_orders: int
    spent_pkr: int
    people: list[PatientView]


def _people_count() -> object:
    return (
        select(func.count())
        .select_from(Patient)
        .where(Patient.owner_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )


def _orders_count() -> object:
    return (
        select(func.count())
        .select_from(Booking)
        .where(Booking.booked_by_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )


@router.get("", summary="Patient accounts, newest first")
async def list_accounts(
    _: BookingManagerDep,
    session: SessionDep,
    params: PageParamsDep,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> Page[PatientAccountRow]:
    filters = [User.role == Role.PATIENT]
    patterns = like_patterns(search or "")
    if patterns:
        filters.append(
            or_(
                *(User.name.ilike(pattern, escape="\\") for pattern in patterns),
                *(User.phone.ilike(pattern, escape="\\") for pattern in patterns),
            )
        )
    total = await session.scalar(select(func.count()).select_from(User).where(*filters))
    rows = await session.execute(
        select(User, _people_count(), _orders_count())  # type: ignore[call-overload]
        .where(*filters)
        .order_by(User.created_at.desc(), User.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    )
    return Page(
        items=[
            PatientAccountRow(
                id=user.id,
                name=user.name,
                phone=user.phone,
                is_active=user.is_active,
                created_at=user.created_at,
                people_count=people,
                orders_count=orders,
            )
            for user, people, orders in rows.all()
        ],
        total=total or 0,
        page=params.page,
        page_size=params.page_size,
    )


@router.get("/{user_id}", summary="One patient account")
async def account_detail(
    user_id: UUID, _: BookingManagerDep, session: SessionDep
) -> PatientAccountDetail:
    user = await session.get(User, user_id)
    if user is None or user.role != Role.PATIENT:
        raise NotFoundError("This patient account was not found.")
    people = await session.scalars(
        select(Patient).where(Patient.owner_id == user.id).order_by(Patient.created_at)
    )
    counts = dict(
        (
            await session.execute(
                select(Booking.status, func.count())
                .where(Booking.booked_by_id == user.id)
                .group_by(Booking.status)
            )
        ).all()
    )
    spent = await session.scalar(
        select(func.coalesce(func.sum(Booking.price_total_pkr), 0)).where(
            Booking.booked_by_id == user.id, Booking.status == BookingStatus.COMPLETED
        )
    )
    people_list = [PatientView.model_validate(row) for row in people]
    return PatientAccountDetail(
        id=user.id,
        name=user.name,
        phone=user.phone,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        people_count=len(people_list),
        orders_count=sum(counts.values()),
        active_orders=sum(
            counts.get(status, 0)
            for status in (
                BookingStatus.ACTIVE,
                BookingStatus.AWAITING_ACCEPTANCE,
                BookingStatus.PENDING_ASSIGNMENT,
            )
        ),
        completed_orders=counts.get(BookingStatus.COMPLETED, 0),
        cancelled_orders=counts.get(BookingStatus.CANCELLED, 0),
        spent_pkr=int(spent or 0),
        people=people_list,
    )
