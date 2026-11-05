"""Public contact form endpoint."""

from fastapi import APIRouter, Request, status

from khidmat_api.core.config import Settings
from khidmat_api.core.database import SessionDep
from khidmat_api.modules.contact.schemas import ContactMessageAccepted, ContactMessageCreate
from khidmat_api.modules.contact.service import submit_contact_message

router = APIRouter(prefix="/contact-messages", tags=["contact"])


def _client_ip(request: Request, settings: Settings) -> str:
    if settings.client_ip_header:
        forwarded = request.headers.get(settings.client_ip_header, "")
        first_hop = forwarded.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"


@router.post("", status_code=status.HTTP_201_CREATED, summary="Send a contact message")
async def create_contact_message(
    payload: ContactMessageCreate, request: Request, session: SessionDep
) -> ContactMessageAccepted:
    settings: Settings = request.app.state.settings
    await submit_contact_message(
        session, payload, client_ip=_client_ip(request, settings), settings=settings
    )
    return ContactMessageAccepted()
