"""Physiotherapist onboarding, verification, public profiles and availability."""

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from itertools import pairwise
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import Settings
from khidmat_api.core.crypto import decrypt_text, encrypt_text, keyed_hash
from khidmat_api.core.enums import Gender
from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.files.models import FilePurpose
from khidmat_api.modules.files.service import require_owned_file
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.providers.models import (
    Availability,
    DocumentType,
    Provider,
    ProviderArea,
    ProviderDocument,
    ProviderService,
    ProviderStatus,
)

LOCAL_TIMEZONE = ZoneInfo("Asia/Karachi")
SESSION_MINUTES = 60
_CNIC = re.compile(r"^\d{13}$")
_REQUIRED_DOCUMENTS = {DocumentType.CNIC_FRONT, DocumentType.CNIC_BACK, DocumentType.DEGREE}
VERIFICATION_CHECKS = ("documents", "cnic", "degree", "interview", "agreement")


@dataclass(frozen=True)
class ProfileInput:
    gender: Gender
    cnic: str | None
    qualification: str
    experience_years: int
    bio: str | None
    photo_file_id: UUID | None
    service_type_ids: list[UUID]
    area_ids: list[UUID]


def normalize_cnic(value: str) -> str:
    digits = value.replace("-", "").replace(" ", "")
    if not _CNIC.match(digits):
        raise ConflictError("Enter a valid 13-digit CNIC number.")
    return digits


def mask_cnic(cnic: str) -> str:
    return f"{cnic[:5]}-*******-{cnic[-1]}"


async def get_provider_by_user(session: AsyncSession, user_id: UUID) -> Provider | None:
    return await session.scalar(select(Provider).where(Provider.user_id == user_id))


async def require_provider_for_user(session: AsyncSession, user_id: UUID) -> Provider:
    provider = await get_provider_by_user(session, user_id)
    if provider is None:
        raise ConflictError("Complete your profile first.")
    return provider


async def get_provider_lists(
    session: AsyncSession, provider_id: UUID
) -> tuple[list[UUID], list[UUID]]:
    services = await session.scalars(
        select(ProviderService.service_type_id).where(ProviderService.provider_id == provider_id)
    )
    areas = await session.scalars(
        select(ProviderArea.area_id).where(ProviderArea.provider_id == provider_id)
    )
    return list(services), list(areas)


async def _set_links(session: AsyncSession, provider_id: UUID, data: ProfileInput) -> None:
    await session.execute(delete(ProviderService).where(ProviderService.provider_id == provider_id))
    await session.execute(delete(ProviderArea).where(ProviderArea.provider_id == provider_id))
    session.add_all(
        [
            ProviderService(provider_id=provider_id, service_type_id=sid)
            for sid in set(data.service_type_ids)
        ]
    )
    session.add_all(
        [ProviderArea(provider_id=provider_id, area_id=aid) for aid in set(data.area_ids)]
    )


async def save_profile(
    session: AsyncSession, user: User, data: ProfileInput, settings: Settings
) -> Provider:
    if not data.service_type_ids or not data.area_ids:
        raise ConflictError("Choose at least one service and one area.")
    if data.photo_file_id is not None:
        await require_owned_file(
            session, data.photo_file_id, user=user, purpose=FilePurpose.PROVIDER_PHOTO
        )
    cnic = normalize_cnic(data.cnic) if data.cnic else None
    provider = await get_provider_by_user(session, user.id)
    locked = provider is not None and provider.status in {
        ProviderStatus.PENDING,
        ProviderStatus.APPROVED,
        ProviderStatus.SUSPENDED,
    }

    if provider is None:
        if cnic is None:
            raise ConflictError("Enter your 13-digit CNIC number.")
        provider = Provider(
            user_id=user.id,
            gender=data.gender,
            cnic_encrypted=encrypt_text(cnic, settings),
            cnic_hash=keyed_hash(cnic, settings),
            qualification=data.qualification,
            experience_years=data.experience_years,
            verification_checks={},
        )
        session.add(provider)
    elif not locked:
        provider.gender = data.gender
        if cnic is not None:
            provider.cnic_encrypted = encrypt_text(cnic, settings)
            provider.cnic_hash = keyed_hash(cnic, settings)
        provider.qualification = data.qualification
        provider.experience_years = data.experience_years

    # Verified details stay frozen. Bio, photo, services and areas can always change.
    provider.bio = data.bio
    if data.photo_file_id is not None:
        provider.photo_file_id = data.photo_file_id
    try:
        await session.flush()
        await _set_links(session, provider.id, data)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("This CNIC is already registered, or a choice is invalid.") from exc
    return provider


async def add_document(
    session: AsyncSession, user: User, document_type: DocumentType, file_id: UUID
) -> ProviderDocument:
    provider = await require_provider_for_user(session, user.id)
    if provider.status in {ProviderStatus.APPROVED, ProviderStatus.PENDING}:
        raise ConflictError("Documents can't be changed during or after review.")
    await require_owned_file(session, file_id, user=user, purpose=FilePurpose.PROVIDER_DOCUMENT)
    await session.execute(
        delete(ProviderDocument).where(
            ProviderDocument.provider_id == provider.id, ProviderDocument.type == document_type
        )
    )
    document = ProviderDocument(provider_id=provider.id, type=document_type, file_id=file_id)
    session.add(document)
    await session.commit()
    return document


async def list_documents(session: AsyncSession, provider_id: UUID) -> list[ProviderDocument]:
    rows = await session.scalars(
        select(ProviderDocument).where(ProviderDocument.provider_id == provider_id)
    )
    return list(rows)


async def submit_for_review(
    session: AsyncSession, user: User, *, accept_agreement: bool
) -> Provider:
    provider = await require_provider_for_user(session, user.id)
    if provider.status not in {ProviderStatus.DRAFT, ProviderStatus.REJECTED}:
        raise ConflictError("Your application is already submitted.")
    if not accept_agreement:
        raise ConflictError("Please accept the physiotherapist agreement.")
    documents = {document.type for document in await list_documents(session, provider.id)}
    missing = _REQUIRED_DOCUMENTS - documents
    if missing or provider.photo_file_id is None:
        raise ConflictError(
            "Upload your photo, both sides of your CNIC and your degree before submitting."
        )
    now = datetime.now(UTC)
    provider.status = ProviderStatus.PENDING
    provider.status_reason = None
    provider.verification_checks = {}
    provider.submitted_at = now
    provider.agreement_accepted_at = now
    record_audit(
        session,
        actor_id=user.id,
        action="provider.submitted",
        entity_type="provider",
        entity_id=str(provider.id),
    )
    await session.commit()
    return provider


async def set_availability(
    session: AsyncSession, user: User, slots: list[tuple[int, int, int]]
) -> list[Availability]:
    provider = await require_provider_for_user(session, user.id)
    for day in range(7):
        ranges = sorted((start, end) for slot_day, start, end in slots if slot_day == day)
        for (_, first_end), (second_start, _) in pairwise(ranges):
            if second_start < first_end:
                raise ConflictError("Availability times overlap on the same day.")
    await session.execute(delete(Availability).where(Availability.provider_id == provider.id))
    rows = [
        Availability(provider_id=provider.id, day_of_week=day, start_minute=start, end_minute=end)
        for day, start, end in slots
    ]
    session.add_all(rows)
    await session.commit()
    return rows


async def get_availability(session: AsyncSession, provider_id: UUID) -> list[Availability]:
    rows = await session.scalars(
        select(Availability)
        .where(Availability.provider_id == provider_id)
        .order_by(Availability.day_of_week, Availability.start_minute)
    )
    return list(rows)


# Admin -----------------------------------------------------------------------------------------


async def list_providers_admin(
    session: AsyncSession,
    *,
    status: ProviderStatus | None,
    search: str | None,
    offset: int,
    limit: int,
) -> tuple[list[tuple[Provider, User]], int]:
    filters: list[Any] = []
    if status is not None:
        filters.append(Provider.status == status)
    if search and search.strip():
        pattern = (
            "%" + search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        )
        filters.append(
            or_(User.name.ilike(pattern, escape="\\"), User.phone.ilike(pattern, escape="\\"))
        )
    base = select(Provider, User).join(User, User.id == Provider.user_id).where(*filters)
    total = await session.scalar(
        select(func.count())
        .select_from(Provider)
        .join(User, User.id == Provider.user_id)
        .where(*filters)
    )
    rows = await session.execute(
        base.order_by(Provider.submitted_at.desc().nulls_last(), Provider.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return [(provider, user) for provider, user in rows.all()], total or 0


async def get_provider_admin(session: AsyncSession, provider_id: UUID) -> tuple[Provider, User]:
    row = (
        await session.execute(
            select(Provider, User)
            .join(User, User.id == Provider.user_id)
            .where(Provider.id == provider_id)
        )
    ).first()
    if row is None:
        raise NotFoundError("This physiotherapist was not found.")
    return row[0], row[1]


def reveal_cnic(provider: Provider, settings: Settings) -> str:
    return decrypt_text(provider.cnic_encrypted, settings)


async def set_verification_check(
    session: AsyncSession,
    provider_id: UUID,
    check: str,
    *,
    done: bool,
    actor: User,
    ip_address: str,
) -> Provider:
    if check not in VERIFICATION_CHECKS:
        raise ConflictError("Unknown verification check.")
    provider, _ = await get_provider_admin(session, provider_id)
    if provider.status != ProviderStatus.PENDING:
        raise ConflictError("Only pending applications can be checked.")
    checks = dict(provider.verification_checks)
    if done:
        checks[check] = datetime.now(UTC).isoformat()
    else:
        checks.pop(check, None)
    provider.verification_checks = checks
    record_audit(
        session,
        actor_id=actor.id,
        action="provider.check_updated",
        entity_type="provider",
        entity_id=str(provider.id),
        metadata={"check": check, "done": done},
        ip_address=ip_address,
    )
    await session.commit()
    return provider


_ALLOWED_DECISIONS: dict[str, tuple[set[ProviderStatus], ProviderStatus]] = {
    "approve": ({ProviderStatus.PENDING}, ProviderStatus.APPROVED),
    "reject": ({ProviderStatus.PENDING}, ProviderStatus.REJECTED),
    "suspend": ({ProviderStatus.APPROVED}, ProviderStatus.SUSPENDED),
    "reactivate": ({ProviderStatus.SUSPENDED}, ProviderStatus.APPROVED),
}


async def decide_provider(
    session: AsyncSession,
    provider_id: UUID,
    decision: str,
    *,
    reason: str | None,
    actor: User,
    ip_address: str,
) -> Provider:
    provider, _ = await get_provider_admin(session, provider_id)
    allowed, target = _ALLOWED_DECISIONS[decision]
    if provider.status not in allowed:
        raise ConflictError(f"You can't {decision} a physiotherapist in this status.")
    if decision in {"reject", "suspend"} and not reason:
        raise ConflictError("Please give a reason.")
    if decision == "approve":
        missing = [c for c in VERIFICATION_CHECKS if c not in provider.verification_checks]
        if missing:
            raise ConflictError("Complete every verification check before approving.")
        provider.approved_at = datetime.now(UTC)
    provider.status = target
    provider.status_reason = reason
    record_audit(
        session,
        actor_id=actor.id,
        action=f"provider.{decision}",
        entity_type="provider",
        entity_id=str(provider.id),
        metadata={"reason": reason} if reason else None,
        ip_address=ip_address,
    )
    await session.commit()
    return provider


# Public -----------------------------------------------------------------------------------------


async def list_public_providers(
    session: AsyncSession,
    *,
    minimum_balance: int,
    service_id: UUID | None,
    area_id: UUID | None,
    gender: Gender | None,
) -> list[tuple[Provider, User]]:
    """Approved physiotherapists who can take new orders. No contact details leave this query."""
    query = (
        select(Provider, User)
        .join(User, User.id == Provider.user_id)
        .where(
            Provider.status == ProviderStatus.APPROVED,
            User.is_active,
            Provider.balance_pkr >= minimum_balance,
        )
        .order_by(Provider.rating_avg.desc(), Provider.experience_years.desc())
    )
    if gender is not None:
        query = query.where(Provider.gender == gender)
    if service_id is not None:
        query = query.where(
            Provider.id.in_(
                select(ProviderService.provider_id).where(
                    ProviderService.service_type_id == service_id
                )
            )
        )
    if area_id is not None:
        query = query.where(
            Provider.id.in_(select(ProviderArea.provider_id).where(ProviderArea.area_id == area_id))
        )
    rows = await session.execute(query.limit(100))
    return [(provider, user) for provider, user in rows.all()]


def is_within_availability(rows: list[Availability], start: datetime) -> bool:
    local = start.astimezone(LOCAL_TIMEZONE)
    day = (local.weekday() + 1) % 7  # Python's Monday=0 becomes our Sunday=0.
    minute = local.hour * 60 + local.minute
    return any(
        row.day_of_week == day
        and row.start_minute <= minute
        and minute + SESSION_MINUTES <= row.end_minute
        for row in rows
    )


def build_slots(
    rows: list[Availability], day: date, busy: list[datetime], *, now: datetime
) -> list[datetime]:
    """Hourly start times on a day, excluding past times and times the physiotherapist is busy."""
    weekday = (day.weekday() + 1) % 7
    slots: list[datetime] = []
    for row in rows:
        if row.day_of_week != weekday:
            continue
        minute = row.start_minute
        while minute + SESSION_MINUTES <= row.end_minute:
            start = datetime(
                day.year, day.month, day.day, minute // 60, minute % 60, tzinfo=LOCAL_TIMEZONE
            )
            clashes = any(abs(start - other) < timedelta(minutes=SESSION_MINUTES) for other in busy)
            if start > now and not clashes:
                slots.append(start)
            minute += SESSION_MINUTES
    return sorted(slots)


async def update_provider_rating(session: AsyncSession, provider_id: UUID, rating: int) -> None:
    provider = await session.get(Provider, provider_id, with_for_update=True)
    if provider is None:
        return
    total = provider.rating_avg * provider.rating_count + rating
    provider.rating_count += 1
    provider.rating_avg = round(total / provider.rating_count, 2)


async def count_providers(session: AsyncSession, status: ProviderStatus) -> int:
    count = await session.scalar(
        select(func.count()).select_from(Provider).where(Provider.status == status)
    )
    return count or 0
