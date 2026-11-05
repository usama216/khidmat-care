"""Numbers for the admin dashboard's overview page."""

from fastapi import APIRouter
from pydantic import BaseModel

from khidmat_api.core.database import SessionDep
from khidmat_api.modules.bookings.models import BookingStatus
from khidmat_api.modules.bookings.service import count_bookings
from khidmat_api.modules.catalog.service import count_active_packages, count_active_services
from khidmat_api.modules.contact.service import count_new_messages, count_recent_messages
from khidmat_api.modules.identity.dependencies import AdminUserDep
from khidmat_api.modules.patients.service import count_patients
from khidmat_api.modules.providers.models import ProviderStatus
from khidmat_api.modules.providers.service import count_providers

router = APIRouter(prefix="/admin", tags=["admin"])


class OverviewResponse(BaseModel):
    new_messages: int
    messages_last_7_days: int
    providers_pending: int
    providers_approved: int
    patients: int
    bookings_awaiting_assignment: int
    bookings_active: int
    active_services: int
    active_packages: int


@router.get("/overview", summary="Counts shown on the dashboard")
async def overview(_: AdminUserDep, session: SessionDep) -> OverviewResponse:
    return OverviewResponse(
        new_messages=await count_new_messages(session),
        messages_last_7_days=await count_recent_messages(session, days=7),
        providers_pending=await count_providers(session, ProviderStatus.PENDING),
        providers_approved=await count_providers(session, ProviderStatus.APPROVED),
        patients=await count_patients(session),
        bookings_awaiting_assignment=await count_bookings(
            session, BookingStatus.PENDING_ASSIGNMENT
        ),
        bookings_active=await count_bookings(session, BookingStatus.ACTIVE),
        active_services=await count_active_services(session),
        active_packages=await count_active_packages(session),
    )
