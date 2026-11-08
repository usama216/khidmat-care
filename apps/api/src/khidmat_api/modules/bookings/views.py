"""Response shapes for bookings. Each audience gets only what it's allowed to see.

Phone numbers appear only through `contact_phone`, which stays null until the 2-hour window opens.
Staff views are the one exception, because operations must be able to reach both sides.
"""

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.storage import Storage
from khidmat_api.modules.bookings.models import Booking, BookingStatus, TreatmentSession
from khidmat_api.modules.bookings.service import (
    CONTACT_AND_LOCK_WINDOW,
    contact_visible,
    is_cancel_locked,
    list_sessions_for_bookings,
)
from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.modules.feedback.models import Review
from khidmat_api.modules.feedback.service import reviews_for_sessions
from khidmat_api.modules.files.service import public_photo_url
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.patients.models import Patient
from khidmat_api.modules.providers.models import Provider


class SessionView(BaseModel):
    id: UUID
    sequence: int
    scheduled_at: datetime
    status: str
    pain_score: int | None
    notes: str | None
    can_cancel: bool
    contact_phone: str | None
    contact_opens_at: datetime
    rating: int | None = None


class ProviderSummary(BaseModel):
    id: UUID
    name: str | None
    gender: str
    qualification: str
    experience_years: int
    rating_avg: float
    rating_count: int
    photo_url: str | None


class PatientSummary(BaseModel):
    name: str
    gender: str
    birth_year: int | None
    relation: str


class BookingView(BaseModel):
    id: UUID
    number: int
    status: str
    service_name: str
    area_name: str
    sessions_count: int
    price_total_pkr: int
    preferred_start_at: datetime
    condition: str
    address_line: str | None
    patient: PatientSummary
    provider: ProviderSummary | None
    sessions: list[SessionView]
    created_at: datetime
    cancel_reason: str | None


class StaffBookingView(BookingView):
    commission_bps: int
    booker_name: str | None
    booker_phone: str | None
    provider_phone: str | None


async def _provider_summary(
    session: AsyncSession, storage: Storage, provider_id: UUID | None
) -> tuple[ProviderSummary | None, User | None]:
    if provider_id is None:
        return None, None
    provider = await session.get(Provider, provider_id)
    if provider is None:
        return None, None
    user = await session.get(User, provider.user_id)
    return (
        ProviderSummary(
            id=provider.id,
            name=user.name if user else None,
            gender=provider.gender.value,
            qualification=provider.qualification,
            experience_years=provider.experience_years,
            rating_avg=provider.rating_avg,
            rating_count=provider.rating_count,
            photo_url=await public_photo_url(session, storage, provider.photo_file_id),
        ),
        user,
    )


def _session_view(
    row: TreatmentSession, phone: str | None, reviews: dict[UUID, Review]
) -> SessionView:
    now = datetime.now(UTC)
    review = reviews.get(row.id)
    return SessionView(
        id=row.id,
        sequence=row.sequence,
        scheduled_at=row.scheduled_at,
        status=row.status.value,
        pain_score=row.pain_score,
        notes=row.notes,
        can_cancel=row.status.value == "SCHEDULED" and not is_cancel_locked(row, now=now),
        contact_phone=phone if contact_visible(row, now=now) else None,
        contact_opens_at=row.scheduled_at - CONTACT_AND_LOCK_WINDOW,
        rating=review.rating if review else None,
    )


async def _base_fields(session: AsyncSession, booking: Booking) -> dict[str, object]:
    service = await session.get(ServiceType, booking.service_type_id)
    area = await session.get(Area, booking.area_id)
    patient = await session.get(Patient, booking.patient_id)
    assert patient is not None  # noqa: S101  # Enforced by the foreign key.
    return {
        "id": booking.id,
        "number": booking.number,
        "status": booking.status.value,
        "service_name": service.name if service else "",
        "area_name": area.name if area else "",
        "sessions_count": booking.sessions_count,
        "price_total_pkr": booking.price_total_pkr,
        "preferred_start_at": booking.preferred_start_at,
        "condition": booking.condition,
        "patient": PatientSummary(
            name=patient.name,
            gender=patient.gender.value,
            birth_year=patient.birth_year,
            relation=patient.relation.value,
        ),
        "created_at": booking.created_at,
        "cancel_reason": booking.cancel_reason,
    }


async def patient_booking_views(
    session: AsyncSession, storage: Storage, bookings: list[Booking]
) -> list[BookingView]:
    grouped = await list_sessions_for_bookings(session, [b.id for b in bookings])
    views = []
    for booking in bookings:
        rows = grouped.get(booking.id, [])
        summary, provider_user = await _provider_summary(session, storage, booking.provider_id)
        reviews = await reviews_for_sessions(session, [row.id for row in rows])
        phone = provider_user.phone if provider_user else None
        views.append(
            BookingView(
                **await _base_fields(session, booking),
                address_line=booking.address_line,
                provider=summary,
                sessions=[_session_view(row, phone, reviews) for row in rows],
            )
        )
    return views


async def provider_job_views(session: AsyncSession, bookings: list[Booking]) -> list[BookingView]:
    grouped = await list_sessions_for_bookings(session, [b.id for b in bookings])
    views = []
    for booking in bookings:
        rows = grouped.get(booking.id, [])
        booker = await session.get(User, booking.booked_by_id)
        accepted = booking.status not in {
            BookingStatus.AWAITING_ACCEPTANCE,
            BookingStatus.PENDING_ASSIGNMENT,
        }
        reviews = await reviews_for_sessions(session, [row.id for row in rows])
        phone = booker.phone if booker else None
        views.append(
            BookingView(
                **await _base_fields(session, booking),
                # The exact address is shared only once the physiotherapist has accepted.
                address_line=booking.address_line if accepted else None,
                provider=None,
                sessions=[_session_view(row, phone, reviews) for row in rows],
            )
        )
    return views


async def staff_booking_views(
    session: AsyncSession, storage: Storage, bookings: list[Booking]
) -> list[StaffBookingView]:
    grouped = await list_sessions_for_bookings(session, [b.id for b in bookings])
    views = []
    for booking in bookings:
        rows = grouped.get(booking.id, [])
        booker = await session.get(User, booking.booked_by_id)
        summary, provider_user = await _provider_summary(session, storage, booking.provider_id)
        reviews = await reviews_for_sessions(session, [row.id for row in rows])
        sessions = [_session_view(row, None, reviews) for row in rows]
        views.append(
            StaffBookingView(
                **await _base_fields(session, booking),
                address_line=booking.address_line,
                provider=summary,
                sessions=sessions,
                commission_bps=booking.commission_bps,
                booker_name=booker.name if booker else None,
                booker_phone=booker.phone if booker else None,
                provider_phone=provider_user.phone if provider_user else None,
            )
        )
    return views
