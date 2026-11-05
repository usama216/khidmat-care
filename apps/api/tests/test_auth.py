"""Login, sessions, roles and CSRF protection."""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import Environment, Settings
from khidmat_api.create_admin import upsert_admin, validate_admin_input
from khidmat_api.main import create_app
from khidmat_api.modules.audit.models import AuditLog
from khidmat_api.modules.identity.dependencies import ACCESS_COOKIE, REFRESH_COOKIE
from khidmat_api.modules.identity.models import RefreshToken, Role, User
from khidmat_api.modules.identity.security import hash_password
from khidmat_api.modules.identity.service import MAX_FAILED_LOGINS
from tests.conftest import ALLOWED_ORIGIN, build_settings

EMAIL = "admin@khidmat.example"
PASSWORD = "correct horse battery"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
ME = "/api/v1/auth/me"
LOGOUT = "/api/v1/auth/logout"
CREDENTIALS = {"email": EMAIL, "password": PASSWORD}


async def make_user(
    session: AsyncSession,
    *,
    email: str = EMAIL,
    phone: str = "+923001110000",
    role: Role = Role.ADMIN,
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        phone=phone,
        role=role,
        is_active=is_active,
        password_hash=hash_password(PASSWORD),
    )
    session.add(user)
    await session.flush()
    return user


async def test_login_sets_httponly_cookies_and_hides_tokens(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    response = await client.post(LOGIN, json=CREDENTIALS)

    assert response.status_code == 200
    assert response.json()["email"] == EMAIL
    assert "token" not in response.text
    cookies = response.headers.get_list("set-cookie")
    access = next(c for c in cookies if c.startswith(ACCESS_COOKIE))
    refresh = next(c for c in cookies if c.startswith(REFRESH_COOKIE))
    for cookie in (access, refresh):
        assert "HttpOnly" in cookie
        assert "SameSite=lax" in cookie
    assert "Path=/api/v1/auth" in refresh


def test_cookies_are_secure_when_deployed(database_url: str) -> None:
    settings = build_settings(
        database_url,
        environment=Environment.PRODUCTION,
        ip_hash_secret="test-secret",
        jwt_secret="x" * 48,
    )
    assert settings.secure_cookies is True


async def test_login_is_case_insensitive_for_email(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    response = await client.post(LOGIN, json={"email": EMAIL.upper(), "password": PASSWORD})
    assert response.status_code == 200


@pytest.mark.parametrize(
    "credentials",
    [
        {"email": EMAIL, "password": "wrong password"},
        {"email": "nobody@khidmat.example", "password": PASSWORD},
    ],
)
async def test_wrong_credentials_get_the_same_error(
    client: AsyncClient, session: AsyncSession, credentials: dict[str, str]
) -> None:
    await make_user(session)
    response = await client.post(LOGIN, json=credentials)
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "The email or password is incorrect."


async def test_inactive_user_cannot_log_in(client: AsyncClient, session: AsyncSession) -> None:
    await make_user(session, is_active=False)
    assert (await client.post(LOGIN, json=CREDENTIALS)).status_code == 401


async def test_user_without_a_password_cannot_log_in(
    client: AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    user.password_hash = None
    await session.flush()
    assert (await client.post(LOGIN, json=CREDENTIALS)).status_code == 401


async def test_account_locks_after_repeated_failures(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    wrong = {"email": EMAIL, "password": "wrong password"}
    for _ in range(MAX_FAILED_LOGINS):
        assert (await client.post(LOGIN, json=wrong)).status_code == 401

    locked = await client.post(LOGIN, json=CREDENTIALS)
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "rate_limited"


async def test_lock_expires(client: AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
    await session.flush()
    assert (await client.post(LOGIN, json=CREDENTIALS)).status_code == 200


async def test_me_requires_a_session(client: AsyncClient, session: AsyncSession) -> None:
    assert (await client.get(ME)).status_code == 401
    await make_user(session)
    await client.post(LOGIN, json=CREDENTIALS)
    response = await client.get(ME)
    assert response.status_code == 200
    assert "password" not in response.text


async def test_suspending_an_account_ends_access_immediately(
    client: AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    await client.post(LOGIN, json=CREDENTIALS)
    user.is_active = False
    await session.flush()
    assert (await client.get(ME)).status_code == 401


@pytest.mark.parametrize(
    "token_factory",
    ["expired", "wrong_secret", "wrong_type", "none_algorithm"],
)
async def test_bad_access_tokens_are_rejected(
    client: AsyncClient, session: AsyncSession, settings: Settings, token_factory: str
) -> None:
    user = await make_user(session)
    now = datetime.now(UTC)
    secret = settings.jwt_secret.get_secret_value()
    claims = {"sub": str(user.id), "type": "access", "exp": now + timedelta(minutes=5)}
    if token_factory == "expired":
        token = jwt.encode(claims | {"exp": now - timedelta(minutes=1)}, secret, algorithm="HS256")
    elif token_factory == "wrong_secret":
        token = jwt.encode(claims, "y" * 48, algorithm="HS256")
    elif token_factory == "wrong_type":
        token = jwt.encode(claims | {"type": "refresh"}, secret, algorithm="HS256")
    else:
        token = jwt.encode(claims, key="", algorithm="none")
    client.cookies.set(ACCESS_COOKIE, token)
    assert (await client.get(ME)).status_code == 401


async def _session_cookies(client: AsyncClient) -> str:
    refresh = client.cookies.get(REFRESH_COOKIE, path="/api/v1/auth")
    assert refresh is not None
    return refresh


async def test_refresh_rotates_the_token(client: AsyncClient, session: AsyncSession) -> None:
    await make_user(session)
    await client.post(LOGIN, json=CREDENTIALS)
    first = await _session_cookies(client)

    response = await client.post(REFRESH)

    assert response.status_code == 200
    assert await _session_cookies(client) != first


async def test_reusing_an_old_refresh_token_ends_the_whole_session(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    await client.post(LOGIN, json=CREDENTIALS)
    stolen = await _session_cookies(client)
    await client.post(REFRESH)
    latest = await _session_cookies(client)

    # Move the rotation outside the grace period, as if the thief came back later.
    used = await session.scalar(select(RefreshToken).where(RefreshToken.revoked_at.is_not(None)))
    assert used is not None
    used.revoked_at = datetime.now(UTC) - timedelta(minutes=5)
    await session.flush()

    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, stolen, path="/api/v1/auth")
    assert (await client.post(REFRESH)).status_code == 401

    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, latest, path="/api/v1/auth")
    assert (await client.post(REFRESH)).status_code == 401


async def test_concurrent_refresh_within_grace_keeps_the_session(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    await client.post(LOGIN, json=CREDENTIALS)
    first = await _session_cookies(client)
    await client.post(REFRESH)
    latest = await _session_cookies(client)

    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, first, path="/api/v1/auth")
    assert (await client.post(REFRESH)).status_code == 401

    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, latest, path="/api/v1/auth")
    assert (await client.post(REFRESH)).status_code == 200


async def test_logout_revokes_the_session(client: AsyncClient, session: AsyncSession) -> None:
    await make_user(session)
    await client.post(LOGIN, json=CREDENTIALS)
    refresh = await _session_cookies(client)

    assert (await client.post(LOGOUT)).status_code == 204

    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, refresh, path="/api/v1/auth")
    assert (await client.post(REFRESH)).status_code == 401


async def test_cross_site_writes_are_rejected(client: AsyncClient, session: AsyncSession) -> None:
    await make_user(session)
    foreign = await client.post(LOGIN, json=CREDENTIALS, headers={"Origin": "https://evil.example"})
    assert foreign.status_code == 403

    trusted = await client.post(LOGIN, json=CREDENTIALS, headers={"Origin": ALLOWED_ORIGIN})
    assert trusted.status_code == 200


async def test_login_and_failures_are_audited_without_the_password(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session)
    await client.post(LOGIN, json={"email": EMAIL, "password": "wrong password"})
    await client.post(LOGIN, json=CREDENTIALS)
    rows = list(await session.scalars(select(AuditLog).order_by(AuditLog.id)))
    assert [row.action for row in rows] == ["auth.login_failed", "auth.login"]
    assert all(row.metadata_ is None for row in rows)


def _admin_routes(app: FastAPI) -> Sequence[tuple[str, str]]:
    routes: list[tuple[str, str]] = []
    for route in app.openapi()["paths"]:
        if route.startswith("/api/v1/admin"):
            routes.extend((method.upper(), route) for method in app.openapi()["paths"][route])
    return routes


async def test_every_admin_route_is_protected(
    app: FastAPI, client: AsyncClient, session: AsyncSession
) -> None:
    """Fails automatically if a future admin route forgets its role check."""
    routes = _admin_routes(app)
    assert len(routes) >= 10

    uuid = "00000000-0000-0000-0000-000000000000"
    for method, path in routes:
        url = path.replace("{message_id}", uuid).replace("{service_id}", uuid)
        url = url.replace("{package_id}", uuid)
        response = await client.request(method, url, json={})
        assert response.status_code == 401, f"{method} {path} allowed anonymous access"

    await make_user(session, email="patient@khidmat.example", role=Role.PATIENT)
    login = await client.post(
        LOGIN, json={"email": "patient@khidmat.example", "password": PASSWORD}
    )
    assert login.status_code == 200
    for method, path in routes:
        url = path.replace("{message_id}", uuid).replace("{service_id}", uuid)
        url = url.replace("{package_id}", uuid)
        response = await client.request(method, url, json={})
        assert response.status_code == 403, f"{method} {path} allowed a patient"


def test_all_api_routes_have_response_summaries(database_url: str) -> None:
    app = create_app(build_settings(database_url))
    api_routes = [r for r in app.routes if isinstance(r, APIRoute)]
    assert all(route.summary for route in api_routes if route.path.startswith("/api"))


async def test_create_admin_creates_a_usable_account(
    client: AsyncClient, session: AsyncSession
) -> None:
    await upsert_admin(
        session, email="New@Khidmat.example", phone="+923009998888", name="Usama", password=PASSWORD
    )
    response = await client.post(LOGIN, json={"email": "new@khidmat.example", "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["role"] == "ADMIN"
    count = await session.scalar(select(func.count()).select_from(User))
    assert count == 1


@pytest.mark.parametrize(
    ("email", "phone", "password", "message"),
    [
        ("not-an-email", "+923001234567", PASSWORD, "email"),
        (EMAIL, "03001234567", PASSWORD, "phone"),
        (EMAIL, "+923001234567", "short", "password"),
    ],
)
def test_create_admin_validates_input(email: str, phone: str, password: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        validate_admin_input(email, phone, password)
