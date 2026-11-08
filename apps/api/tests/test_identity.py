"""Phone login, self-registration, password changes, staff roles and permissions."""

import re

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.audit.models import AuditLog
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.identity.permissions import STAFF_ROLES, Permission, permissions_for
from tests.test_auth import EMAIL, LOGIN, ME, PASSWORD, make_user

REGISTER = "/api/v1/auth/register"
CHANGE_PASSWORD = "/api/v1/auth/change-password"
STAFF = "/api/v1/admin/staff"
PATIENT = {
    "name": "Ali Raza",
    "phone": "0300-1112222",
    "password": "a-good-password",
    "role": "PATIENT",
}
NEW_STAFF = {
    "name": "Sana Ops",
    "phone": "03004445555",
    "email": "Sana@Khidmat.example",
    "role": "OPERATIONS",
}


@pytest.fixture
async def admin(client: AsyncClient, session: AsyncSession) -> User:
    user = await make_user(session)
    assert (
        await client.post(LOGIN, json={"identifier": EMAIL, "password": PASSWORD})
    ).status_code == 200
    return user


async def test_patient_can_register_and_is_signed_in(client: AsyncClient) -> None:
    response = await client.post(REGISTER, json=PATIENT)
    assert response.status_code == 201
    assert response.json()["phone"] == "+923001112222"
    assert response.json()["role"] == "PATIENT"
    assert (await client.get(ME)).status_code == 200


async def test_physiotherapist_can_register(client: AsyncClient) -> None:
    response = await client.post(REGISTER, json=PATIENT | {"role": "PROVIDER"})
    assert response.json()["role"] == "PROVIDER"


@pytest.mark.parametrize("role", ["ADMIN", "OPERATIONS", "SUPPORT", "FINANCE", "VERIFICATION"])
async def test_nobody_can_register_as_staff(client: AsyncClient, role: str) -> None:
    assert (await client.post(REGISTER, json=PATIENT | {"role": role})).status_code == 422


@pytest.mark.parametrize(
    "changes",
    [
        {"name": "A"},
        {"phone": "12345"},
        {"password": "short"},
        {"is_active": True},
    ],
)
async def test_invalid_registration_is_rejected(
    client: AsyncClient, changes: dict[str, object]
) -> None:
    assert (await client.post(REGISTER, json=PATIENT | changes)).status_code == 422


async def test_phone_can_only_register_once(client: AsyncClient) -> None:
    await client.post(REGISTER, json=PATIENT)
    client.cookies.clear()
    duplicate = await client.post(REGISTER, json=PATIENT | {"phone": "+923001112222"})
    assert duplicate.status_code == 409


async def test_registration_is_rate_limited(client: AsyncClient) -> None:
    for number in range(5):
        response = await client.post(REGISTER, json=PATIENT | {"phone": f"0300111000{number}"})
        assert response.status_code == 201
    blocked = await client.post(REGISTER, json=PATIENT | {"phone": "03001110009"})
    assert blocked.status_code == 429


@pytest.mark.parametrize("identifier", ["03001112222", "0300-111 2222", "+923001112222"])
async def test_login_with_any_phone_format(client: AsyncClient, identifier: str) -> None:
    await client.post(REGISTER, json=PATIENT)
    client.cookies.clear()
    response = await client.post(
        LOGIN, json={"identifier": identifier, "password": PATIENT["password"]}
    )
    assert response.status_code == 200


async def test_malformed_identifier_gets_the_normal_login_error(client: AsyncClient) -> None:
    response = await client.post(LOGIN, json={"identifier": "not a phone", "password": "x"})
    assert response.status_code == 401


async def test_change_password_works_and_ends_other_sessions(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    await client.post(LOGIN, json={"identifier": EMAIL, "password": PASSWORD})

    wrong = await client.post(
        CHANGE_PASSWORD, json={"current_password": "nope", "new_password": "brand-new-password"}
    )
    assert wrong.status_code == 401

    changed = await client.post(
        CHANGE_PASSWORD, json={"current_password": PASSWORD, "new_password": "brand-new-password"}
    )
    assert changed.status_code == 200
    assert (await client.get(ME)).status_code == 200  # This session continues.

    client.cookies.clear()
    old = await client.post(LOGIN, json={"identifier": EMAIL, "password": PASSWORD})
    assert old.status_code == 401
    new = await client.post(LOGIN, json={"identifier": EMAIL, "password": "brand-new-password"})
    assert new.status_code == 200


async def test_new_password_must_differ(client: AsyncClient, session: AsyncSession) -> None:
    await make_user(session)
    await client.post(LOGIN, json={"identifier": EMAIL, "password": PASSWORD})
    same = await client.post(
        CHANGE_PASSWORD, json={"current_password": PASSWORD, "new_password": PASSWORD}
    )
    assert same.status_code == 409


def test_every_staff_role_has_defined_permissions() -> None:
    assert all(Permission.DASHBOARD_VIEW in permissions_for(role) for role in STAFF_ROLES)
    assert set(permissions_for(Role.ADMIN)) == set(Permission)
    assert permissions_for(Role.PATIENT) == frozenset()
    assert permissions_for(Role.PROVIDER) == frozenset()


def _route_status_url(path: str) -> str:
    return re.sub(r"\{[a-z_]+\}", "00000000-0000-0000-0000-000000000000", path)


ADMIN = "/api/v1/admin"
OVERVIEW = f"{ADMIN}/overview"
MESSAGES = f"{ADMIN}/contact-messages"
CATALOG = f"{ADMIN}/catalog"
BOOKINGS = f"{ADMIN}/bookings"
COMPLAINTS = (f"{ADMIN}/complaints", f"{ADMIN}/low-ratings")
REVIEWS = f"{ADMIN}/reviews"
PATIENTS = f"{ADMIN}/patients"
PROVIDERS = f"{ADMIN}/providers"
FINANCE = (f"{ADMIN}/wallet", f"{ADMIN}/settings")


@pytest.mark.parametrize(
    ("role", "allowed_prefix"),
    [
        (Role.OPERATIONS, (OVERVIEW, MESSAGES, CATALOG, BOOKINGS, PATIENTS, *COMPLAINTS, REVIEWS)),
        (Role.SUPPORT, (OVERVIEW, MESSAGES, BOOKINGS, PATIENTS, *COMPLAINTS, REVIEWS)),
        (Role.VERIFICATION, (OVERVIEW, PROVIDERS, REVIEWS)),
        (Role.FINANCE, (OVERVIEW, *FINANCE)),
        (Role.PROVIDER, ()),
        (Role.PATIENT, ()),
    ],
)
async def test_each_role_reaches_only_its_routes(
    app: FastAPI,
    client: AsyncClient,
    session: AsyncSession,
    role: Role,
    allowed_prefix: tuple[str, ...],
) -> None:
    await make_user(session, role=role)
    await client.post(LOGIN, json={"identifier": EMAIL, "password": PASSWORD})

    for path, methods in app.openapi()["paths"].items():
        if not path.startswith("/api/v1/admin"):
            continue
        for method in methods:
            response = await client.request(method.upper(), _route_status_url(path), json={})
            if path.startswith(allowed_prefix):
                assert response.status_code != 403, f"{role} blocked from {method} {path}"
            else:
                assert response.status_code == 403, f"{role} reached {method} {path}"


async def test_admin_creates_staff_with_a_temporary_password(
    client: AsyncClient, admin: User, session: AsyncSession
) -> None:
    created = await client.post(STAFF, json=NEW_STAFF)
    assert created.status_code == 201
    body = created.json()
    assert body["staff"]["email"] == "sana@khidmat.example"
    assert body["staff"]["phone"] == "+923004445555"
    temporary = body["temporary_password"]
    assert len(temporary) >= 12

    saved = await session.scalar(select(User).where(User.phone == "+923004445555"))
    assert saved is not None
    assert temporary not in (saved.password_hash or "")

    actions = await session.scalars(select(AuditLog).where(AuditLog.action == "staff.created"))
    assert temporary not in str(actions.one().metadata_)


async def test_temporary_password_must_be_changed_before_using_the_dashboard(
    client: AsyncClient, admin: User
) -> None:
    created = await client.post(STAFF, json=NEW_STAFF)
    temporary = created.json()["temporary_password"]
    client.cookies.clear()

    login = await client.post(
        LOGIN, json={"identifier": "sana@khidmat.example", "password": temporary}
    )
    assert login.json()["must_change_password"] is True

    blocked = await client.get("/api/v1/admin/overview")
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "password_change_required"

    changed = await client.post(
        CHANGE_PASSWORD,
        json={"current_password": temporary, "new_password": "my-own-new-password"},
    )
    assert changed.json()["must_change_password"] is False
    assert (await client.get("/api/v1/admin/overview")).status_code == 200


async def test_duplicate_staff_is_rejected(client: AsyncClient, admin: User) -> None:
    await client.post(STAFF, json=NEW_STAFF)
    duplicate = await client.post(STAFF, json=NEW_STAFF)
    assert duplicate.status_code == 409


@pytest.mark.parametrize("role", ["PATIENT", "PROVIDER", "OWNER"])
async def test_staff_can_only_get_staff_roles(client: AsyncClient, admin: User, role: str) -> None:
    assert (await client.post(STAFF, json=NEW_STAFF | {"role": role})).status_code == 422


async def test_admin_cannot_demote_or_deactivate_themselves(
    client: AsyncClient, admin: User
) -> None:
    for change in ({"role": "SUPPORT"}, {"is_active": False}):
        response = await client.patch(f"{STAFF}/{admin.id}", json=change)
        assert response.status_code == 409


async def test_deactivating_staff_ends_their_access(
    client: AsyncClient, admin: User, session: AsyncSession
) -> None:
    other = await make_user(
        session, email="other@khidmat.example", phone="+923009990000", role=Role.SUPPORT
    )
    response = await client.patch(f"{STAFF}/{other.id}", json={"is_active": False})
    assert response.json()["is_active"] is False

    client.cookies.clear()
    login = await client.post(
        LOGIN, json={"identifier": "other@khidmat.example", "password": PASSWORD}
    )
    assert login.status_code == 401


async def test_reset_password_replaces_the_old_one(
    client: AsyncClient, admin: User, session: AsyncSession
) -> None:
    other = await make_user(
        session, email="other@khidmat.example", phone="+923009990000", role=Role.SUPPORT
    )
    reset = await client.post(f"{STAFF}/{other.id}/reset-password")
    temporary = reset.json()["temporary_password"]
    assert reset.json()["staff"]["must_change_password"] is True

    client.cookies.clear()
    old = await client.post(
        LOGIN, json={"identifier": "other@khidmat.example", "password": PASSWORD}
    )
    assert old.status_code == 401
    new = await client.post(
        LOGIN, json={"identifier": "other@khidmat.example", "password": temporary}
    )
    assert new.status_code == 200


async def test_staff_routes_cannot_touch_customers(
    client: AsyncClient, admin: User, session: AsyncSession
) -> None:
    patient = await make_user(
        session, email="p@khidmat.example", phone="+923008880000", role=Role.PATIENT
    )
    response = await client.post(f"{STAFF}/{patient.id}/reset-password")
    assert response.status_code == 404
