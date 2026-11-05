"""Admin management of services, package prices and platform commission."""

import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.catalog.models import (
    PlatformSetting,
    ServiceCategory,
    ServicePackage,
    ServiceType,
)
from khidmat_api.modules.identity.dependencies import AdminUserDep, SettingsDep

router = APIRouter(prefix="/admin/catalog", tags=["admin"])

COMMISSION_KEY = "commission.default_bps"
_SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class PackageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sessions_count: int
    price_pkr: int
    is_active: bool


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    category: ServiceCategory
    name: str
    name_urdu: str
    description: str | None
    description_urdu: str | None
    is_active: bool
    sort_order: int
    packages: list[PackageResponse] = []


class ServiceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]
    name: ShortText
    name_urdu: ShortText
    description: LongText | None = None
    description_urdu: LongText | None = None
    sort_order: Annotated[int, Field(ge=0, le=10000)] = 0

    @field_validator("slug")
    @classmethod
    def _valid_slug(cls, value: str) -> str:
        if not _SLUG.match(value):
            raise ValueError("Use lowercase letters, numbers and hyphens only")
        return value


class ServiceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ShortText | None = None
    name_urdu: ShortText | None = None
    description: LongText | None = None
    description_urdu: LongText | None = None
    is_active: bool | None = None
    sort_order: Annotated[int, Field(ge=0, le=10000)] | None = None


class PackageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessions_count: Annotated[int, Field(gt=0, le=100)]
    price_pkr: Annotated[int, Field(gt=0, le=10_000_000)]


class PackageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_pkr: Annotated[int, Field(gt=0, le=10_000_000)] | None = None
    is_active: bool | None = None


class CommissionSetting(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Basis points: 2000 = 20%. Null until the business decides on a rate.
    commission_bps: Annotated[int, Field(ge=0, le=10000)] | None


@router.get("/services", summary="List services with their packages")
async def list_services(_: AdminUserDep, session: SessionDep) -> list[ServiceResponse]:
    services = list(
        await session.scalars(
            select(ServiceType).order_by(ServiceType.sort_order, ServiceType.name)
        )
    )
    packages = await session.scalars(select(ServicePackage).order_by(ServicePackage.sessions_count))
    by_service: dict[UUID, list[PackageResponse]] = {}
    for package in packages:
        by_service.setdefault(package.service_type_id, []).append(
            PackageResponse.model_validate(package)
        )
    return [
        ServiceResponse.model_validate(service).model_copy(
            update={"packages": by_service.get(service.id, [])}
        )
        for service in services
    ]


@router.post("/services", status_code=status.HTTP_201_CREATED, summary="Create a service")
async def create_service(
    payload: ServiceCreate,
    admin: AdminUserDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ServiceResponse:
    service = ServiceType(**payload.model_dump())
    session.add(service)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A service with this slug already exists.") from exc
    record_audit(
        session,
        actor_id=admin.id,
        action="service.created",
        entity_type="service_type",
        entity_id=str(service.id),
        metadata={"slug": service.slug},
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return ServiceResponse.model_validate(service)


@router.patch("/services/{service_id}", summary="Update a service")
async def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    admin: AdminUserDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ServiceResponse:
    service = await session.get(ServiceType, service_id)
    if service is None:
        raise NotFoundError("This service was not found.")
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(service, field, value)
    record_audit(
        session,
        actor_id=admin.id,
        action="service.updated",
        entity_type="service_type",
        entity_id=str(service.id),
        metadata={"fields": sorted(changes)},
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return ServiceResponse.model_validate(service)


@router.post(
    "/services/{service_id}/packages",
    status_code=status.HTTP_201_CREATED,
    summary="Add a package to a service",
)
async def create_package(
    service_id: UUID,
    payload: PackageCreate,
    admin: AdminUserDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> PackageResponse:
    if await session.get(ServiceType, service_id) is None:
        raise NotFoundError("This service was not found.")
    package = ServicePackage(service_type_id=service_id, **payload.model_dump())
    session.add(package)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError(
            "This service already has an active package with that many sessions."
        ) from exc
    record_audit(
        session,
        actor_id=admin.id,
        action="package.created",
        entity_type="service_package",
        entity_id=str(package.id),
        metadata={"sessions_count": package.sessions_count, "price_pkr": package.price_pkr},
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return PackageResponse.model_validate(package)


@router.patch("/packages/{package_id}", summary="Change a package's price or status")
async def update_package(
    package_id: UUID,
    payload: PackageUpdate,
    admin: AdminUserDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> PackageResponse:
    package = await session.get(ServicePackage, package_id)
    if package is None:
        raise NotFoundError("This package was not found.")
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(package, field, value)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError(
            "This service already has an active package with that many sessions."
        ) from exc
    record_audit(
        session,
        actor_id=admin.id,
        action="package.updated",
        entity_type="service_package",
        entity_id=str(package.id),
        metadata=changes,
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return PackageResponse.model_validate(package)


@router.get("/commission", summary="The default platform commission")
async def get_commission(_: AdminUserDep, session: SessionDep) -> CommissionSetting:
    setting = await session.get(PlatformSetting, COMMISSION_KEY)
    return CommissionSetting(commission_bps=setting.value if setting else None)


@router.put("/commission", summary="Set the default platform commission")
async def set_commission(
    payload: CommissionSetting,
    admin: AdminUserDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> CommissionSetting:
    setting = await session.get(PlatformSetting, COMMISSION_KEY)
    if setting is None:
        session.add(PlatformSetting(key=COMMISSION_KEY, value=payload.commission_bps))
    else:
        setting.value = payload.commission_bps
    record_audit(
        session,
        actor_id=admin.id,
        action="commission.updated",
        entity_type="platform_setting",
        entity_id=COMMISSION_KEY,
        metadata={"commission_bps": payload.commission_bps},
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return payload
