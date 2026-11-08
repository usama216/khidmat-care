"""Upload tickets, upload verification and access to stored files."""

from datetime import UTC, datetime
from uuid import UUID, uuid7

from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError, ForbiddenError, NotFoundError
from khidmat_api.core.storage import Storage, UploadTicket
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.files.models import FileAsset, FilePurpose
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.identity.permissions import Permission, permissions_for

MAX_FILE_BYTES = 8 * 1024 * 1024
_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
_DOCUMENT_TYPES = _IMAGE_TYPES | {"application/pdf"}
_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}
_ALLOWED_TYPES = {
    FilePurpose.PROVIDER_PHOTO: _IMAGE_TYPES,
    FilePurpose.PROVIDER_DOCUMENT: _DOCUMENT_TYPES,
    FilePurpose.TOPUP_PROOF: _DOCUMENT_TYPES,
}


def _matches_signature(mime_type: str, start: bytes) -> bool:
    """Check the real file content, because the declared type comes from the client."""
    if mime_type == "image/jpeg":
        return start.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return start.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return start[:4] == b"RIFF" and start[8:12] == b"WEBP"
    if mime_type == "application/pdf":
        return start.startswith(b"%PDF-")
    return False


async def create_upload(
    session: AsyncSession,
    storage: Storage,
    *,
    user: User,
    purpose: FilePurpose,
    mime_type: str,
    size_bytes: int,
) -> tuple[FileAsset, UploadTicket]:
    if mime_type not in _ALLOWED_TYPES[purpose]:
        raise ConflictError("This file type isn't allowed. Use JPG, PNG, WEBP or PDF.")
    key = f"{purpose.value.lower()}/{user.id}/{uuid7()}.{_EXTENSIONS[mime_type]}"
    ticket = storage.upload_ticket(key, mime_type, MAX_FILE_BYTES)
    asset = FileAsset(
        storage_key=key,
        purpose=purpose,
        mime_type=mime_type,
        size_bytes=size_bytes,
        uploaded_by_id=user.id,
    )
    session.add(asset)
    await session.commit()
    return asset, ticket


async def confirm_upload(
    session: AsyncSession, storage: Storage, *, user: User, file_id: UUID
) -> FileAsset:
    asset = await session.get(FileAsset, file_id)
    if asset is None or asset.uploaded_by_id != user.id:
        raise NotFoundError("This file was not found.")
    if asset.confirmed_at is not None:
        return asset

    actual_size = await storage.size(asset.storage_key)
    if actual_size is None:
        raise ConflictError("The upload didn't finish. Please try again.")
    start = await storage.read_start(asset.storage_key, 16) or b""
    if actual_size > MAX_FILE_BYTES or not _matches_signature(asset.mime_type, start):
        await storage.delete(asset.storage_key)
        raise ConflictError("This file is invalid or too large. The limit is 8 MB.")

    asset.size_bytes = actual_size
    asset.confirmed_at = datetime.now(UTC)
    await session.commit()
    return asset


async def require_owned_file(
    session: AsyncSession, file_id: UUID, *, user: User, purpose: FilePurpose
) -> FileAsset:
    """Return a verified file belonging to this user, for attaching to their records."""
    asset = await session.get(FileAsset, file_id)
    if (
        asset is None
        or asset.uploaded_by_id != user.id
        or asset.purpose != purpose
        or asset.confirmed_at is None
    ):
        raise ConflictError("This file isn't available. Please upload it again.")
    return asset


_STAFF_PERMISSION = {
    FilePurpose.PROVIDER_PHOTO: Permission.DASHBOARD_VIEW,
    FilePurpose.PROVIDER_DOCUMENT: Permission.PROVIDERS_VERIFY,
    FilePurpose.TOPUP_PROOF: Permission.FINANCE_MANAGE,
}


async def signed_file_url(
    session: AsyncSession,
    storage: Storage,
    *,
    user: User,
    file_id: UUID,
    ip_address: str,
) -> str:
    """A short-lived link for the uploader or for staff whose role covers this kind of file."""
    asset = await session.get(FileAsset, file_id)
    if asset is None or asset.confirmed_at is None:
        raise NotFoundError("This file was not found.")
    is_owner = asset.uploaded_by_id == user.id
    if not is_owner and _STAFF_PERMISSION[asset.purpose] not in permissions_for(user.role):
        raise ForbiddenError
    if not is_owner and asset.purpose != FilePurpose.PROVIDER_PHOTO:
        record_audit(
            session,
            actor_id=user.id,
            action="file.viewed",
            entity_type="file_asset",
            entity_id=str(asset.id),
            metadata={"purpose": asset.purpose.value},
            ip_address=ip_address,
        )
        await session.commit()
    return storage.download_url(asset.storage_key)


async def public_photo_url(
    session: AsyncSession, storage: Storage, file_id: UUID | None
) -> str | None:
    """Physiotherapist photos are shown to patients through short-lived links."""
    if file_id is None:
        return None
    asset = await session.get(FileAsset, file_id)
    if asset is None or asset.purpose != FilePurpose.PROVIDER_PHOTO or asset.confirmed_at is None:
        return None
    return storage.download_url(asset.storage_key)
