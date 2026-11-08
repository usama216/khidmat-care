"""Staff handling of complaints and low ratings."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, StringConstraints

from khidmat_api.core.database import SessionDep
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.feedback.models import ComplaintStatus
from khidmat_api.modules.feedback.service import (
    list_complaints,
    list_low_ratings,
    update_complaint,
)
from khidmat_api.modules.identity.dependencies import ComplaintManagerDep, SettingsDep

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


class ComplaintUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ComplaintStatus
    resolution: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = (
        None
    )


class LowRatingView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    provider_id: UUID
    rating: int
    comment: str | None
    created_at: datetime


@router.get("/complaints", summary="Complaints, newest first")
async def complaints(
    _: ComplaintManagerDep,
    session: SessionDep,
    params: PageParamsDep,
    status: ComplaintStatus | None = None,
) -> Page[ComplaintView]:
    rows, total = await list_complaints(
        session, status=status, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[ComplaintView.model_validate(row) for row in rows],
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
) -> ComplaintView:
    complaint = await update_complaint(
        session,
        complaint_id,
        payload.status,
        payload.resolution,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return ComplaintView.model_validate(complaint)


@router.get("/low-ratings", summary="Recent ratings of 2 stars or below")
async def low_ratings(_: ComplaintManagerDep, session: SessionDep) -> list[LowRatingView]:
    return [LowRatingView.model_validate(row) for row in await list_low_ratings(session, limit=50)]
