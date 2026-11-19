"""Admin inbox for contact messages."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import func, or_, select

from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import NotFoundError
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.contact.models import ContactMessage, ContactMessageStatus
from khidmat_api.modules.identity.dependencies import MessagesManagerDep, SettingsDep
from khidmat_api.modules.identity.models import User

router = APIRouter(prefix="/admin/contact-messages", tags=["admin"])


class ContactMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    message: str
    locale: str
    status: ContactMessageStatus
    created_at: datetime
    handled_at: datetime | None
    reply_note: str | None
    handled_by_name: str | None = None


class ContactMessageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ContactMessageStatus
    # What was said or done, e.g. "Called, booked a visit for Saturday".
    reply_note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = (
        None
    )


async def _view(session: SessionDep, message: ContactMessage) -> ContactMessageResponse:
    handler = await session.get(User, message.handled_by_id) if message.handled_by_id else None
    return ContactMessageResponse.model_validate(message).model_copy(
        update={"handled_by_name": handler.name if handler else None}
    )


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", summary="List contact messages, newest first")
async def list_messages(
    _: MessagesManagerDep,
    session: SessionDep,
    params: PageParamsDep,
    status: ContactMessageStatus | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> Page[ContactMessageResponse]:
    filters = []
    if status is not None:
        filters.append(ContactMessage.status == status)
    if search and search.strip():
        pattern = f"%{_escape_like(search.strip())}%"
        filters.append(
            or_(
                ContactMessage.name.ilike(pattern, escape="\\"),
                ContactMessage.phone.ilike(pattern, escape="\\"),
                ContactMessage.message.ilike(pattern, escape="\\"),
            )
        )

    total = await session.scalar(select(func.count()).select_from(ContactMessage).where(*filters))
    rows = await session.scalars(
        select(ContactMessage)
        .where(*filters)
        .order_by(ContactMessage.created_at.desc(), ContactMessage.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    )
    return Page(
        items=[await _view(session, row) for row in rows],
        total=total or 0,
        page=params.page,
        page_size=params.page_size,
    )


@router.patch("/{message_id}", summary="Mark a message as new or handled")
async def update_message(
    message_id: UUID,
    payload: ContactMessageUpdate,
    admin: MessagesManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> ContactMessageResponse:
    message = await session.get(ContactMessage, message_id)
    if message is None:
        raise NotFoundError("This message was not found.")

    message.status = payload.status
    handled = payload.status is ContactMessageStatus.HANDLED
    message.handled_at = datetime.now(UTC) if handled else None
    message.handled_by_id = admin.id if handled else None
    if "reply_note" in payload.model_fields_set:
        message.reply_note = payload.reply_note or None
    record_audit(
        session,
        actor_id=admin.id,
        action="contact_message.status_changed",
        entity_type="contact_message",
        entity_id=str(message.id),
        metadata={"status": payload.status.value},
        ip_address=client_ip(request, settings),
    )
    await session.commit()
    return await _view(session, message)
