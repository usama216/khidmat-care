import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import Environment, Settings
from khidmat_api.core.phone import normalize_phone
from khidmat_api.modules.contact.models import ContactMessage
from tests.conftest import build_settings

URL = "/api/v1/contact-messages"
VALID = {"name": "Ayesha Khan", "phone": "0300-1234567", "message": "Ammi ko physio chahiye."}


async def _count(session: AsyncSession) -> int:
    count = await session.scalar(select(func.count()).select_from(ContactMessage))
    assert count is not None
    return count


async def test_valid_message_is_saved(client: AsyncClient, session: AsyncSession) -> None:
    payload = VALID | {"message": "  السلام علیکم، فزیو چاہیے۔  ", "locale": "ur"}
    response = await client.post(URL, json=payload)

    assert response.status_code == 201
    assert response.json() == {"status": "received"}
    saved = await session.scalar(select(ContactMessage))
    assert saved is not None
    assert saved.phone == "+923001234567"
    assert saved.message == "السلام علیکم، فزیو چاہیے۔"
    assert saved.locale == "ur"


async def test_raw_ip_is_not_stored(client: AsyncClient, session: AsyncSession) -> None:
    await client.post(URL, json=VALID)
    saved = await session.scalar(select(ContactMessage))
    assert saved is not None
    assert "127.0.0.1" not in saved.ip_hash
    assert len(saved.ip_hash) == 64


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "A"),
        ("phone", "12345"),
        ("phone", "03001234"),
        ("message", "hi"),
        ("message", "x" * 2001),
        ("locale", "fr"),
    ],
)
async def test_invalid_input_is_rejected(
    client: AsyncClient, session: AsyncSession, field: str, value: str
) -> None:
    response = await client.post(URL, json=VALID | {field: value})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == f"body.{field}"
    assert await _count(session) == 0


async def test_unknown_fields_are_rejected(client: AsyncClient) -> None:
    response = await client.post(URL, json=VALID | {"role": "ADMIN"})
    assert response.status_code == 422


async def test_honeypot_looks_successful_but_saves_nothing(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.post(URL, json=VALID | {"website": "https://spam.example"})
    assert response.status_code == 201
    assert await _count(session) == 0


async def test_rate_limit_blocks_after_the_hourly_limit(
    client: AsyncClient, session: AsyncSession, settings: Settings
) -> None:
    for _ in range(settings.contact_rate_limit_per_hour):
        assert (await client.post(URL, json=VALID)).status_code == 201

    response = await client.post(URL, json=VALID)

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert await _count(session) == settings.contact_rate_limit_per_hour


async def test_forwarded_header_is_ignored_unless_configured(
    client: AsyncClient, settings: Settings
) -> None:
    for number in range(settings.contact_rate_limit_per_hour):
        forged = {"X-Forwarded-For": f"203.0.113.{number}"}
        assert (await client.post(URL, json=VALID, headers=forged)).status_code == 201

    forged = {"X-Forwarded-For": "203.0.113.200"}
    assert (await client.post(URL, json=VALID, headers=forged)).status_code == 429


async def test_configured_proxy_header_identifies_each_client(
    app: FastAPI, client: AsyncClient, database_url: str, session: AsyncSession
) -> None:
    app.state.settings = build_settings(database_url, client_ip_header="x-forwarded-for")
    limit = app.state.settings.contact_rate_limit_per_hour
    for _ in range(limit):
        headers = {"X-Forwarded-For": "203.0.113.1, 10.0.0.1"}
        assert (await client.post(URL, json=VALID, headers=headers)).status_code == 201

    blocked = await client.post(URL, json=VALID, headers={"X-Forwarded-For": "203.0.113.1"})
    other = await client.post(URL, json=VALID, headers={"X-Forwarded-For": "203.0.113.2"})

    assert blocked.status_code == 429
    assert other.status_code == 201


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("03001234567", "+923001234567"),
        ("0300 123 4567", "+923001234567"),
        ("+92 300 1234567", "+923001234567"),
        ("00971501234567", "+971501234567"),
        ("+447911123456", "+447911123456"),
    ],
)
def test_phone_formats_are_normalized(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


def test_deployed_settings_require_a_real_ip_hash_secret(database_url: str) -> None:
    with pytest.raises(ValueError, match="IP_HASH_SECRET"):
        build_settings(database_url, environment=Environment.PRODUCTION)
