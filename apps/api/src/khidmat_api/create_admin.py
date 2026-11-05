"""Create or update an admin account. Run with: uv run python -m khidmat_api.create_admin

The password is typed into a hidden prompt, so it never lands in shell history or env files.
"""

import asyncio
import getpass
import re
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import get_settings
from khidmat_api.core.database import create_engine, create_session_factory
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.identity.security import hash_password
from khidmat_api.modules.identity.service import normalize_email

MIN_PASSWORD_LENGTH = 12
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_E164_PHONE = re.compile(r"^\+[1-9]\d{7,14}$")


def validate_admin_input(email: str, phone: str, password: str) -> None:
    if not _EMAIL.match(email):
        raise ValueError("Enter a valid email address.")
    if not _E164_PHONE.match(phone):
        raise ValueError("Enter the phone in international format, e.g. +923001234567.")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"The password must have at least {MIN_PASSWORD_LENGTH} characters.")


async def upsert_admin(
    session: AsyncSession, *, email: str, phone: str, name: str, password: str
) -> User:
    email = normalize_email(email)
    validate_admin_input(email, phone, password)
    user = await session.scalar(select(User).where(User.email == email))
    if user is None:
        user = await session.scalar(select(User).where(User.phone == phone))
    if user is None:
        user = User(phone=phone)
        session.add(user)
    user.email = email
    user.phone = phone
    user.name = name
    user.role = Role.ADMIN
    user.is_active = True
    user.failed_login_count = 0
    user.locked_until = None
    user.password_hash = hash_password(password)
    await session.flush()
    record_audit(
        session,
        actor_id=None,
        action="admin.created_from_cli",
        entity_type="user",
        entity_id=str(user.id),
    )
    return user


async def _save_admin(email: str, phone: str, name: str, password: str) -> None:
    engine = create_engine(get_settings())
    try:
        async with create_session_factory(engine)() as session:
            await upsert_admin(session, email=email, phone=phone, name=name, password=password)
            await session.commit()
    finally:
        await engine.dispose()


def main() -> None:
    email = input("Admin email: ").strip()
    phone = input("Admin phone (+923001234567): ").strip()
    name = input("Admin name: ").strip()
    password = getpass.getpass("Password (hidden, 12+ characters): ")
    if password != getpass.getpass("Repeat password: "):
        sys.exit("The passwords don't match.")
    try:
        asyncio.run(_save_admin(email, phone, name, password))
    except ValueError as exc:
        sys.exit(str(exc))
    sys.stdout.write("Admin account is ready.\n")


if __name__ == "__main__":
    main()
