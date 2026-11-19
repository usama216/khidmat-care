"""Booking endpoints for patients, physiotherapists and staff."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Request, status
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

from khidmat_api.core.config import Settings
from khidmat_api.core.database import SessionDep
from khidmat_api.core.enums import Gender
from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.bookings.admin_detail import StaffBookingDetail, staff_booking_detail
from khidmat_api.modules.bookings.models import Booking, BookingStatus, SessionStatus, VisitType
from khidmat_api.modules.bookings.open_requests import (
    OpenRequest,
    alert_counts,
    alert_open_request,
    alert_open_requests,
    check_alerts,
    list_open_requests,
    pick_open_request,
)
from khidmat_api.modules.bookings.provider_dashboard import ProviderDashboard, provider_dashboard
from khidmat_api.modules.bookings.schedule import expire_holds
from khidmat_api.modules.bookings.service import (
    BookingInput,
    admin_assign_provider,
    admin_close_session,
    admin_update_hold,
    advance_session,
    cancel_booking,
    cancel_session,
    choose_new_provider,
    create_booking,
    list_bookings,
    respond_to_offer,
    schedule_next_session,
)
from khidmat_api.modules.bookings.views import (
    BookingView,
    StaffBookingView,
    patient_booking_views,
    provider_job_views,
    staff_booking_views,
)
from khidmat_api.modules.feedback.service import create_complaint, create_review
from khidmat_api.modules.files.router import StorageDep
from khidmat_api.modules.identity.dependencies import (
    BookingManagerDep,
    PatientUserDep,
    ProviderUserDep,
    SettingsDep,
)
from khidmat_api.modules.notifications.whatsapp import WhatsAppDep, WhatsAppSender
from khidmat_api.modules.providers.service import require_provider_for_user

patient_router = APIRouter(prefix="/bookings", tags=["bookings"])
provider_router = APIRouter(prefix="/provider", tags=["physiotherapist"])
admin_router = APIRouter(prefix="/admin/bookings", tags=["admin"])

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: UUID
    service_type_id: UUID
    package_id: UUID
    # Leave out to ask the team to find a physiotherapist.
    provider_id: UUID | None = None
    visit_type: VisitType = VisitType.HOME
    # Required for home visits.
    address_line: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)]
        | None
    ) = None
    area_id: UUID
    lat: Annotated[float, Field(ge=-90, le=90)] | None = None
    lng: Annotated[float, Field(ge=-180, le=180)] | None = None
    start_at: AwareDatetime
    condition: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)
    ]
    preferred_gender: Gender | None = None


class ReasonBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Reason


class ChooseProvider(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_id: UUID
    start_at: AwareDatetime


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: Annotated[int, Field(ge=1, le=5)]
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None


class ComplaintCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=2000)]
    session_id: UUID | None = None


class StartTime(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_at: AwareDatetime


class SessionAdvance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ON_THE_WAY", "ARRIVED", "COMPLETED"]
    pain_score: Annotated[int, Field(ge=0, le=10)] | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


class SessionClose(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["CANCELLED", "NO_SHOW"]
    reason: Reason


class HoldUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["extend", "release"]
    hours: Annotated[int, Field(ge=1, le=72)] | None = None


class OfferResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accept: bool
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


async def _tidy_holds(session: SessionDep, whatsapp: WhatsAppSender, settings: Settings) -> None:
    """Release offers nobody answered in time, and alert who could take them instead."""
    await alert_open_requests(session, await expire_holds(session), whatsapp, settings)


class OpenRequestView(BaseModel):
    id: UUID
    number: int
    service_name: str
    area_name: str
    visit_type: str
    preferred_start_at: datetime
    sessions_count: int
    condition: str
    patient_gender: str
    patient_birth_year: int | None
    price_total_pkr: int | None
    can_pick: bool
    reason: str | None


def _open_view(item: OpenRequest) -> OpenRequestView:
    return OpenRequestView(
        id=item.booking.id,
        number=item.booking.number,
        service_name=item.service_name,
        area_name=item.area_name,
        visit_type=item.booking.visit_type.value,
        preferred_start_at=item.booking.preferred_start_at,
        sessions_count=item.booking.sessions_count,
        condition=item.booking.condition,
        patient_gender=item.patient_gender,
        patient_birth_year=item.patient_birth_year,
        price_total_pkr=item.price_total_pkr,
        can_pick=item.can_pick,
        reason=item.reason,
    )


async def _load_booking(session: SessionDep, booking_id: UUID) -> Booking:
    booking = await session.get(Booking, booking_id, populate_existing=True)
    if booking is None:
        raise NotFoundError("This booking was not found.")
    return booking


# Patient -----------------------------------------------------------------------------------------


@patient_router.post("", status_code=status.HTTP_201_CREATED, summary="Place an order")
async def place_order(
    payload: BookingCreate,
    user: PatientUserDep,
    session: SessionDep,
    storage: StorageDep,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
) -> BookingView:
    booking = await create_booking(
        session,
        user,
        BookingInput(
            patient_id=payload.patient_id,
            service_type_id=payload.service_type_id,
            package_id=payload.package_id,
            provider_id=payload.provider_id,
            address_line=payload.address_line,
            area_id=payload.area_id,
            lat=payload.lat,
            lng=payload.lng,
            start_at=payload.start_at.astimezone(UTC),
            condition=payload.condition,
            preferred_gender=payload.preferred_gender,
            visit_type=payload.visit_type,
        ),
    )
    await alert_open_request(session, booking, whatsapp, settings)
    return (await patient_booking_views(session, storage, [booking]))[0]


@patient_router.get("", summary="Your orders")
async def my_bookings(
    user: PatientUserDep,
    session: SessionDep,
    storage: StorageDep,
    params: PageParamsDep,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
) -> Page[BookingView]:
    await _tidy_holds(session, whatsapp, settings)
    rows, total = await list_bookings(
        session, booked_by=user.id, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=await patient_booking_views(session, storage, rows),
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@patient_router.post("/{booking_id}/cancel", summary="Cancel an order")
async def cancel_my_booking(
    booking_id: UUID,
    payload: ReasonBody,
    user: PatientUserDep,
    session: SessionDep,
    storage: StorageDep,
) -> BookingView:
    booking = await cancel_booking(session, booking_id, user, payload.reason)
    return (await patient_booking_views(session, storage, [booking]))[0]


@patient_router.post("/{booking_id}/choose-provider", summary="Choose another physiotherapist")
async def choose_provider(
    booking_id: UUID,
    payload: ChooseProvider,
    user: PatientUserDep,
    session: SessionDep,
    storage: StorageDep,
) -> BookingView:
    booking = await choose_new_provider(
        session, booking_id, user, payload.provider_id, payload.start_at.astimezone(UTC)
    )
    return (await patient_booking_views(session, storage, [booking]))[0]


@patient_router.post("/sessions/{session_id}/cancel", summary="Cancel one session")
async def cancel_my_session(
    session_id: UUID, payload: ReasonBody, user: PatientUserDep, session: SessionDep
) -> dict[str, str]:
    await cancel_session(session, session_id, user, payload.reason, provider=None)
    return {"status": "cancelled"}


@patient_router.post(
    "/sessions/{session_id}/review",
    status_code=status.HTTP_201_CREATED,
    summary="Rate a completed session",
)
async def review_session(
    session_id: UUID, payload: ReviewCreate, user: PatientUserDep, session: SessionDep
) -> dict[str, str]:
    await create_review(session, session_id, user, payload.rating, payload.comment)
    return {"status": "received"}


@patient_router.post(
    "/{booking_id}/complaints", status_code=status.HTTP_201_CREATED, summary="Report a problem"
)
async def complain(
    booking_id: UUID, payload: ComplaintCreate, user: PatientUserDep, session: SessionDep
) -> dict[str, str]:
    await create_complaint(session, booking_id, user, payload.text, payload.session_id)
    return {"status": "received"}


# Physiotherapist ---------------------------------------------------------------------------------


@provider_router.get("/dashboard", summary="Your numbers and next sessions")
async def my_dashboard(
    user: ProviderUserDep, session: SessionDep, whatsapp: WhatsAppDep, settings: SettingsDep
) -> ProviderDashboard:
    provider = await require_provider_for_user(session, user.id)
    await _tidy_holds(session, whatsapp, settings)
    dashboard = await provider_dashboard(session, provider)
    pickable = sum(1 for item in await list_open_requests(session, provider) if item.can_pick)
    return dashboard.model_copy(update={"open_requests": pickable})


@provider_router.get("/jobs", summary="Your offers and jobs")
async def my_jobs(
    user: ProviderUserDep,
    session: SessionDep,
    params: PageParamsDep,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
    status: BookingStatus | None = None,
) -> Page[BookingView]:
    provider = await require_provider_for_user(session, user.id)
    await _tidy_holds(session, whatsapp, settings)
    rows, total = await list_bookings(
        session,
        provider_id=provider.id,
        status=status,
        offset=params.offset,
        limit=params.page_size,
    )
    return Page(
        items=await provider_job_views(session, rows),
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@provider_router.post("/jobs/{booking_id}/respond", summary="Accept or reject an offer")
async def respond(
    booking_id: UUID,
    payload: OfferResponse,
    user: ProviderUserDep,
    session: SessionDep,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
) -> dict[str, str]:
    provider = await require_provider_for_user(session, user.id)
    booking = await respond_to_offer(
        session, booking_id, provider, user, accept=payload.accept, reason=payload.reason
    )
    # A declined order is open again, so others who fit are alerted.
    await alert_open_request(session, booking, whatsapp, settings)
    return {"status": booking.status.value}


@provider_router.get("/open-requests", summary="Requests near you that anyone can pick")
async def open_requests(
    user: ProviderUserDep, session: SessionDep, whatsapp: WhatsAppDep, settings: SettingsDep
) -> list[OpenRequestView]:
    provider = await require_provider_for_user(session, user.id)
    await _tidy_holds(session, whatsapp, settings)
    return [_open_view(item) for item in await list_open_requests(session, provider)]


@provider_router.post(
    "/open-requests/{booking_id}/pick", summary="Take a request. The first to pick gets it."
)
async def pick_request(
    booking_id: UUID, user: ProviderUserDep, session: SessionDep
) -> dict[str, str]:
    provider = await require_provider_for_user(session, user.id)
    booking = await pick_open_request(session, booking_id, provider, user)
    return {"status": booking.status.value, "booking_id": str(booking.id)}


@provider_router.post(
    "/jobs/{booking_id}/sessions",
    status_code=status.HTTP_201_CREATED,
    summary="Schedule the next session in a package",
)
async def schedule_session(
    booking_id: UUID, payload: StartTime, user: ProviderUserDep, session: SessionDep
) -> dict[str, str]:
    provider = await require_provider_for_user(session, user.id)
    row = await schedule_next_session(
        session, booking_id, provider, user, payload.start_at.astimezone(UTC)
    )
    return {"session_id": str(row.id)}


@provider_router.post("/sessions/{session_id}/status", summary="Update a session's progress")
async def update_session(
    session_id: UUID, payload: SessionAdvance, user: ProviderUserDep, session: SessionDep
) -> dict[str, str]:
    provider = await require_provider_for_user(session, user.id)
    row = await advance_session(
        session,
        session_id,
        provider,
        user,
        SessionStatus(payload.status),
        pain_score=payload.pain_score,
        notes=payload.notes,
    )
    return {"status": row.status.value}


@provider_router.post("/sessions/{session_id}/cancel", summary="Cancel a session")
async def cancel_job_session(
    session_id: UUID, payload: ReasonBody, user: ProviderUserDep, session: SessionDep
) -> dict[str, str]:
    provider = await require_provider_for_user(session, user.id)
    await cancel_session(session, session_id, user, payload.reason, provider=provider)
    return {"status": "cancelled"}


# Staff -------------------------------------------------------------------------------------------


def _order_number(search: str | None) -> int | None:
    """Accepts "KC-1001", "kc1001" or "1001". Anything else matches no order."""
    if search is None:
        return None
    digits = search.strip().upper().removeprefix("KC").lstrip("-# ")
    return int(digits) if digits.isdigit() and len(digits) <= 9 else -1


@admin_router.get("", summary="All orders")
async def all_bookings(
    _: BookingManagerDep,
    session: SessionDep,
    storage: StorageDep,
    params: PageParamsDep,
    status: BookingStatus | None = None,
    provider_id: UUID | None = None,
    booked_by: UUID | None = None,
    search: Annotated[str | None, Query(max_length=20)] = None,
    *,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
) -> Page[StaffBookingView]:
    await _tidy_holds(session, whatsapp, settings)
    rows, total = await list_bookings(
        session,
        status=status,
        provider_id=provider_id,
        booked_by=booked_by,
        number=_order_number(search),
        offset=params.offset,
        limit=params.page_size,
    )
    return Page(
        items=await staff_booking_views(session, storage, rows),
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@admin_router.get("/{booking_id}", summary="One order's full record")
async def booking_detail(
    booking_id: UUID,
    _: BookingManagerDep,
    session: SessionDep,
    storage: StorageDep,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
) -> StaffBookingDetail:
    await _tidy_holds(session, whatsapp, settings)
    detail = await staff_booking_detail(session, storage, await _load_booking(session, booking_id))
    sent, failed = await alert_counts(session, booking_id)
    return detail.model_copy(update={"alerts_sent": sent, "alerts_failed": failed})


@admin_router.post("/{booking_id}/assign", summary="Offer an order to a physiotherapist")
async def assign(
    booking_id: UUID,
    payload: ChooseProvider,
    actor: BookingManagerDep,
    session: SessionDep,
    storage: StorageDep,
    request: Request,
    settings: SettingsDep,
) -> StaffBookingView:
    booking = await admin_assign_provider(
        session,
        booking_id,
        payload.provider_id,
        payload.start_at.astimezone(UTC),
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return (await staff_booking_views(session, storage, [booking]))[0]


@admin_router.post("/{booking_id}/hold", summary="Give more time to reply, or release the time")
async def update_hold(
    booking_id: UUID,
    payload: HoldUpdate,
    actor: BookingManagerDep,
    session: SessionDep,
    storage: StorageDep,
    request: Request,
    settings: SettingsDep,
    whatsapp: WhatsAppDep,
) -> StaffBookingView:
    booking = await admin_update_hold(
        session,
        booking_id,
        release=payload.action == "release",
        hours=payload.hours,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    await alert_open_request(session, booking, whatsapp, settings)
    return (await staff_booking_views(session, storage, [booking]))[0]


class AlertCheckView(BaseModel):
    provider_id: UUID
    name: str | None
    phone: str
    eligible: bool
    reasons: list[str]
    alert_status: str | None
    alert_error: str | None
    alerted_at: datetime | None


class AlertReport(BaseModel):
    # False when the server has no WhatsApp phone number id or access token.
    whatsapp_configured: bool
    order_open: bool
    checks: list[AlertCheckView]


@admin_router.get("/{booking_id}/alerts", summary="Who was or would be alerted, and why not")
async def booking_alerts(
    booking_id: UUID, _: BookingManagerDep, session: SessionDep, whatsapp: WhatsAppDep
) -> AlertReport:
    booking = await _load_booking(session, booking_id)
    checks = await check_alerts(session, booking)
    return AlertReport(
        whatsapp_configured=whatsapp.enabled,
        order_open=booking.status == BookingStatus.PENDING_ASSIGNMENT
        and booking.provider_id is None,
        checks=[AlertCheckView(**vars(check)) for check in checks],
    )


@admin_router.post("/{booking_id}/alerts/send", summary="Alert everyone who fits and wasn't yet")
async def send_booking_alerts(
    booking_id: UUID,
    actor: BookingManagerDep,
    session: SessionDep,
    whatsapp: WhatsAppDep,
    settings: SettingsDep,
) -> dict[str, int]:
    booking = await _load_booking(session, booking_id)
    if not whatsapp.enabled:
        raise ConflictError(
            "WhatsApp isn't set up on the server. Add WHATSAPP_PHONE_NUMBER_ID and "
            "WHATSAPP_ACCESS_TOKEN to the API project on Vercel, then redeploy."
        )
    if booking.status != BookingStatus.PENDING_ASSIGNMENT or booking.provider_id is not None:
        raise ConflictError("Only orders that still need a physio can be sent out.")
    return {"sent": await alert_open_request(session, booking, whatsapp, settings)}


@admin_router.post("/sessions/{session_id}/close", summary="Cancel or mark a no-show")
async def close_session(
    session_id: UUID,
    payload: SessionClose,
    actor: BookingManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> dict[str, str]:
    row = await admin_close_session(
        session,
        session_id,
        SessionStatus(payload.status),
        payload.reason,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return {"status": row.status.value}
