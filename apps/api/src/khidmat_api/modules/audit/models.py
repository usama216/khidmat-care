"""Append-only record of admin actions and access to medical data and documents."""

from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class AuditLog(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity_type_entity_id", "entity_type", "entity_id"),
        Index("ix_audit_logs_actor_id_created_at", "actor_id", "created_at"),
    )

    # Kept when the actor's account is removed, so the history stays complete.
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))  # e.g. provider.approve, document.view
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(64))
    # Never put CNICs, medical notes or other sensitive values here.
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
