"""Business rules for contact messages."""

from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import Settings
from khidmat_api.core.errors import RateLimitedError
from khidmat_api.core.requests import hash_ip
from khidmat_api.modules.contact.models import ContactMessage, ContactMessageStatus
from khidmat_api.modules.contact.schemas import ContactMessageCreate

logger = structlog.get_logger("khidmat.contact")

_RATE_LIMIT_WINDOW = timedelta(hours=1)


async def submit_contact_message(
    session: AsyncSession, payload: ContactMessageCreate, *, client_ip: str, settings: Settings
) -> None:
    # Bots get the normal success response, so they don't learn they were detected.
    if payload.website:
        logger.info("contact_message_dropped", reason="honeypot")
        return

    # Counted in the database because serverless instances don't share memory.
    ip_hash = hash_ip(client_ip, settings)
    recent = await session.scalar(
        select(func.count())
        .select_from(ContactMessage)
        .where(
            ContactMessage.ip_hash == ip_hash,
            ContactMessage.created_at > datetime.now(UTC) - _RATE_LIMIT_WINDOW,
        )
    )
    if recent is not None and recent >= settings.contact_rate_limit_per_hour:
        raise RateLimitedError

    session.add(
        ContactMessage(
            name=payload.name,
            phone=payload.phone,
            message=payload.message,
            locale=payload.locale,
            ip_hash=ip_hash,
        )
    )
    await session.commit()
    logger.info("contact_message_received", locale=payload.locale)  # No personal data in logs.


async def count_new_messages(session: AsyncSession) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(ContactMessage)
        .where(ContactMessage.status == ContactMessageStatus.NEW)
    )
    return count or 0


async def count_recent_messages(session: AsyncSession, *, days: int) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(ContactMessage)
        .where(ContactMessage.created_at > datetime.now(UTC) - timedelta(days=days))
    )
    return count or 0
