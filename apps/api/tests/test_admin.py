"""Admin inbox, catalog and overview."""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.audit.models import AuditLog
from khidmat_api.modules.contact.models import ContactMessage, ContactMessageStatus
from tests.test_auth import CREDENTIALS, LOGIN, make_user

BASE = "/api/v1/admin"
SERVICE = {"slug": "home-nursing", "name": "Home nursing", "name_urdu": "گھر پر نرسنگ"}


@pytest.fixture
async def admin_client(client: AsyncClient, session: AsyncSession) -> AsyncClient:
    await make_user(session)
    assert (await client.post(LOGIN, json=CREDENTIALS)).status_code == 200
    return client


async def _message(
    session: AsyncSession, name: str = "Ayesha", phone: str = "+923001234567"
) -> UUID:
    message = ContactMessage(
        name=name, phone=phone, message="Physio chahiye", locale="en", ip_hash="x" * 64
    )
    session.add(message)
    await session.flush()
    return message.id


async def test_messages_paginate_and_filter(
    admin_client: AsyncClient, session: AsyncSession
) -> None:
    for index in range(3):
        await _message(session, name=f"Patient {index}")
    handled = await _message(session, name="Handled one")
    await admin_client.patch(f"{BASE}/contact-messages/{handled}", json={"status": "HANDLED"})

    page = (await admin_client.get(f"{BASE}/contact-messages", params={"page_size": 2})).json()
    assert page["total"] == 4
    assert len(page["items"]) == 2

    new = await admin_client.get(f"{BASE}/contact-messages", params={"status": "NEW"})
    assert new.json()["total"] == 3

    found = await admin_client.get(f"{BASE}/contact-messages", params={"search": "handled"})
    assert [item["name"] for item in found.json()["items"]] == ["Handled one"]


async def test_search_treats_wildcards_as_plain_text(
    admin_client: AsyncClient, session: AsyncSession
) -> None:
    await _message(session)
    found = await admin_client.get(f"{BASE}/contact-messages", params={"search": "%"})
    assert found.json()["total"] == 0


@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 101}, {"status": "NOPE"}])
async def test_bad_list_params_are_rejected(
    admin_client: AsyncClient, params: dict[str, str | int]
) -> None:
    response = await admin_client.get(f"{BASE}/contact-messages", params=params)
    assert response.status_code == 422


async def test_status_change_sets_handled_time_and_is_audited(
    admin_client: AsyncClient, session: AsyncSession
) -> None:
    message_id = await _message(session)

    done = await admin_client.patch(
        f"{BASE}/contact-messages/{message_id}", json={"status": "HANDLED"}
    )
    assert done.json()["status"] == "HANDLED"
    assert done.json()["handled_at"] is not None

    reopened = await admin_client.patch(
        f"{BASE}/contact-messages/{message_id}", json={"status": "NEW"}
    )
    assert reopened.json()["handled_at"] is None

    saved = await session.get(ContactMessage, message_id)
    assert saved is not None
    assert saved.status is ContactMessageStatus.NEW
    actions = await session.scalars(
        select(AuditLog.action).where(AuditLog.entity_id == str(message_id))
    )
    assert list(actions) == ["contact_message.status_changed"] * 2


async def test_unknown_message_is_404(admin_client: AsyncClient) -> None:
    response = await admin_client.patch(
        f"{BASE}/contact-messages/00000000-0000-0000-0000-000000000000",
        json={"status": "HANDLED"},
    )
    assert response.status_code == 404


async def test_service_and_package_lifecycle(admin_client: AsyncClient) -> None:
    created = await admin_client.post(f"{BASE}/catalog/services", json=SERVICE)
    assert created.status_code == 201
    service_id = created.json()["id"]

    duplicate = await admin_client.post(f"{BASE}/catalog/services", json=SERVICE)
    assert duplicate.status_code == 409

    package = await admin_client.post(
        f"{BASE}/catalog/services/{service_id}/packages",
        json={"sessions_count": 10, "price_pkr": 30000},
    )
    assert package.status_code == 201
    package_id = package.json()["id"]

    second = await admin_client.post(
        f"{BASE}/catalog/services/{service_id}/packages",
        json={"sessions_count": 10, "price_pkr": 25000},
    )
    assert second.status_code == 409

    updated = await admin_client.patch(
        f"{BASE}/catalog/packages/{package_id}", json={"price_pkr": 28000}
    )
    assert updated.json()["price_pkr"] == 28000

    services = (await admin_client.get(f"{BASE}/catalog/services")).json()
    assert services[0]["packages"][0]["price_pkr"] == 28000

    hidden = await admin_client.patch(
        f"{BASE}/catalog/services/{service_id}", json={"is_active": False}
    )
    assert hidden.json()["is_active"] is False


@pytest.mark.parametrize(
    "payload",
    [
        SERVICE | {"slug": "Has Spaces"},
        SERVICE | {"name": "X"},
        SERVICE | {"unknown": True},
    ],
)
async def test_invalid_services_are_rejected(
    admin_client: AsyncClient, payload: dict[str, object]
) -> None:
    response = await admin_client.post(f"{BASE}/catalog/services", json=payload)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"sessions_count": 0, "price_pkr": 1000},
        {"sessions_count": 5, "price_pkr": 0},
        {"sessions_count": 5, "price_pkr": 1.5},
    ],
)
async def test_invalid_packages_are_rejected(
    admin_client: AsyncClient, payload: dict[str, object]
) -> None:
    created = await admin_client.post(f"{BASE}/catalog/services", json=SERVICE)
    response = await admin_client.post(
        f"{BASE}/catalog/services/{created.json()['id']}/packages", json=payload
    )
    assert response.status_code == 422


async def test_commission_is_validated_and_saved(admin_client: AsyncClient) -> None:
    assert (await admin_client.get(f"{BASE}/catalog/commission")).json() == {"commission_bps": None}
    bad = await admin_client.put(f"{BASE}/catalog/commission", json={"commission_bps": 10001})
    assert bad.status_code == 422

    await admin_client.put(f"{BASE}/catalog/commission", json={"commission_bps": 2000})
    assert (await admin_client.get(f"{BASE}/catalog/commission")).json() == {"commission_bps": 2000}


async def test_overview_counts_real_data(admin_client: AsyncClient, session: AsyncSession) -> None:
    await _message(session)
    overview = (await admin_client.get(f"{BASE}/overview")).json()
    assert overview["new_messages"] == 1
    assert overview["messages_last_7_days"] == 1
    assert overview["patients"] == 0


async def test_audit_log_lists_newest_first(
    admin_client: AsyncClient, session: AsyncSession
) -> None:
    message_id = await _message(session)
    await admin_client.patch(f"{BASE}/contact-messages/{message_id}", json={"status": "HANDLED"})

    page = (await admin_client.get(f"{BASE}/audit-logs")).json()
    assert page["total"] == 2
    assert page["items"][0]["action"] == "contact_message.status_changed"
    assert page["items"][0]["metadata"] == {"status": "HANDLED"}
