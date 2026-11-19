"""Open requests: WhatsApp alerts to matching physiotherapists, and first pick wins."""

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.notifications.models import Notification, NotificationStatus
from khidmat_api.modules.notifications.whatsapp import TemplateMessage, WhatsAppError
from tests.test_marketplace import (  # noqa: F401
    API,
    World,
    _at,
    _book,
    _register_physio,
    _top_up,
    world,
)


class FakeWhatsApp:
    enabled = True

    def __init__(self) -> None:
        self.sent: list[TemplateMessage] = []
        self.unreachable: set[str] = set()

    async def send(self, message: TemplateMessage) -> str:
        if message.to in self.unreachable:
            raise WhatsAppError("400 131026: Message undeliverable")
        self.sent.append(message)
        return f"wamid.{len(self.sent)}"

    def to(self) -> set[str]:
        return {message.to for message in self.sent}


@pytest.fixture
def whatsapp(app: FastAPI) -> FakeWhatsApp:
    fake = FakeWhatsApp()
    app.state.whatsapp = fake
    return fake


SECOND_PHONE = "+923001000009"


@pytest.fixture
async def second(app: FastAPI, world: World) -> AsyncClient:
    physio, _ = await _register_physio(
        app,
        world.admin,
        phone="03001000009",
        cnic="35202-7654321-9",
        service_id=world.service_id,
        area_id=world.area_id,
    )
    await _top_up(physio, world.admin, 2000, "TXN-SECOND")
    return physio


async def _request(world: World, **extra: Any) -> dict[str, Any]:
    response = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.single_id,
            "address_line": "House 9, Street 2",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Back pain for three weeks",
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


async def test_a_request_alerts_every_matching_physio(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    order = await _request(world)
    assert order["status"] == "PENDING_ASSIGNMENT"
    assert whatsapp.to() == {world.physio_phone, SECOND_PHONE}

    message = whatsapp.sent[0]
    assert message.template == "physio_open_request"
    assert message.language == "en"
    name, area, treatment, when = message.parameters
    assert name == "Dr Sana"
    assert treatment
    assert area
    assert when.endswith("10:00 am")
    assert "Ali" not in str(message.parameters), "The patient is never named in WhatsApp"

    detail = (await world.admin.get(f"{API}/admin/bookings/{order['id']}")).json()
    assert (detail["alerts_sent"], detail["alerts_failed"]) == (2, 0)


async def test_first_pick_wins_and_others_see_it_go(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    order = await _request(world)
    listed = (await world.physio.get(f"{API}/provider/open-requests")).json()
    assert [item["id"] for item in listed] == [order["id"]]
    assert listed[0]["can_pick"] is True
    assert listed[0]["price_total_pkr"] == 3000
    for private in ("address_line", "patient_name", "phone"):
        assert private not in listed[0]

    picked = await world.physio.post(f"{API}/provider/open-requests/{order['id']}/pick")
    assert picked.status_code == 200, picked.text
    assert picked.json()["status"] == "ACTIVE"

    late = await second.post(f"{API}/provider/open-requests/{order['id']}/pick")
    assert late.status_code == 409
    assert late.json()["error"]["code"] == "request_taken"
    assert (await second.get(f"{API}/provider/open-requests")).json() == []

    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["status"] == "ACTIVE"
    assert mine["provider"]["id"] == world.provider_id
    assert mine["price_total_pkr"] == 3000
    assert len(mine["sessions"]) == 1


async def test_a_declined_offer_alerts_others_but_not_the_one_who_declined(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    booking = await _book(world)
    assert whatsapp.sent == [], "An order for a chosen physio alerts nobody else"
    declined = await world.physio.post(
        f"{API}/provider/jobs/{booking['id']}/respond",
        json={"accept": False, "reason": "Away that day"},
    )
    assert declined.status_code == 200, declined.text
    assert whatsapp.to() == {SECOND_PHONE}
    assert (await world.physio.get(f"{API}/provider/open-requests")).json() == []


async def test_nobody_is_alerted_twice_for_the_same_order(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    order = await _request(world)
    assert len(whatsapp.sent) == 2
    assigned = await world.admin.post(
        f"{API}/admin/bookings/{order['id']}/assign",
        json={"provider_id": world.provider_id, "start_at": _at().isoformat()},
    )
    assert assigned.status_code == 200, assigned.text
    released = await world.admin.post(
        f"{API}/admin/bookings/{order['id']}/hold", json={"action": "release"}
    )
    assert released.json()["status"] == "PENDING_ASSIGNMENT"
    assert len(whatsapp.sent) == 2


async def test_busy_and_opted_out_physios_are_not_alerted(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    await _book(world)  # Holds 10 am for the first physio.
    off = await second.patch(f"{API}/provider/practice", json={"whatsapp_alerts": False})
    assert off.json()["whatsapp_alerts"] is False
    order = await _request(world)
    assert whatsapp.sent == []

    listed = (await world.physio.get(f"{API}/provider/open-requests")).json()
    assert listed[0]["id"] == order["id"]
    assert listed[0]["can_pick"] is False
    assert listed[0]["reason"] == "You have another visit or time off then."
    refused = await world.physio.post(f"{API}/provider/open-requests/{order['id']}/pick")
    assert refused.status_code == 409


async def test_a_failed_message_is_recorded_and_the_order_still_stands(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp, session: AsyncSession
) -> None:
    whatsapp.unreachable.add(SECOND_PHONE)
    order = await _request(world)
    assert whatsapp.to() == {world.physio_phone}
    rows = list(await session.scalars(select(Notification)))
    failed = [row for row in rows if row.status == NotificationStatus.FAILED]
    assert len(failed) == 1
    assert failed[0].error is not None
    assert "131026" in failed[0].error
    detail = (await world.admin.get(f"{API}/admin/bookings/{order['id']}")).json()
    assert (detail["alerts_sent"], detail["alerts_failed"]) == (1, 1)


async def test_without_whatsapp_configured_requests_still_work(
    world: World, session: AsyncSession
) -> None:
    order = await _request(world)
    assert order["status"] == "PENDING_ASSIGNMENT"
    assert list(await session.scalars(select(Notification))) == []


async def test_alert_limit_is_an_admin_setting(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    saved = await world.admin.patch(f"{API}/admin/settings", json={"alert_physios_max": 1})
    assert saved.json()["alert_physios_max"] == 1
    await _request(world)
    assert len(whatsapp.sent) == 1


async def test_cloud_api_request_shape_and_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    import json

    import httpx

    from khidmat_api.modules.notifications import whatsapp as module

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if len(seen) == 1:
            return httpx.Response(200, json={"messages": [{"id": "wamid.ABC"}]})
        return httpx.Response(
            400, json={"error": {"code": 132001, "message": "Template name does not exist"}}
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        module.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    sender = module.CloudApiSender("1234567890", "secret-token", "v23.0")
    message = TemplateMessage(
        to="+923001112233",
        template="physio_open_request",
        language="en",
        parameters=["Dr Sana", "DHA", "Stroke  rehab\n", "Sat 22 Nov, 6:00 pm"],
    )
    assert await sender.send(message) == "wamid.ABC"

    request = seen[0]
    assert str(request.url) == "https://graph.facebook.com/v23.0/1234567890/messages"
    assert request.headers["Authorization"] == "Bearer secret-token"
    body = json.loads(request.content)
    assert body["to"] == "923001112233"
    assert body["template"]["name"] == "physio_open_request"
    assert body["template"]["language"] == {"code": "en"}
    texts = [p["text"] for p in body["template"]["components"][0]["parameters"]]
    assert texts == ["Dr Sana", "DHA", "Stroke rehab", "Sat 22 Nov, 6:00 pm"]

    with pytest.raises(WhatsAppError) as failure:
        await sender.send(message)
    assert "132001" in str(failure.value)
    assert "secret-token" not in str(failure.value)


async def test_dashboard_counts_requests_the_physio_can_pick(
    world: World, whatsapp: FakeWhatsApp
) -> None:
    await _request(world)
    dashboard = (await world.physio.get(f"{API}/provider/dashboard")).json()
    assert dashboard["open_requests"] == 1


async def test_staff_see_who_was_alerted_and_why_others_were_not(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    await _book(world)  # The first physio is now busy at 10 am.
    order = await _request(world)
    report = (await world.admin.get(f"{API}/admin/bookings/{order['id']}/alerts")).json()
    assert report["whatsapp_configured"] is True
    assert report["order_open"] is True
    by_phone = {check["phone"]: check for check in report["checks"]}
    assert by_phone[SECOND_PHONE]["alert_status"] == "SENT"
    busy = by_phone[world.physio_phone]
    assert busy["eligible"] is False
    assert busy["alert_status"] is None
    assert busy["reasons"][0].startswith("Not free then")


async def test_staff_can_resend_after_fixing_a_physio(
    world: World, second: AsyncClient, whatsapp: FakeWhatsApp
) -> None:
    await second.patch(f"{API}/provider/practice", json={"whatsapp_alerts": False})
    order = await _request(world)
    assert whatsapp.to() == {world.physio_phone}
    report = (await world.admin.get(f"{API}/admin/bookings/{order['id']}/alerts")).json()
    off = next(check for check in report["checks"] if check["phone"] == SECOND_PHONE)
    assert off["reasons"] == ["Turned WhatsApp alerts off."]

    await second.patch(f"{API}/provider/practice", json={"whatsapp_alerts": True})
    resent = await world.admin.post(f"{API}/admin/bookings/{order['id']}/alerts/send")
    assert resent.json() == {"sent": 1}, "Only the newly eligible physio is messaged"
    assert whatsapp.to() == {world.physio_phone, SECOND_PHONE}


async def test_report_says_when_whatsapp_is_not_set_up(world: World) -> None:
    order = await _request(world)
    report = (await world.admin.get(f"{API}/admin/bookings/{order['id']}/alerts")).json()
    assert report["whatsapp_configured"] is False
    assert report["checks"][0]["eligible"] is True
    refused = await world.admin.post(f"{API}/admin/bookings/{order['id']}/alerts/send")
    assert refused.status_code == 409
    assert "WHATSAPP_ACCESS_TOKEN" in refused.json()["error"]["message"]


async def test_requests_outside_weekly_hours_still_alert_and_can_be_picked(
    world: World, whatsapp: FakeWhatsApp
) -> None:
    # The physio works 8 am to 8 pm; a 6 am request is outside those hours.
    order = await _request(world, start_at=_at(hour=6).isoformat())
    assert whatsapp.to() == {world.physio_phone}
    picked = await world.physio.post(f"{API}/provider/open-requests/{order['id']}/pick")
    assert picked.status_code == 200, picked.text
