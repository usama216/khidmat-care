"""Writes and reads the audit trail."""

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.audit.models import AuditLog


def record_audit(
    session: AsyncSession,
    *,
    actor_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    """Add an audit entry to the caller's transaction, so it commits with the change itself."""
    session.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_=metadata,
            ip_address=ip_address[:45] if ip_address else None,
        )
    )


async def list_audit_logs(
    session: AsyncSession, *, offset: int, limit: int
) -> tuple[list[AuditLog], int]:
    total = await session.scalar(select(func.count()).select_from(AuditLog))
    rows = await session.scalars(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total or 0
