"""File upload and access endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.core.requests import client_ip
from khidmat_api.core.storage import LocalStorage, Storage, UploadTicket
from khidmat_api.modules.files.models import FilePurpose
from khidmat_api.modules.files.service import (
    MAX_FILE_BYTES,
    confirm_upload,
    create_upload,
    signed_file_url,
)
from khidmat_api.modules.identity.dependencies import CurrentUserDep, SettingsDep

router = APIRouter(prefix="/files", tags=["files"])


def get_storage(request: Request) -> Storage:
    storage: Storage = request.app.state.storage
    return storage


StorageDep = Annotated[Storage, Depends(get_storage)]


class UploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purpose: FilePurpose
    mime_type: str = Field(max_length=127)
    size_bytes: int = Field(gt=0, le=MAX_FILE_BYTES)


class UploadResponse(BaseModel):
    file_id: UUID
    upload: UploadTicket


class SignedUrlResponse(BaseModel):
    url: str


@router.post("/uploads", status_code=status.HTTP_201_CREATED, summary="Start a file upload")
async def start_upload(
    payload: UploadRequest, user: CurrentUserDep, session: SessionDep, storage: StorageDep
) -> UploadResponse:
    asset, ticket = await create_upload(
        session,
        storage,
        user=user,
        purpose=payload.purpose,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
    )
    return UploadResponse(file_id=asset.id, upload=ticket)


@router.post("/{file_id}/confirm", summary="Verify a finished upload")
async def confirm(
    file_id: UUID, user: CurrentUserDep, session: SessionDep, storage: StorageDep
) -> dict[str, str]:
    await confirm_upload(session, storage, user=user, file_id=file_id)
    return {"status": "confirmed"}


@router.get("/{file_id}/url", summary="A short-lived link to view a file")
async def file_url(
    file_id: UUID,
    user: CurrentUserDep,
    session: SessionDep,
    storage: StorageDep,
    request: Request,
    settings: SettingsDep,
) -> SignedUrlResponse:
    url = await signed_file_url(
        session,
        storage,
        user=user,
        file_id=file_id,
        ip_address=client_ip(request, settings),
    )
    return SignedUrlResponse(url=url)


def _local_storage(storage: Storage) -> LocalStorage:
    if not isinstance(storage, LocalStorage):
        raise NotFoundError
    return storage


@router.post(
    "/local-upload", status_code=status.HTTP_204_NO_CONTENT, summary="Development upload target"
)
async def local_upload(
    storage: StorageDep,
    token: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> None:
    local = _local_storage(storage)
    claims = local.read_token(token, "local-upload")
    if claims is None:
        raise ConflictError("This upload link has expired.")
    data = await file.read(int(claims["max"]) + 1)
    if len(data) > int(claims["max"]):
        raise ConflictError("This file is too large. The limit is 8 MB.")
    local.write(str(claims["key"]), data)


@router.get("/local/{token}", summary="Development file link", response_model=None)
async def local_download(token: str, storage: StorageDep) -> FileResponse:
    local = _local_storage(storage)
    claims = local.read_token(token, "local-download")
    if claims is None:
        raise NotFoundError("This link has expired.")
    path = local.path_for(str(claims["key"]))
    if not path.exists():
        raise NotFoundError("This file was not found.")
    return FileResponse(path)
