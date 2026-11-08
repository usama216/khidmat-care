"""Public catalog and the admin settings page."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select

from khidmat_api.core.database import SessionDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.catalog.models import Area, ServicePackage, ServiceType
from khidmat_api.modules.catalog.settings_service import (
    COMMISSION_KEY,
    MINIMUM_BALANCE_KEY,
    TOPUP_INSTRUCTIONS_KEY,
    get_platform_settings,
    set_platform_setting,
)
from khidmat_api.modules.identity.dependencies import SettingsDep, SettingsManagerDep

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
    return CatalogResponse(
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


class SettingsResponse(BaseModel):
    commission_bps: int | None
    minimum_balance_pkr: int
    topup_instructions: str


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Basis points: 2000 = 20%.
    commission_bps: Annotated[int, Field(ge=0, le=10000)] | None = None
    minimum_balance_pkr: Annotated[int, Field(ge=0, le=1_000_000)] | None = None
    topup_instructions: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
    ) = None


@settings_router.get("", summary="Commission, minimum balance and top-up details")
async def read_settings(_: SettingsManagerDep, session: SessionDep) -> SettingsResponse:
    values = await get_platform_settings(session)
    return SettingsResponse(
        commission_bps=values.commission_bps,
        minimum_balance_pkr=values.minimum_balance_pkr,
        topup_instructions=values.topup_instructions,
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
    keys = {
        "commission_bps": COMMISSION_KEY,
        "minimum_balance_pkr": MINIMUM_BALANCE_KEY,
        "topup_instructions": TOPUP_INSTRUCTIONS_KEY,
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
