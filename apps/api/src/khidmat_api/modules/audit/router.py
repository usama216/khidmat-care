"""Read-only audit trail for admins."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from khidmat_api.core.database import SessionDep
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.modules.audit.service import list_audit_logs
from khidmat_api.modules.identity.dependencies import AuditViewerDep
from khidmat_api.modules.identity.models import User

router = APIRouter(prefix="/admin/audit-logs", tags=["admin"])


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    actor_id: UUID | None
    action: str
    entity_type: str
    entity_id: str
    metadata: dict[str, Any] | None = Field(validation_alias="metadata_")
    ip_address: str | None
    created_at: datetime
    actor_name: str | None = None


@router.get("", summary="List audit log entries, newest first")
async def list_entries(
    _: AuditViewerDep,
    session: SessionDep,
    params: PageParamsDep,
    entity_type: Annotated[str | None, Query(max_length=40)] = None,
    entity_id: Annotated[str | None, Query(max_length=64)] = None,
) -> Page[AuditLogResponse]:
    rows, total = await list_audit_logs(
        session,
        offset=params.offset,
        limit=params.page_size,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    actor_ids = {row.actor_id for row in rows if row.actor_id is not None}
    actors = (
        {
            user.id: user
            for user in await session.scalars(select(User).where(User.id.in_(actor_ids)))
        }
        if actor_ids
        else {}
    )
    items = []
    for row in rows:
        item = AuditLogResponse.model_validate(row)
        actor = actors.get(row.actor_id) if row.actor_id else None
        item.actor_name = (actor.name or actor.email or actor.phone) if actor else None
        items.append(item)
    return Page(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
    )
