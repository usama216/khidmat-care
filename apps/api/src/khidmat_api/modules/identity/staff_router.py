"""Admin endpoints for managing the staff team."""

from uuid import UUID

from fastapi import APIRouter, Request, status

from khidmat_api.core.database import SessionDep
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.identity.dependencies import SettingsDep, StaffManagerDep
from khidmat_api.modules.identity.schemas import (
    StaffCreate,
    StaffResponse,
    StaffUpdate,
    TemporaryPasswordResponse,
)
from khidmat_api.modules.identity.staff_service import (
    create_staff,
    list_staff,
    reset_staff_password,
    update_staff,
)

router = APIRouter(prefix="/admin/staff", tags=["admin"])


@router.get("", summary="List staff accounts")
async def list_team(
    _: StaffManagerDep, session: SessionDep, params: PageParamsDep
) -> Page[StaffResponse]:
    rows, total = await list_staff(session, offset=params.offset, limit=params.page_size)
    return Page(
        items=[StaffResponse.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.post("", status_code=status.HTTP_201_CREATED, summary="Add a staff member")
async def add_member(
    payload: StaffCreate,
    actor: StaffManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> TemporaryPasswordResponse:
    user, temporary = await create_staff(
        session, payload, actor=actor, ip_address=client_ip(request, settings)
    )
    return TemporaryPasswordResponse(
        staff=StaffResponse.model_validate(user), temporary_password=temporary
    )


@router.patch("/{user_id}", summary="Change a staff member's name, role or status")
async def update_member(
    user_id: UUID,
    payload: StaffUpdate,
    actor: StaffManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> StaffResponse:
    user = await update_staff(
        session, user_id, payload, actor=actor, ip_address=client_ip(request, settings)
    )
    return StaffResponse.model_validate(user)


@router.post("/{user_id}/reset-password", summary="Issue a new temporary password")
async def reset_password(
    user_id: UUID,
    actor: StaffManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> TemporaryPasswordResponse:
    user, temporary = await reset_staff_password(
        session, user_id, actor=actor, ip_address=client_ip(request, settings)
    )
    return TemporaryPasswordResponse(
        staff=StaffResponse.model_validate(user), temporary_password=temporary
    )
