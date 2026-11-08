"""Login, session rotation and logout."""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid7

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import Settings
from khidmat_api.core.errors import ConflictError, RateLimitedError, UnauthorizedError
from khidmat_api.core.phone import normalize_phone
from khidmat_api.core.requests import hash_ip
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.identity.models import RefreshToken, Role, User
from khidmat_api.modules.identity.schemas import RegisterRequest
from khidmat_api.modules.identity.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)

logger = structlog.get_logger("khidmat.auth")

MAX_FAILED_LOGINS = 5
LOCK_DURATION = timedelta(minutes=15)
# Two browser tabs can refresh at the same moment. That isn't token theft.
REFRESH_REUSE_GRACE = timedelta(seconds=10)

MAX_SIGNUPS_PER_HOUR = 5
_SIGNUP_WINDOW = timedelta(hours=1)

_INVALID_CREDENTIALS = "The login details are incorrect."


@dataclass(frozen=True)
class SessionTokens:
    user: User
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class ClientInfo:
    ip_address: str
    user_agent: str | None


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def _issue_tokens(
    session: AsyncSession,
    user: User,
    settings: Settings,
    client: ClientInfo,
    family_id: UUID,
) -> SessionTokens:
    refresh_token = new_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            family_id=family_id,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
            user_agent=client.user_agent[:512] if client.user_agent else None,
            ip_address=client.ip_address[:45],
        )
    )
    return SessionTokens(user, create_access_token(user.id, settings), refresh_token)


async def _find_login_user(session: AsyncSession, identifier: str) -> User | None:
    if "@" in identifier:
        return await session.scalar(select(User).where(User.email == normalize_email(identifier)))
    try:
        phone = normalize_phone(identifier)
    except ValueError:
        return None
    return await session.scalar(select(User).where(User.phone == phone))


async def login(
    session: AsyncSession, identifier: str, password: str, settings: Settings, client: ClientInfo
) -> SessionTokens:
    user = await _find_login_user(session, identifier)
    now = datetime.now(UTC)

    if user is not None and user.locked_until is not None and user.locked_until > now:
        raise RateLimitedError("Too many failed attempts. Please try again later.")

    # Hashing is CPU-heavy, so it runs off the event loop to keep other requests moving.
    password_hash = user.password_hash if user is not None else None
    valid = await asyncio.to_thread(verify_password, password, password_hash)

    if user is None or not valid or not user.is_active:
        if user is not None:
            user.failed_login_count += 1
            if user.failed_login_count >= MAX_FAILED_LOGINS:
                user.locked_until = now + LOCK_DURATION
                user.failed_login_count = 0
            record_audit(
                session,
                actor_id=user.id,
                action="auth.login_failed",
                entity_type="user",
                entity_id=str(user.id),
                ip_address=client.ip_address,
            )
            await session.commit()
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    user.failed_login_count = 0
    user.locked_until = None
    tokens = await _issue_tokens(session, user, settings, client, family_id=uuid7())
    record_audit(
        session,
        actor_id=user.id,
        action="auth.login",
        entity_type="user",
        entity_id=str(user.id),
        ip_address=client.ip_address,
    )
    await session.commit()
    return tokens


async def _revoke_family(session: AsyncSession, family_id: UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def refresh_session(
    session: AsyncSession, refresh_token: str | None, settings: Settings, client: ClientInfo
) -> SessionTokens:
    """Swap a refresh token for a new one. Each token works only once."""
    if not refresh_token:
        raise UnauthorizedError

    stored = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
        .with_for_update()
    )
    if stored is None:
        raise UnauthorizedError

    now = datetime.now(UTC)
    if stored.revoked_at is not None:
        # An old token used again suggests theft, so the whole login is ended.
        if now - stored.revoked_at > REFRESH_REUSE_GRACE:
            await _revoke_family(session, stored.family_id)
            await session.commit()
            logger.warning("refresh_token_reused", user_id=str(stored.user_id))
        raise UnauthorizedError

    user = await session.get(User, stored.user_id)
    if stored.expires_at <= now or user is None or not user.is_active:
        raise UnauthorizedError

    stored.revoked_at = now
    tokens = await _issue_tokens(session, user, settings, client, family_id=stored.family_id)
    await session.commit()
    return tokens


async def logout(session: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
    )
    if stored is not None:
        await _revoke_family(session, stored.family_id)
        await session.commit()


async def revoke_all_sessions(session: AsyncSession, user_id: UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def register(
    session: AsyncSession, payload: RegisterRequest, settings: Settings, client: ClientInfo
) -> SessionTokens:
    ip_hash = hash_ip(client.ip_address, settings)
    recent = await session.scalar(
        select(func.count())
        .select_from(User)
        .where(
            User.signup_ip_hash == ip_hash,
            User.created_at > datetime.now(UTC) - _SIGNUP_WINDOW,
        )
    )
    if recent is not None and recent >= MAX_SIGNUPS_PER_HOUR:
        raise RateLimitedError

    user = User(
        name=payload.name,
        phone=payload.phone,
        role=Role(payload.role),
        password_hash=await asyncio.to_thread(hash_password, payload.password),
        signup_ip_hash=ip_hash,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("An account with this phone number already exists.") from exc

    tokens = await _issue_tokens(session, user, settings, client, family_id=uuid7())
    record_audit(
        session,
        actor_id=user.id,
        action="auth.registered",
        entity_type="user",
        entity_id=str(user.id),
        metadata={"role": user.role.value},
        ip_address=client.ip_address,
    )
    await session.commit()
    await session.refresh(user)
    return tokens


async def change_password(
    session: AsyncSession,
    user: User,
    current_password: str,
    new_password: str,
    settings: Settings,
    client: ClientInfo,
) -> SessionTokens:
    if not await asyncio.to_thread(verify_password, current_password, user.password_hash):
        raise UnauthorizedError("The current password is incorrect.")
    if current_password == new_password:
        raise ConflictError("Choose a password different from the current one.")

    user.password_hash = await asyncio.to_thread(hash_password, new_password)
    user.must_change_password = False
    user.password_changed_at = datetime.now(UTC)
    await revoke_all_sessions(session, user.id)
    tokens = await _issue_tokens(session, user, settings, client, family_id=uuid7())
    record_audit(
        session,
        actor_id=user.id,
        action="auth.password_changed",
        entity_type="user",
        entity_id=str(user.id),
        ip_address=client.ip_address,
    )
    await session.commit()
    await session.refresh(user)
    return tokens
