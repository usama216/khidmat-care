"""Metadata for files in object storage. File contents never go in the database."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, enum_type


class FileVisibility(StrEnum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


class FilePurpose(StrEnum):
    PROVIDER_PHOTO = "PROVIDER_PHOTO"
    PROVIDER_DOCUMENT = "PROVIDER_DOCUMENT"
    TOPUP_PROOF = "TOPUP_PROOF"


class FileAsset(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "file_assets"
    __table_args__ = (CheckConstraint("size_bytes > 0", name="size_positive"),)

    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    visibility: Mapped[FileVisibility] = mapped_column(
        enum_type(FileVisibility, "visibility"), default=FileVisibility.PRIVATE
    )
    purpose: Mapped[FilePurpose] = mapped_column(
        enum_type(FilePurpose, "purpose"),
        default=FilePurpose.PROVIDER_DOCUMENT,
        server_default=FilePurpose.PROVIDER_DOCUMENT.value,
    )
    mime_type: Mapped[str] = mapped_column(String(127))
    size_bytes: Mapped[int]
    # Null until the upload is verified. Unconfirmed files can't be attached to anything.
    confirmed_at: Mapped[datetime | None]
    uploaded_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
