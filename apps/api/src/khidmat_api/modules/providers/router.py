"""Physiotherapist endpoints: self-service onboarding, public listing and staff verification."""

from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from khidmat_api.core.database import SessionDep
from khidmat_api.core.enums import Gender
from khidmat_api.core.errors import NotFoundError
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.core.storage import Storage
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.bookings.admin_detail import provider_booking_stats
from khidmat_api.modules.bookings.service import busy_times
from khidmat_api.modules.catalog.settings_service import get_platform_settings
from khidmat_api.modules.files.router import StorageDep
from khidmat_api.modules.files.service import public_photo_url
from khidmat_api.modules.identity.dependencies import (
    ProviderUserDep,
    ProviderVerifierDep,
    SettingsDep,
)
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.providers.models import (
    Availability,
    DocumentType,
    Provider,
    ProviderStatus,
)
from khidmat_api.modules.providers.service import (
    LOCAL_TIMEZONE,
    VERIFICATION_CHECKS,
    ProfileInput,
    add_document,
    build_slots,
    decide_provider,
    get_availability,
    get_provider_admin,
    get_provider_by_user,
    get_provider_lists,
    list_documents,
    list_providers_admin,
    list_public_providers,
    mask_cnic,
    reveal_cnic,
    save_profile,
    set_availability,
    set_verification_check,
    submit_for_review,
)

self_router = APIRouter(prefix="/provider", tags=["physiotherapist"])
public_router = APIRouter(prefix="/physios", tags=["physiotherapist"])
admin_router = APIRouter(prefix="/admin/providers", tags=["admin"])

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]


class AvailabilitySlot(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    day_of_week: Annotated[int, Field(ge=0, le=6)]
    start_minute: Annotated[int, Field(ge=0, le=1439)]
    end_minute: Annotated[int, Field(ge=1, le=1440)]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gender: Gender
    # Optional once a profile exists: the stored value is never sent back to re-submit.
    cnic: Annotated[str, Field(max_length=20)] | None = None
    qualification: ShortText
    experience_years: Annotated[int, Field(ge=0, le=60)]
    bio: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None
    photo_file_id: UUID | None = None
    service_type_ids: Annotated[list[UUID], Field(max_length=50)]
    area_ids: Annotated[list[UUID], Field(max_length=100)]


class DocumentView(BaseModel):
    id: UUID
    type: DocumentType
    file_id: UUID


class ProviderSelfView(BaseModel):
    id: UUID
    status: ProviderStatus
    status_reason: str | None
    gender: Gender
    cnic_masked: str
    qualification: str
    experience_years: int
    bio: str | None
    photo_file_id: UUID | None
    photo_url: str | None
    service_type_ids: list[UUID]
    area_ids: list[UUID]
    documents: list[DocumentView]
    availability: list[AvailabilitySlot]
    balance_pkr: int
    minimum_balance_pkr: int
    rating_avg: float
    rating_count: int


class DocumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: DocumentType
    file_id: UUID


class SubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accept_agreement: bool


class AvailabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slots: Annotated[list[AvailabilitySlot], Field(max_length=50)]


class PublicPhysio(BaseModel):
    id: UUID
    name: str | None
    gender: Gender
    qualification: str
    experience_years: int
    bio: str | None
    rating_avg: float
    rating_count: int
    photo_url: str | None
    service_type_ids: list[UUID]
    area_ids: list[UUID]
    availability: list[AvailabilitySlot]


class ProviderAdminRow(BaseModel):
    id: UUID
    name: str | None
    phone: str
    status: ProviderStatus
    gender: Gender
    qualification: str
    experience_years: int
    balance_pkr: int
    rating_avg: float
    submitted_at: datetime | None


class ProviderStats(BaseModel):
    sessions_completed: int
    sessions_cancelled: int
    orders_total: int
    orders_active: int
    offers_rejected: int


class ProviderAdminDetail(ProviderAdminRow):
    user_id: UUID
    rating_count: int
    joined_at: datetime
    approved_at: datetime | None
    stats: ProviderStats
    cnic: str
    status_reason: str | None
    bio: str | None
    photo_url: str | None
    service_type_ids: list[UUID]
    area_ids: list[UUID]
    documents: list[DocumentView]
    availability: list[AvailabilitySlot]
    verification_checks: dict[str, str]
    required_checks: list[str]
    agreement_accepted_at: datetime | None


class CheckUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    done: bool


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


async def _self_view(
    session: SessionDep, storage: Storage, provider: Provider, settings: SettingsDep
) -> ProviderSelfView:
    services, areas = await get_provider_lists(session, provider.id)
    documents = await list_documents(session, provider.id)
    platform = await get_platform_settings(session)
    return ProviderSelfView(
        id=provider.id,
        status=provider.status,
        status_reason=provider.status_reason,
        gender=provider.gender,
        cnic_masked=mask_cnic(reveal_cnic(provider, settings)),
        qualification=provider.qualification,
        experience_years=provider.experience_years,
        bio=provider.bio,
        photo_file_id=provider.photo_file_id,
        photo_url=await public_photo_url(session, storage, provider.photo_file_id),
        service_type_ids=services,
        area_ids=areas,
        documents=[DocumentView(id=d.id, type=d.type, file_id=d.file_id) for d in documents],
        availability=[
            AvailabilitySlot.model_validate(row)
            for row in await get_availability(session, provider.id)
        ],
        balance_pkr=provider.balance_pkr,
        minimum_balance_pkr=platform.minimum_balance_pkr,
        rating_avg=provider.rating_avg,
        rating_count=provider.rating_count,
    )


@self_router.get("/profile", summary="Your physiotherapist profile")
async def my_profile(
    user: ProviderUserDep, session: SessionDep, storage: StorageDep, settings: SettingsDep
) -> ProviderSelfView | None:
    provider = await get_provider_by_user(session, user.id)
    return await _self_view(session, storage, provider, settings) if provider else None


@self_router.put("/profile", summary="Save your profile")
async def update_profile(
    payload: ProfileUpdate,
    user: ProviderUserDep,
    session: SessionDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> ProviderSelfView:
    provider = await save_profile(
        session,
        user,
        ProfileInput(
            gender=payload.gender,
            cnic=payload.cnic,
            qualification=payload.qualification,
            experience_years=payload.experience_years,
            bio=payload.bio,
            photo_file_id=payload.photo_file_id,
            service_type_ids=payload.service_type_ids,
            area_ids=payload.area_ids,
        ),
        settings,
    )
    return await _self_view(session, storage, provider, settings)


@self_router.post(
    "/documents", status_code=status.HTTP_201_CREATED, summary="Attach a verification document"
)
async def attach_document(
    payload: DocumentCreate, user: ProviderUserDep, session: SessionDep
) -> DocumentView:
    document = await add_document(session, user, payload.type, payload.file_id)
    return DocumentView(id=document.id, type=document.type, file_id=document.file_id)


@self_router.post("/submit", summary="Submit your application for review")
async def submit(
    payload: SubmitRequest,
    user: ProviderUserDep,
    session: SessionDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> ProviderSelfView:
    provider = await submit_for_review(session, user, accept_agreement=payload.accept_agreement)
    return await _self_view(session, storage, provider, settings)


@self_router.put("/availability", summary="Set your weekly availability")
async def update_availability(
    payload: AvailabilityUpdate, user: ProviderUserDep, session: SessionDep
) -> list[AvailabilitySlot]:
    rows = await set_availability(
        session, user, [(s.day_of_week, s.start_minute, s.end_minute) for s in payload.slots]
    )
    return [AvailabilitySlot.model_validate(row) for row in rows]


async def _public_view(
    session: SessionDep, storage: Storage, provider: Provider, user: User
) -> PublicPhysio:
    services, areas = await get_provider_lists(session, provider.id)
    rows: list[Availability] = await get_availability(session, provider.id)
    return PublicPhysio(
        id=provider.id,
        name=user.name,
        gender=provider.gender,
        qualification=provider.qualification,
        experience_years=provider.experience_years,
        bio=provider.bio,
        rating_avg=provider.rating_avg,
        rating_count=provider.rating_count,
        photo_url=await public_photo_url(session, storage, provider.photo_file_id),
        service_type_ids=services,
        area_ids=areas,
        availability=[AvailabilitySlot.model_validate(row) for row in rows],
    )


@public_router.get("", summary="Physiotherapists available for booking. No contact details.")
async def list_physios(
    session: SessionDep,
    storage: StorageDep,
    service_id: UUID | None = None,
    area_id: UUID | None = None,
    gender: Gender | None = None,
) -> list[PublicPhysio]:
    platform = await get_platform_settings(session)
    rows = await list_public_providers(
        session,
        minimum_balance=platform.minimum_balance_pkr,
        service_id=service_id,
        area_id=area_id,
        gender=gender,
    )
    return [await _public_view(session, storage, provider, user) for provider, user in rows]


@public_router.get("/{provider_id}/slots", summary="Open times on a day")
async def physio_slots(
    provider_id: UUID,
    session: SessionDep,
    day: Annotated[date, Query()],
) -> list[datetime]:
    today = datetime.now(LOCAL_TIMEZONE).date()
    if day < today or day > today + timedelta(days=60):
        return []
    provider = await session.get(Provider, provider_id)
    if provider is None or provider.status != ProviderStatus.APPROVED:
        raise NotFoundError("This physiotherapist isn't available.")
    start = datetime.combine(day, time.min, LOCAL_TIMEZONE)
    busy = await busy_times(session, provider.id, start, start + timedelta(days=1))
    earliest = datetime.now(UTC) + timedelta(minutes=30)
    return build_slots(await get_availability(session, provider.id), day, busy, now=earliest)


# Staff ------------------------------------------------------------------------------------------


def _admin_row(provider: Provider, user: User) -> ProviderAdminRow:
    return ProviderAdminRow(
        id=provider.id,
        name=user.name,
        phone=user.phone,
        status=provider.status,
        gender=provider.gender,
        qualification=provider.qualification,
        experience_years=provider.experience_years,
        balance_pkr=provider.balance_pkr,
        rating_avg=provider.rating_avg,
        submitted_at=provider.submitted_at,
    )


@admin_router.get("", summary="List physiotherapists")
async def list_admin(
    _: ProviderVerifierDep,
    session: SessionDep,
    params: PageParamsDep,
    status: ProviderStatus | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> Page[ProviderAdminRow]:
    rows, total = await list_providers_admin(
        session, status=status, search=search, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[_admin_row(provider, user) for provider, user in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@admin_router.get("/{provider_id}", summary="A physiotherapist's full details")
async def detail_admin(
    provider_id: UUID,
    actor: ProviderVerifierDep,
    session: SessionDep,
    storage: StorageDep,
    request: Request,
    settings: SettingsDep,
) -> ProviderAdminDetail:
    provider, user = await get_provider_admin(session, provider_id)
    # Opening this page shows the full CNIC, so every view is recorded.
    record_audit(
        session,
        actor_id=actor.id,
        action="provider.details_viewed",
        entity_type="provider",
        entity_id=str(provider.id),
        ip_address=client_ip(request, settings),
    )
    services, areas = await get_provider_lists(session, provider.id)
    documents = await list_documents(session, provider.id)
    availability = await get_availability(session, provider.id)
    view = ProviderAdminDetail(
        **_admin_row(provider, user).model_dump(),
        user_id=user.id,
        rating_count=provider.rating_count,
        joined_at=provider.created_at,
        approved_at=provider.approved_at,
        stats=ProviderStats(**await provider_booking_stats(session, provider.id)),
        cnic=reveal_cnic(provider, settings),
        status_reason=provider.status_reason,
        bio=provider.bio,
        photo_url=await public_photo_url(session, storage, provider.photo_file_id),
        service_type_ids=services,
        area_ids=areas,
        documents=[DocumentView(id=d.id, type=d.type, file_id=d.file_id) for d in documents],
        availability=[AvailabilitySlot.model_validate(row) for row in availability],
        verification_checks=provider.verification_checks,
        required_checks=list(VERIFICATION_CHECKS),
        agreement_accepted_at=provider.agreement_accepted_at,
    )
    await session.commit()
    return view


@admin_router.put("/{provider_id}/checks/{check}", summary="Tick or untick a verification check")
async def update_check(
    provider_id: UUID,
    check: str,
    payload: CheckUpdate,
    actor: ProviderVerifierDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> dict[str, dict[str, str]]:
    provider = await set_verification_check(
        session,
        provider_id,
        check,
        done=payload.done,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return {"verification_checks": provider.verification_checks}


async def _decide(
    decision: str,
    provider_id: UUID,
    reason: str | None,
    actor: User,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ProviderAdminRow:
    await decide_provider(
        session,
        provider_id,
        decision,
        reason=reason,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    provider, user = await get_provider_admin(session, provider_id)
    return _admin_row(provider, user)


@admin_router.post("/{provider_id}/approve", summary="Approve an application")
async def approve(
    provider_id: UUID,
    actor: ProviderVerifierDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ProviderAdminRow:
    return await _decide("approve", provider_id, None, actor, session, request, settings)


@admin_router.post("/{provider_id}/reject", summary="Reject an application")
async def reject(
    provider_id: UUID,
    payload: DecisionRequest,
    actor: ProviderVerifierDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ProviderAdminRow:
    return await _decide("reject", provider_id, payload.reason, actor, session, request, settings)


@admin_router.post("/{provider_id}/suspend", summary="Suspend a physiotherapist")
async def suspend(
    provider_id: UUID,
    payload: DecisionRequest,
    actor: ProviderVerifierDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ProviderAdminRow:
    return await _decide("suspend", provider_id, payload.reason, actor, session, request, settings)


@admin_router.post("/{provider_id}/reactivate", summary="Lift a suspension")
async def reactivate(
    provider_id: UUID,
    actor: ProviderVerifierDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ProviderAdminRow:
    return await _decide("reactivate", provider_id, None, actor, session, request, settings)
