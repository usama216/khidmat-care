"""Public catalog and the admin settings page."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select

from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import ConflictError
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.catalog.models import Area, ServicePackage, ServiceType
from khidmat_api.modules.catalog.settings_service import (
    COMMISSION_KEY,
    FEE_MAX_KEY,
    FEE_MIN_KEY,
    HOLD_HOURS_KEY,
    MINIMUM_BALANCE_KEY,
    TOPUP_INSTRUCTIONS_KEY,
    get_platform_settings,
    set_platform_setting,
)
from khidmat_api.modules.identity.dependencies import SettingsDep, SettingsManagerDep
from khidmat_api.modules.providers.models import Provider, ProviderStatus

public_router = APIRouter(prefix="/catalog", tags=["catalog"])
settings_router = APIRouter(prefix="/admin/settings", tags=["admin"])


class PublicPackage(BaseModel):
    id: UUID
    sessions_count: int
    price_pkr: int


class PublicService(BaseModel):
    id: UUID
    slug: str
    name: str
    name_urdu: str
    description: str | None
    packages: list[PublicPackage]


class PublicArea(BaseModel):
    id: UUID
    name: str
    name_urdu: str


class CatalogResponse(BaseModel):
    services: list[PublicService]
    areas: list[PublicArea]
    # The clinic filter only appears once at least one bookable physiotherapist offers it.
    clinic_visits: bool


@public_router.get("", summary="Bookable services, prices and areas")
async def catalog(session: SessionDep) -> CatalogResponse:
    services = await session.scalars(
        select(ServiceType)
        .where(ServiceType.is_active)
        .order_by(ServiceType.sort_order, ServiceType.name)
    )
    packages = await session.scalars(
        select(ServicePackage)
        .where(ServicePackage.is_active)
        .order_by(ServicePackage.sessions_count)
    )
    by_service: dict[UUID, list[PublicPackage]] = {}
    for package in packages:
        by_service.setdefault(package.service_type_id, []).append(
            PublicPackage(
                id=package.id, sessions_count=package.sessions_count, price_pkr=package.price_pkr
            )
        )
    areas = await session.scalars(select(Area).where(Area.is_active).order_by(Area.name))
    clinic = await session.scalar(
        select(Provider.id)
        .where(
            Provider.status == ProviderStatus.APPROVED,
            Provider.visit_clinic,
            Provider.fee_pkr.is_not(None),
        )
        .limit(1)
    )
    return CatalogResponse(
        clinic_visits=clinic is not None,
        services=[
            PublicService(
                id=service.id,
                slug=service.slug,
                name=service.name,
                name_urdu=service.name_urdu,
                description=service.description,
                packages=by_service.get(service.id, []),
            )
            for service in services
        ],
        areas=[PublicArea(id=area.id, name=area.name, name_urdu=area.name_urdu) for area in areas],
    )


class PhysioTerms(BaseModel):
    commission_bps: int | None
    minimum_balance_pkr: int
    fee_min_pkr: int
    fee_max_pkr: int


@public_router.get("/physio-terms", summary="Commission and minimum balance for physiotherapists")
async def physio_terms(session: SessionDep) -> PhysioTerms:
    # Shown on the public "for physiotherapists" page, so it always matches the dashboard.
    platform = await get_platform_settings(session)
    return PhysioTerms(
        commission_bps=platform.commission_bps,
        minimum_balance_pkr=platform.minimum_balance_pkr,
        fee_min_pkr=platform.fee_min_pkr,
        fee_max_pkr=platform.fee_max_pkr,
    )


class SettingsResponse(BaseModel):
    commission_bps: int | None
    minimum_balance_pkr: int
    topup_instructions: str
    hold_hours: int
    fee_min_pkr: int
    fee_max_pkr: int


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Basis points: 2000 = 20%.
    commission_bps: Annotated[int, Field(ge=0, le=10000)] | None = None
    minimum_balance_pkr: Annotated[int, Field(ge=0, le=1_000_000)] | None = None
    topup_instructions: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
    ) = None
    hold_hours: Annotated[int, Field(ge=1, le=72)] | None = None
    fee_min_pkr: Annotated[int, Field(ge=100, le=1_000_000)] | None = None
    fee_max_pkr: Annotated[int, Field(ge=100, le=1_000_000)] | None = None


@settings_router.get("", summary="Commission, minimum balance and top-up details")
async def read_settings(_: SettingsManagerDep, session: SessionDep) -> SettingsResponse:
    values = await get_platform_settings(session)
    return SettingsResponse(
        commission_bps=values.commission_bps,
        minimum_balance_pkr=values.minimum_balance_pkr,
        topup_instructions=values.topup_instructions,
        hold_hours=values.hold_hours,
        fee_min_pkr=values.fee_min_pkr,
        fee_max_pkr=values.fee_max_pkr,
    )


@settings_router.patch("", summary="Update business settings")
async def update_settings(
    payload: SettingsUpdate,
    admin: SettingsManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> SettingsResponse:
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    current = await get_platform_settings(session)
    fee_min = changes.get("fee_min_pkr", current.fee_min_pkr)
    fee_max = changes.get("fee_max_pkr", current.fee_max_pkr)
    if fee_min > fee_max:
        raise ConflictError("The lowest fee can't be more than the highest fee.")
    keys = {
        "commission_bps": COMMISSION_KEY,
        "minimum_balance_pkr": MINIMUM_BALANCE_KEY,
        "topup_instructions": TOPUP_INSTRUCTIONS_KEY,
        "hold_hours": HOLD_HOURS_KEY,
        "fee_min_pkr": FEE_MIN_KEY,
        "fee_max_pkr": FEE_MAX_KEY,
    }
    for field, value in changes.items():
        await set_platform_setting(session, keys[field], value)
    record_audit(
        session,
        actor_id=admin.id,
        action="settings.updated",
        entity_type="platform_setting",
        entity_id="platform",
        metadata=changes,
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return await read_settings(admin, session)
