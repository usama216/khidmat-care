"""Messages sent through the public contact form."""

from enum import StrEnum

from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, enum_type


class ContactMessageStatus(StrEnum):
    NEW = "NEW"
    HANDLED = "HANDLED"


class ContactMessage(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "contact_messages"
    __table_args__ = (
        Index("ix_contact_messages_status_created_at", "status", "created_at"),
        Index("ix_contact_messages_ip_hash_created_at", "ip_hash", "created_at"),
    )

    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(16))  # E.164: +923001234567
    message: Mapped[str] = mapped_column(Text)
    locale: Mapped[str] = mapped_column(String(2))
    status: Mapped[ContactMessageStatus] = mapped_column(
        enum_type(ContactMessageStatus, "status"), default=ContactMessageStatus.NEW
    )
    # A keyed hash is enough for rate limiting, so the raw IP address is never stored.
    ip_hash: Mapped[str] = mapped_column(String(64))
