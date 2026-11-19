"""Open requests: orders nobody has yet, which any matching physiotherapist can pick.

When an order needs a physiotherapist, everyone who fits it is alerted on WhatsApp. They open
their dashboard and the first to pick it gets it; for everyone else it disappears. A row lock on
the order makes "first" exact, even if two people tap at the same moment.
"""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from khidmat_api.core.config import Settings
from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.bookings.models import (
    AssignmentStatus,
    Booking,
    BookingAssignment,
    BookingStatus,
    VisitType,
)
from khidmat_api.modules.bookings.schedule import BOOKING_LEAD, require_free_slot
from khidmat_api.modules.bookings.service import (
    _add_session,
    _price_from,
    _require_bookable_provider,
)
from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.modules.catalog.settings_service import get_platform_settings
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationType,
)
from khidmat_api.modules.notifications.whatsapp import (
    TemplateMessage,
    WhatsAppError,
    WhatsAppSender,
)
from khidmat_api.modules.patients.models import Patient
from khidmat_api.modules.providers.models import (
    Provider,
    ProviderArea,
    ProviderService,
    ProviderStatus,
)
from khidmat_api.modules.providers.service import LOCAL_TIMEZONE, bookable_filters

logger = structlog.get_logger("khidmat.open_requests")

# Physiotherapists who already turned this order down aren't asked again.
_PASSED = (AssignmentStatus.REJECTED, AssignmentStatus.EXPIRED)


class RequestTakenError(ConflictError):
    code = "request_taken"
    message = "Another physiotherapist picked this request first."


def _is_open(booking: Booking) -> bool:
    return booking.status == BookingStatus.PENDING_ASSIGNMENT and booking.provider_id is None


def _place_filter(booking: Booking) -> ColumnElement[bool]:
    if booking.visit_type == VisitType.CLINIC:
        return and_(Provider.visit_clinic, Provider.clinic_area_id == booking.area_id)
    return and_(
        Provider.visit_home,
        Provider.id.in_(
            select(ProviderArea.provider_id).where(ProviderArea.area_id == booking.area_id)
        ),
    )


async def _passed_on(session: AsyncSession, booking_id: UUID) -> set[UUID]:
    rows = await session.scalars(
        select(BookingAssignment.provider_id).where(
            BookingAssignment.booking_id == booking_id, BookingAssignment.status.in_(_PASSED)
        )
    )
    return set(rows)


async def matching_providers(
    session: AsyncSession, booking: Booking, *, limit: int
) -> list[tuple[Provider, User]]:
    """Who to alert: treats this problem, covers this area, can be booked, and has no other visit
    or time off then. Weekly hours don't limit alerts: a physio may take a request outside them."""
    minimum = (await get_platform_settings(session)).minimum_balance_pkr
    passed = await _passed_on(session, booking.id)
    rows = await session.execute(
        select(Provider, User)
        .join(User, User.id == Provider.user_id)
        .where(
            *bookable_filters(minimum),
            Provider.whatsapp_alerts,
            Provider.id.in_(
                select(ProviderService.provider_id).where(
                    ProviderService.service_type_id == booking.service_type_id
                )
            ),
            _place_filter(booking),
        )
        .order_by(Provider.rating_avg.desc(), Provider.experience_years.desc())
    )
    matches: list[tuple[Provider, User]] = []
    for provider, user in rows.all():
        if provider.id in passed:
            continue
        try:
            await require_free_slot(
                session,
                provider,
                booking.preferred_start_at,
                provider.slot_minutes,
                within_hours=False,
            )
        except ConflictError:
            continue
        matches.append((provider, user))
        if len(matches) >= limit:
            break
    return matches


def _time_label(moment: datetime) -> str:
    local = moment.astimezone(LOCAL_TIMEZONE)
    hour = local.hour % 12 or 12
    suffix = "am" if local.hour < 12 else "pm"
    return f"{local:%a} {local.day} {local:%b}, {hour}:{local:%M} {suffix}"


async def alert_open_request(
    session: AsyncSession, booking: Booking, sender: WhatsAppSender, settings: Settings
) -> int:
    """Send the open-request template to every matching physiotherapist not yet alerted.

    Never raises: the order is already saved, and a failed alert is recorded for the team to see.
    Returns how many messages went out.
    """
    if not sender.enabled or not _is_open(booking):
        return 0
    try:
        limit = (await get_platform_settings(session)).alert_physios_max
        already = set(
            await session.scalars(
                select(Notification.user_id).where(
                    Notification.booking_id == booking.id,
                    Notification.type == NotificationType.OPEN_REQUEST,
                    Notification.status == NotificationStatus.SENT,
                )
            )
        )
        targets = [
            (provider, user)
            for provider, user in await matching_providers(session, booking, limit=limit)
            if user.id not in already
        ]
        if not targets:
            return 0
        area = await session.get(Area, booking.area_id)
        service = await session.get(ServiceType, booking.service_type_id)
        place = area.name if area else "your area"
        treatment = service.name if service else "Physiotherapy"
        when = _time_label(booking.preferred_start_at)

        messages = [
            TemplateMessage(
                to=user.phone,
                template=settings.whatsapp_open_request_template,
                language=settings.whatsapp_template_language,
                parameters=[user.name or "Doctor", place, treatment, when],
            )
            for _, user in targets
        ]
        results = await asyncio.gather(
            *(sender.send(message) for message in messages), return_exceptions=True
        )
        sent = 0
        now = datetime.now(UTC)
        for (provider, user), result in zip(targets, results, strict=True):
            failed = isinstance(result, BaseException)
            if failed and not isinstance(result, WhatsAppError):
                logger.error("whatsapp_send_crashed", error=type(result).__name__)
            sent += 0 if failed else 1
            session.add(
                Notification(
                    user_id=user.id,
                    booking_id=booking.id,
                    type=NotificationType.OPEN_REQUEST,
                    channel=NotificationChannel.WHATSAPP,
                    status=NotificationStatus.FAILED if failed else NotificationStatus.SENT,
                    title="New request in your area",
                    body=f"{treatment} in {place}, {when}",
                    data={
                        "provider_id": str(provider.id),
                        "message_id": None if failed else result,
                    },
                    error=str(result)[:500] if failed else None,
                    sent_at=None if failed else now,
                )
            )
        await session.commit()
        logger.info("open_request_alerted", booking=str(booking.id), sent=sent, tried=len(targets))
        return sent
    except Exception:  # An alert must never undo or block the order itself.
        logger.exception("open_request_alert_failed", booking=str(booking.id))
        await session.rollback()
        return 0


async def alert_open_requests(
    session: AsyncSession, bookings: list[Booking], sender: WhatsAppSender, settings: Settings
) -> None:
    for booking in bookings:
        await alert_open_request(session, booking, sender, settings)


# The physiotherapist's view ---------------------------------------------------------------------


@dataclass(frozen=True)
class OpenRequest:
    booking: Booking
    service_name: str
    area_name: str
    patient_gender: str
    patient_birth_year: int | None
    price_total_pkr: int | None
    can_pick: bool
    reason: str | None


async def list_open_requests(session: AsyncSession, provider: Provider) -> list[OpenRequest]:
    """Requests this physiotherapist could take, soonest first. No names, addresses or phones."""
    services = select(ProviderService.service_type_id).where(
        ProviderService.provider_id == provider.id
    )
    areas = select(ProviderArea.area_id).where(ProviderArea.provider_id == provider.id)
    place = []
    if provider.visit_home:
        place.append(and_(Booking.visit_type == VisitType.HOME, Booking.area_id.in_(areas)))
    if provider.visit_clinic and provider.clinic_area_id is not None:
        place.append(
            and_(Booking.visit_type == VisitType.CLINIC, Booking.area_id == provider.clinic_area_id)
        )
    if not place:
        return []
    passed = select(BookingAssignment.booking_id).where(
        BookingAssignment.provider_id == provider.id, BookingAssignment.status.in_(_PASSED)
    )
    bookings = list(
        await session.scalars(
            select(Booking)
            .where(
                Booking.status == BookingStatus.PENDING_ASSIGNMENT,
                Booking.provider_id.is_(None),
                Booking.preferred_start_at > datetime.now(UTC) + BOOKING_LEAD,
                Booking.service_type_id.in_(services),
                or_(*place),
                Booking.id.not_in(passed),
            )
            .order_by(Booking.preferred_start_at)
            .limit(50)
        )
    )
    minimum = (await get_platform_settings(session)).minimum_balance_pkr
    results = []
    for booking in bookings:
        reason = None
        if provider.fee_pkr is None:
            reason = "Set your fee first."
        elif provider.balance_pkr < minimum:
            reason = f"Top up: your balance is below the Rs {minimum:,} minimum."
        else:
            try:
                await require_free_slot(
                    session,
                    provider,
                    booking.preferred_start_at,
                    provider.slot_minutes,
                    within_hours=False,
                )
            except ConflictError:
                reason = "You have another visit or time off then."
        patient = await session.get(Patient, booking.patient_id)
        service = await session.get(ServiceType, booking.service_type_id)
        area = await session.get(Area, booking.area_id)
        results.append(
            OpenRequest(
                booking=booking,
                service_name=service.name if service else "",
                area_name=area.name if area else "",
                patient_gender=patient.gender.value if patient else "",
                patient_birth_year=patient.birth_year if patient else None,
                price_total_pkr=provider.fee_pkr * booking.sessions_count
                if provider.fee_pkr
                else None,
                can_pick=reason is None,
                reason=reason,
            )
        )
    return results


async def pick_open_request(
    session: AsyncSession, booking_id: UUID, provider: Provider, user: User
) -> Booking:
    """Take an open request. The first physiotherapist to pick it gets it, already confirmed."""
    booking = await session.get(Booking, booking_id, with_for_update=True, populate_existing=True)
    if booking is None:
        raise NotFoundError("This request was not found.")
    if not _is_open(booking):
        raise RequestTakenError
    if provider.id in await _passed_on(session, booking.id):
        raise ConflictError("You already passed on this request.")
    picked = await _require_bookable_provider(
        session,
        provider.id,
        booking.service_type_id,
        booking.area_id,
        booking.preferred_start_at,
        booking.visit_type,
        ignore_booking=booking.id,
        within_hours=False,
    )
    now = datetime.now(UTC)
    _price_from(picked, booking)
    booking.provider_id = picked.id
    booking.status = BookingStatus.ACTIVE
    booking.hold_expires_at = None
    session.add(
        BookingAssignment(
            booking_id=booking.id,
            provider_id=picked.id,
            assigned_by_id=user.id,
            status=AssignmentStatus.ACCEPTED,
            responded_at=now,
        )
    )
    await session.flush()
    await _add_session(session, booking, picked.id, booking.preferred_start_at, user.id)
    record_audit(
        session,
        actor_id=user.id,
        action="booking.picked",
        entity_type="booking",
        entity_id=str(booking.id),
        metadata={"provider_id": str(picked.id)},
    )
    await session.commit()
    return booking


async def alert_counts(session: AsyncSession, booking_id: UUID) -> tuple[int, int]:
    """How many WhatsApp alerts went out for an order, and how many failed."""
    rows = await session.scalars(
        select(Notification.status).where(
            Notification.booking_id == booking_id,
            Notification.type == NotificationType.OPEN_REQUEST,
        )
    )
    statuses = list(rows)
    return (
        sum(1 for status in statuses if status == NotificationStatus.SENT),
        sum(1 for status in statuses if status == NotificationStatus.FAILED),
    )


# Why an alert did or didn't go out --------------------------------------------------------------


@dataclass(frozen=True)
class AlertCheck:
    provider_id: UUID
    name: str | None
    phone: str
    eligible: bool
    reasons: list[str]
    alert_status: str | None
    alert_error: str | None
    alerted_at: datetime | None


async def check_alerts(session: AsyncSession, booking: Booking) -> list[AlertCheck]:
    """For every approved physiotherapist: would they be alerted for this order, and if not, why.

    Staff use it to see why nobody got a WhatsApp, without reading server logs.
    """
    platform = await get_platform_settings(session)
    passed = await _passed_on(session, booking.id)
    area = await session.get(Area, booking.area_id)
    service = await session.get(ServiceType, booking.service_type_id)
    area_name = area.name if area else "this area"
    sent: dict[UUID, Notification] = {}
    for row in await session.scalars(
        select(Notification)
        .where(
            Notification.booking_id == booking.id,
            Notification.type == NotificationType.OPEN_REQUEST,
        )
        .order_by(Notification.created_at)
    ):
        sent[row.user_id] = row
    rows = await session.execute(
        select(Provider, User)
        .join(User, User.id == Provider.user_id)
        .where(Provider.status == ProviderStatus.APPROVED)
        .order_by(Provider.rating_avg.desc(), Provider.experience_years.desc())
        .limit(200)
    )
    checks = []
    for provider, user in rows.all():
        services = set(
            await session.scalars(
                select(ProviderService.service_type_id).where(
                    ProviderService.provider_id == provider.id
                )
            )
        )
        areas = set(
            await session.scalars(
                select(ProviderArea.area_id).where(ProviderArea.provider_id == provider.id)
            )
        )
        reasons: list[str] = []
        if not user.is_active:
            reasons.append("Account is inactive.")
        if not provider.whatsapp_alerts:
            reasons.append("Turned WhatsApp alerts off.")
        if provider.fee_pkr is None:
            reasons.append("No fee set.")
        if provider.balance_pkr < platform.minimum_balance_pkr:
            reasons.append(f"Balance is below the Rs {platform.minimum_balance_pkr:,} minimum.")
        if booking.service_type_id not in services:
            reasons.append(f"Doesn't treat {service.name if service else 'this'}.")
        if booking.visit_type == VisitType.CLINIC:
            if not provider.visit_clinic or provider.clinic_area_id != booking.area_id:
                reasons.append(f"Has no clinic in {area_name}.")
        elif not provider.visit_home:
            reasons.append("Doesn't do home visits.")
        elif booking.area_id not in areas:
            reasons.append(f"Doesn't cover {area_name}.")
        if provider.id in passed:
            reasons.append("Declined this order, or didn't reply in time.")
        try:
            await require_free_slot(
                session,
                provider,
                booking.preferred_start_at,
                provider.slot_minutes,
                ignore_booking=booking.id,
                within_hours=False,
            )
        except ConflictError as exc:
            reasons.append(f"Not free then: {exc.message}")
        alert = sent.get(user.id)
        checks.append(
            AlertCheck(
                provider_id=provider.id,
                name=user.name,
                phone=user.phone,
                eligible=not reasons,
                reasons=reasons,
                alert_status=alert.status.value if alert else None,
                alert_error=alert.error if alert else None,
                alerted_at=alert.sent_at or alert.created_at if alert else None,
            )
        )
    # Those who got or would get an alert first, then the rest.
    checks.sort(key=lambda check: (check.alert_status is None, not check.eligible))
    return checks
