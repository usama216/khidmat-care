"""Staff accounts: created and controlled by admins only."""

import asyncio
import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.identity.permissions import STAFF_ROLES
from khidmat_api.modules.identity.schemas import StaffCreate, StaffUpdate
from khidmat_api.modules.identity.security import hash_password
from khidmat_api.modules.identity.service import normalize_email, revoke_all_sessions


def _temporary_password() -> str:
    return secrets.token_urlsafe(12)


async def list_staff(session: AsyncSession, *, offset: int, limit: int) -> tuple[list[User], int]:
    condition = User.role.in_(STAFF_ROLES)
    total = await session.scalar(select(func.count()).select_from(User).where(condition))
    rows = await session.scalars(
        select(User).where(condition).order_by(User.created_at, User.id).offset(offset).limit(limit)
    )
    return list(rows), total or 0


async def create_staff(
    session: AsyncSession, payload: StaffCreate, *, actor: User, ip_address: str
) -> tuple[User, str]:
    temporary = _temporary_password()
    user = User(
        name=payload.name,
        phone=payload.phone,
        email=normalize_email(payload.email),
        role=Role(payload.role),
        password_hash=await asyncio.to_thread(hash_password, temporary),
        must_change_password=True,
        password_changed_at=datetime.now(UTC),
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("An account with this phone or email already exists.") from exc
    record_audit(
        session,
        actor_id=actor.id,
        action="staff.created",
        entity_type="user",
        entity_id=str(user.id),
        metadata={"role": user.role.value},
        ip_address=ip_address,
    )
    await session.commit()
    await session.refresh(user)
    return user, temporary


async def _get_staff(session: AsyncSession, user_id: UUID) -> User:
    user = await session.get(User, user_id)
    if user is None or user.role not in STAFF_ROLES:
        raise NotFoundError("This staff member was not found.")
    return user


async def update_staff(
    session: AsyncSession, user_id: UUID, payload: StaffUpdate, *, actor: User, ip_address: str
) -> User:
    user = await _get_staff(session, user_id)
    changes = payload.model_dump(exclude_unset=True)
    # Because no one can demote or deactivate themselves, at least one admin always remains.
    if user.id == actor.id and ("role" in changes or "is_active" in changes):
        raise ConflictError("You can't change your own role or deactivate yourself.")

    if changes.get("name") is not None:
        user.name = changes["name"]
    if changes.get("role") is not None:
        user.role = Role(changes["role"])
    if changes.get("is_active") is not None:
        user.is_active = changes["is_active"]
        if not user.is_active:
            await revoke_all_sessions(session, user.id)

    record_audit(
        session,
        actor_id=actor.id,
        action="staff.updated",
        entity_type="user",
        entity_id=str(user.id),
        metadata={key: changes[key] for key in sorted(changes) if key != "name"},
        ip_address=ip_address,
    )
    await session.commit()
    await session.refresh(user)
    return user


async def reset_staff_password(
    session: AsyncSession, user_id: UUID, *, actor: User, ip_address: str
) -> tuple[User, str]:
    user = await _get_staff(session, user_id)
    temporary = _temporary_password()
    user.password_hash = await asyncio.to_thread(hash_password, temporary)
    user.must_change_password = True
    user.password_changed_at = datetime.now(UTC)
    user.failed_login_count = 0
    user.locked_until = None
    await revoke_all_sessions(session, user.id)
    record_audit(
        session,
        actor_id=actor.id,
        action="staff.password_reset",
        entity_type="user",
        entity_id=str(user.id),
        ip_address=ip_address,
    )
    await session.commit()
    await session.refresh(user)
    return user, temporary
