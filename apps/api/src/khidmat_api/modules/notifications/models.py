"""In-app notifications and the delivery record for SMS and WhatsApp messages."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, enum_type


class NotificationType(StrEnum):
    BOOKING_RECEIVED = "BOOKING_RECEIVED"
    ASSIGNMENT_OFFERED = "ASSIGNMENT_OFFERED"
    PROVIDER_ASSIGNED = "PROVIDER_ASSIGNED"
    PROVIDER_ON_THE_WAY = "PROVIDER_ON_THE_WAY"
    SESSION_COMPLETED = "SESSION_COMPLETED"
    FEEDBACK_REQUEST = "FEEDBACK_REQUEST"
    PROVIDER_STATUS_CHANGED = "PROVIDER_STATUS_CHANGED"


class NotificationChannel(StrEnum):
    IN_APP = "IN_APP"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"


class NotificationStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class Notification(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_id_read_at", "user_id", "read_at"),
        Index("ix_notifications_status_channel", "status", "channel"),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[NotificationType] = mapped_column(enum_type(NotificationType, "type"))
    channel: Mapped[NotificationChannel] = mapped_column(enum_type(NotificationChannel, "channel"))
    status: Mapped[NotificationStatus] = mapped_column(
        enum_type(NotificationStatus, "status"), default=NotificationStatus.PENDING
    )
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None]
    read_at: Mapped[datetime | None]
