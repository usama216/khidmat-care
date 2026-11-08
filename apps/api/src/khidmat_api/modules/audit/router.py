"""Read-only audit trail for admins."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from khidmat_api.core.database import SessionDep
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.modules.audit.service import list_audit_logs
from khidmat_api.modules.identity.dependencies import AuditViewerDep

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


@router.get("", summary="List audit log entries, newest first")
async def list_entries(
    _: AuditViewerDep, session: SessionDep, params: PageParamsDep
) -> Page[AuditLogResponse]:
    rows, total = await list_audit_logs(session, offset=params.offset, limit=params.page_size)
    return Page(
        items=[AuditLogResponse.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )
