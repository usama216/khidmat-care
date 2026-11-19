"""Fees, calendars, holds, time off, clinic visits, matching and reports."""

import itertools
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.bookings.models import Booking
from khidmat_api.modules.bookings.schedule import hold_deadline
from tests.test_marketplace import (  # noqa: F401
    API,
    TZ,
    World,
    _accept,
    _at,
    _book,
    _finish,
    world,
)


def _day(days: int = 3) -> str:
    return (datetime.now(TZ).date() + timedelta(days=days)).isoformat()


async def _schedule(world: World, days: int = 3) -> list[dict[str, Any]]:
    response = await world.patient.get(
        f"{API}/physios/{world.provider_id}/schedule", params={"start": _day(days), "days": 1}
    )
    assert response.status_code == 200, response.text
    return list(response.json()[0]["slots"])


def _slot(slots: list[dict[str, Any]], at: datetime) -> dict[str, Any] | None:
    return next((s for s in slots if datetime.fromisoformat(s["start_at"]) == at), None)


async def _expire(session: AsyncSession, booking_id: str) -> None:
    await session.execute(
        update(Booking)
        .where(Booking.id == UUID(booking_id))
        .values(hold_expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await session.commit()


# Fees -------------------------------------------------------------------------------------------


async def test_price_comes_from_the_physio_fee_and_stays_fixed(world: World) -> None:
    booking = await _book(world, package=world.package_id)
    assert booking["price_total_pkr"] == 9000, "Rs 3,000 x 3 sessions"
    assert booking["duration_minutes"] == 60

    raised = await world.physio.patch(f"{API}/provider/practice", json={"fee_pkr": 4000})
    assert raised.status_code == 200, raised.text
    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["price_total_pkr"] == 9000, "Orders keep the fee they were booked with"


async def test_fee_must_be_inside_the_admin_range(world: World) -> None:
    await world.admin.patch(
        f"{API}/admin/settings", json={"fee_min_pkr": 1500, "fee_max_pkr": 5000}
    )
    for fee in (1000, 6000):
        refused = await world.physio.patch(f"{API}/provider/practice", json={"fee_pkr": fee})
        assert refused.status_code == 409
    profile = (await world.physio.get(f"{API}/provider/profile")).json()
    assert (profile["fee_min_pkr"], profile["fee_max_pkr"], profile["fee_pkr"]) == (
        1500,
        5000,
        3000,
    )


async def test_physios_without_a_fee_cannot_be_found_or_booked(
    world: World, session: AsyncSession
) -> None:
    from khidmat_api.modules.providers.models import Provider

    await session.execute(
        update(Provider).where(Provider.id == UUID(world.provider_id)).values(fee_pkr=None)
    )
    await session.commit()
    listed = (await world.patient.get(f"{API}/physios")).json()
    assert all(physio["id"] != world.provider_id for physio in listed)
    profile = await world.patient.get(f"{API}/physios/{world.provider_id}")
    assert profile.status_code == 404


# Calendar and holds -----------------------------------------------------------------------------


async def test_slot_length_follows_the_physio(world: World) -> None:
    await world.physio.patch(f"{API}/provider/practice", json={"slot_minutes": 45})
    slots = await _schedule(world)
    starts = [datetime.fromisoformat(slot["start_at"]).astimezone(TZ) for slot in slots]
    assert starts[0].hour == 8
    assert all(b - a == timedelta(minutes=45) for a, b in itertools.pairwise(starts))
    assert (starts[-1] + timedelta(minutes=45)).hour <= 20


async def test_a_pending_order_holds_its_time(world: World) -> None:
    booking = await _book(world)
    assert booking["status"] == "AWAITING_ACCEPTANCE"
    assert booking["hold_expires_at"] is not None

    slot = _slot(await _schedule(world), _at())
    assert slot is not None
    assert slot["available"] is False, "Held times show as taken"
    second = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.single_id,
            "provider_id": world.provider_id,
            "address_line": "House 9",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Back pain",
        },
    )
    assert second.status_code == 409


async def test_an_expired_hold_frees_the_time_and_returns_the_order(
    world: World, session: AsyncSession
) -> None:
    booking = await _book(world)
    await _expire(session, booking["id"])

    slot = _slot(await _schedule(world), _at())
    assert slot is not None
    assert slot["available"] is True
    late = await world.physio.post(
        f"{API}/provider/jobs/{booking['id']}/respond", json={"accept": True}
    )
    assert late.status_code == 409
    assert late.json()["error"]["code"] == "offer_expired"

    detail = (await world.admin.get(f"{API}/admin/bookings/{booking['id']}")).json()
    assert detail["booking"]["status"] == "PENDING_ASSIGNMENT"
    assert detail["booking"]["provider"] is None
    assert "EXPIRED" in [entry["type"] for entry in detail["timeline"]]


async def test_listing_orders_tidies_up_expired_holds(world: World, session: AsyncSession) -> None:
    booking = await _book(world)
    await _expire(session, booking["id"])
    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["status"] == "PENDING_ASSIGNMENT"
    assert mine["hold_expires_at"] is None


async def test_admin_can_extend_or_release_a_hold(world: World) -> None:
    booking = await _book(world)
    url = f"{API}/admin/bookings/{booking['id']}/hold"
    extended = await world.admin.post(url, json={"action": "extend", "hours": 12})
    assert extended.status_code == 200, extended.text
    deadline = datetime.fromisoformat(extended.json()["hold_expires_at"])
    assert deadline > datetime.now(UTC) + timedelta(hours=11)

    released = await world.admin.post(url, json={"action": "release"})
    assert released.json()["status"] == "PENDING_ASSIGNMENT"
    assert (await world.admin.post(url, json={"action": "release"})).status_code == 409


def test_hold_deadline_never_runs_past_the_visit() -> None:
    now = datetime(2026, 11, 18, 9, tzinfo=UTC)
    assert hold_deadline(now, now + timedelta(days=2), 3) == now + timedelta(hours=3)
    assert hold_deadline(now, now + timedelta(hours=2), 3) == now + timedelta(hours=1)
    soon = now + timedelta(minutes=45)
    assert hold_deadline(now, soon, 3) == soon - timedelta(minutes=10)


async def test_a_time_inside_a_session_is_never_offered(world: World) -> None:
    booking = await _book(world)
    await _accept(world, booking["id"])
    # Shorter slots later on don't shorten the 60-minute visit already booked.
    await world.physio.patch(f"{API}/provider/practice", json={"slot_minutes": 30})
    slots = await _schedule(world)
    taken = [_slot(slots, _at() + timedelta(minutes=m)) for m in (0, 30, 60)]
    assert [slot["available"] if slot else None for slot in taken] == [False, False, True]


# Time off ---------------------------------------------------------------------------------------


async def test_time_off_removes_times_and_can_be_undone(world: World) -> None:
    start = _at(hour=12)
    blocked = await world.physio.post(
        f"{API}/provider/time-off",
        json={
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=3)).isoformat(),
            "reason": "Family event",
        },
    )
    assert blocked.status_code == 201, blocked.text
    starts = {datetime.fromisoformat(slot["start_at"]) for slot in await _schedule(world)}
    assert start not in starts
    assert start + timedelta(hours=2) not in starts
    assert start + timedelta(hours=3) in starts

    calendar = await world.physio.get(
        f"{API}/provider/calendar", params={"start": _day(), "days": 1}
    )
    assert [row["reason"] for row in calendar.json()["time_off"]] == ["Family event"]

    removed = await world.physio.delete(f"{API}/provider/time-off/{blocked.json()['id']}")
    assert removed.status_code == 204
    starts = {datetime.fromisoformat(slot["start_at"]) for slot in await _schedule(world)}
    assert start in starts


async def test_time_off_cannot_hide_a_booked_visit(world: World) -> None:
    booking = await _book(world)
    body = {
        "start_at": _at().isoformat(),
        "end_at": (_at() + timedelta(hours=2)).isoformat(),
    }
    waiting = await world.physio.post(f"{API}/provider/time-off", json=body)
    assert waiting.status_code == 409, "Reply to the offer first"
    await _accept(world, booking["id"])
    booked = await world.physio.post(f"{API}/provider/time-off", json=body)
    assert booked.status_code == 409
    assert f"KC-{booking['number']}" in booked.json()["error"]["message"]


async def test_calendar_shows_offers_and_sessions(world: World) -> None:
    first = await _book(world)
    second = await _book(world, start=_at(hour=15))
    await _accept(world, first["id"])
    calendar = (
        await world.physio.get(f"{API}/provider/calendar", params={"start": _day(), "days": 1})
    ).json()
    kinds = {(event["kind"], event["booking_number"]) for event in calendar["events"]}
    assert kinds == {("SESSION", first["number"]), ("OFFER", second["number"])}
    staff_view = await world.admin.get(
        f"{API}/admin/providers/{world.provider_id}/calendar", params={"start": _day()}
    )
    assert len(staff_view.json()["events"]) == 2


# Clinic visits ----------------------------------------------------------------------------------


async def test_clinic_visits(world: World) -> None:
    missing = await world.physio.patch(f"{API}/provider/practice", json={"visit_clinic": True})
    assert missing.status_code == 409, "A clinic needs an address"
    clinic = await world.physio.patch(
        f"{API}/provider/practice",
        json={
            "visit_clinic": True,
            "visit_home": False,
            "clinic_address": "Suite 4, Main Boulevard",
            "clinic_area_id": world.area_id,
        },
    )
    assert clinic.status_code == 200, clinic.text
    assert (await world.patient.get(f"{API}/catalog")).json()["clinic_visits"] is True

    home_only = (await world.patient.get(f"{API}/physios", params={"visit_type": "HOME"})).json()
    assert all(physio["id"] != world.provider_id for physio in home_only)
    home = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.single_id,
            "provider_id": world.provider_id,
            "address_line": "House 9",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Back pain",
        },
    )
    assert home.status_code == 409, "This physio no longer does home visits"

    booked = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.single_id,
            "provider_id": world.provider_id,
            "visit_type": "CLINIC",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Back pain",
        },
    )
    assert booked.status_code == 201, booked.text
    assert booked.json()["address_line"] is None
    assert booked.json()["clinic_address"] is None, "Shown once the visit is confirmed"
    await _accept(world, booked.json()["id"])
    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["clinic_address"] == "Suite 4, Main Boulevard"


# Finding a physio -------------------------------------------------------------------------------


async def test_request_without_a_physio_waits_for_the_team(world: World) -> None:
    request = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.package_id,
            "address_line": "House 9",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Stroke last month",
        },
    )
    assert request.status_code == 201, request.text
    assert request.json()["status"] == "PENDING_ASSIGNMENT"
    assert request.json()["provider"] is None

    assigned = await world.admin.post(
        f"{API}/admin/bookings/{request.json()['id']}/assign",
        json={"provider_id": world.provider_id, "start_at": _at().isoformat()},
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["status"] == "AWAITING_ACCEPTANCE"
    assert assigned.json()["price_total_pkr"] == 9000


async def test_matching_finds_physios_free_in_the_window(world: World) -> None:
    params = {
        "service_id": world.service_id,
        "area_id": world.area_id,
        "day": _day(),
        "from_minute": 600,
        "to_minute": 720,
    }
    matches = (await world.patient.get(f"{API}/physios/match", params=params)).json()
    assert [match["physio"]["id"] for match in matches] == [world.provider_id]
    hours = [datetime.fromisoformat(at).astimezone(TZ).hour for at in matches[0]["slots"]]
    assert hours == [10, 11]

    late = {**params, "from_minute": 1260, "to_minute": 1380}
    assert (await world.patient.get(f"{API}/physios/match", params=late)).json() == []


async def test_public_profile_shows_reviews_without_names(world: World) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]
    await _finish(world, session_id)
    await world.patient.post(
        f"{API}/bookings/sessions/{session_id}/review", json={"rating": 5, "comment": "Very kind"}
    )
    profile = (await world.patient.get(f"{API}/physios/{world.provider_id}")).json()
    assert profile["fee_pkr"] == 3000
    assert profile["reviews"] == [
        {"rating": 5, "comment": "Very kind", "created_at": profile["reviews"][0]["created_at"]}
    ]
    assert "phone" not in str(profile)


# Admin ------------------------------------------------------------------------------------------


async def test_reports_count_orders_money_and_demand(world: World) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    await _finish(world, job["sessions"][0]["id"])
    await _book(world, start=_at(days=4))

    report = await world.admin.get(f"{API}/admin/reports", params={"months": 3})
    assert report.status_code == 200, report.text
    body = report.json()
    assert len(body["by_month"]) == 3
    assert body["totals"]["orders"] == 2
    assert body["totals"]["sessions_completed"] == 1
    assert body["totals"]["collected_pkr"] == 3000
    assert body["totals"]["commission_pkr"] == 600
    assert body["by_area"][0]["orders"] == 2
    assert body["top_physios"][0]["provider_id"] == world.provider_id


async def test_messages_keep_the_reply(world: World, session: AsyncSession) -> None:
    from khidmat_api.modules.contact.models import ContactMessage

    message = ContactMessage(
        name="Bilal", phone="+923001112222", message="Need a physio", locale="en", ip_hash="x"
    )
    session.add(message)
    await session.commit()
    answered = await world.admin.patch(
        f"{API}/admin/contact-messages/{message.id}",
        json={"status": "HANDLED", "reply_note": "Called, booked for Saturday"},
    )
    assert answered.status_code == 200, answered.text
    assert answered.json()["reply_note"] == "Called, booked for Saturday"
    assert answered.json()["handled_at"] is not None
    await session.refresh(message)
    assert message.handled_by_id is not None
