"""Staff handling of complaints, ratings and low ratings."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.database import SessionDep
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.bookings.models import Booking, TreatmentSession
from khidmat_api.modules.feedback.models import Complaint, ComplaintStatus, Review
from khidmat_api.modules.feedback.service import (
    list_complaints,
    list_low_ratings,
    list_reviews,
    update_complaint,
)
from khidmat_api.modules.identity.dependencies import (
    ComplaintManagerDep,
    ReviewViewerDep,
    SettingsDep,
)
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.providers.models import Provider

router = APIRouter(prefix="/admin", tags=["admin"])


class ComplaintView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    session_id: UUID | None
    text: str
    status: ComplaintStatus
    resolution: str | None
    resolved_at: datetime | None
    created_at: datetime


class ComplaintDetailView(ComplaintView):
    booking_number: int | None
    session_sequence: int | None
    raised_by_name: str | None
    raised_by_phone: str | None
    provider_id: UUID | None
    provider_name: str | None


class ComplaintUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ComplaintStatus
    resolution: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = (
        None
    )


class ReviewView(BaseModel):
    id: UUID
    session_id: UUID
    provider_id: UUID
    provider_name: str | None
    booking_id: UUID | None
    booking_number: int | None
    session_sequence: int | None
    reviewer_name: str | None
    rating: int
    comment: str | None
    created_at: datetime


async def _user(session: AsyncSession, user_id: UUID | None) -> User | None:
    return await session.get(User, user_id) if user_id else None


async def _provider_name(session: AsyncSession, provider_id: UUID | None) -> str | None:
    provider = await session.get(Provider, provider_id) if provider_id else None
    owner = await _user(session, provider.user_id) if provider else None
    return owner.name if owner else None


async def _complaint_view(session: AsyncSession, row: Complaint) -> ComplaintDetailView:
    booking = await session.get(Booking, row.booking_id)
    treatment = await session.get(TreatmentSession, row.session_id) if row.session_id else None
    raised_by = await _user(session, row.raised_by_id)
    # A complaint about one session names whoever did that session.
    provider_id = treatment.provider_id if treatment else (booking.provider_id if booking else None)
    return ComplaintDetailView(
        **ComplaintView.model_validate(row).model_dump(),
        booking_number=booking.number if booking else None,
        session_sequence=treatment.sequence if treatment else None,
        raised_by_name=raised_by.name if raised_by else None,
        raised_by_phone=raised_by.phone if raised_by else None,
        provider_id=provider_id,
        provider_name=await _provider_name(session, provider_id),
    )


async def _review_view(session: AsyncSession, row: Review) -> ReviewView:
    treatment = await session.get(TreatmentSession, row.session_id)
    booking = await session.get(Booking, treatment.booking_id) if treatment else None
    reviewer = await _user(session, row.reviewer_id)
    return ReviewView(
        id=row.id,
        session_id=row.session_id,
        provider_id=row.provider_id,
        provider_name=await _provider_name(session, row.provider_id),
        booking_id=booking.id if booking else None,
        booking_number=booking.number if booking else None,
        session_sequence=treatment.sequence if treatment else None,
        reviewer_name=reviewer.name if reviewer else None,
        rating=row.rating,
        comment=row.comment,
        created_at=row.created_at,
    )


@router.get("/complaints", summary="Complaints, newest first")
async def complaints(
    _: ComplaintManagerDep,
    session: SessionDep,
    params: PageParamsDep,
    status: ComplaintStatus | None = None,
    provider_id: UUID | None = None,
) -> Page[ComplaintDetailView]:
    booking_ids = (
        list(await session.scalars(select(Booking.id).where(Booking.provider_id == provider_id)))
        if provider_id is not None
        else None
    )
    rows, total = await list_complaints(
        session,
        status=status,
        booking_ids=booking_ids,
        offset=params.offset,
        limit=params.page_size,
    )
    return Page(
        items=[await _complaint_view(session, row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.patch("/complaints/{complaint_id}", summary="Update or close a complaint")
async def update(
    complaint_id: UUID,
    payload: ComplaintUpdate,
    actor: ComplaintManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ComplaintDetailView:
    complaint = await update_complaint(
        session,
        complaint_id,
        payload.status,
        payload.resolution,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return await _complaint_view(session, complaint)


@router.get("/reviews", summary="Ratings, newest first")
async def reviews(
    _: ReviewViewerDep,
    session: SessionDep,
    params: PageParamsDep,
    provider_id: UUID | None = None,
) -> Page[ReviewView]:
    rows, total = await list_reviews(
        session, provider_id=provider_id, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[await _review_view(session, row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get("/low-ratings", summary="Recent ratings of 2 stars or below")
async def low_ratings(_: ComplaintManagerDep, session: SessionDep) -> list[ReviewView]:
    return [await _review_view(session, row) for row in await list_low_ratings(session, limit=50)]
