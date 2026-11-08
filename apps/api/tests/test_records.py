"""Detail records for staff, and the physiotherapist's dashboard."""

from tests.test_marketplace import API, World, _accept, _at, _book, _finish, world  # noqa: F401


async def _completed_order(world: World) -> dict[str, object]:
    """A single-session order, done, rated 2 and complained about."""
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]
    await _finish(world, session_id)
    rated = await world.patient.post(
        f"{API}/bookings/sessions/{session_id}/review", json={"rating": 2, "comment": "Came late"}
    )
    assert rated.status_code == 201, rated.text
    complained = await world.patient.post(
        f"{API}/bookings/{booking['id']}/complaints", json={"text": "Arrived 40 minutes late"}
    )
    assert complained.status_code == 201
    return booking


async def test_order_record_shows_money_history_and_feedback(world: World) -> None:
    booking = await _completed_order(world)
    response = await world.admin.get(f"{API}/admin/bookings/{booking['id']}")
    assert response.status_code == 200, response.text
    detail = response.json()

    assert detail["booking"]["number"] == booking["number"]
    assert detail["booking"]["booker_phone"] == world.patient_phone
    assert detail["commission_total_pkr"] == 600
    assert detail["commission_charged_pkr"] == 600
    session = detail["sessions"][0]
    assert session["price_pkr"] == 3000
    assert session["commission_pkr"] == 600
    assert session["commission_charged"] is True
    assert session["rating"] == 2
    assert session["review_comment"] == "Came late"
    assert session["provider_name"] == "Dr Sana"
    assert detail["assignments"][0]["status"] == "ACCEPTED"
    assert detail["complaints"][0]["text"] == "Arrived 40 minutes late"

    kinds = [entry["type"] for entry in detail["timeline"]]
    assert kinds[0] == "ORDER_PLACED"
    for kind in ("OFFERED", "ACCEPTED", "RATED", "COMPLAINT_RAISED"):
        assert kind in kinds
    # The first session is created by the acceptance, so it never appears before it.
    scheduled = next(e for e in detail["timeline"] if e["status"] == "SCHEDULED")
    accepted = next(e for e in detail["timeline"] if e["type"] == "ACCEPTED")
    assert scheduled["at"] >= accepted["at"]
    statuses = [e["status"] for e in detail["timeline"] if e["type"] == "SESSION"]
    assert statuses == ["SCHEDULED", "ON_THE_WAY", "ARRIVED", "COMPLETED"]


async def test_unknown_order_is_not_found(world: World) -> None:
    missing = await world.admin.get(f"{API}/admin/bookings/00000000-0000-0000-0000-000000000000")
    assert missing.status_code == 404


async def test_orders_can_be_found_by_number_physio_and_account(world: World) -> None:
    booking = await _book(world)
    url = f"{API}/admin/bookings"
    for search in (f"KC-{booking['number']}", f"kc{booking['number']}", str(booking["number"])):
        found = (await world.admin.get(url, params={"search": search})).json()
        assert [item["id"] for item in found["items"]] == [booking["id"]], search
    assert (await world.admin.get(url, params={"search": "hello"})).json()["total"] == 0
    by_physio = (await world.admin.get(url, params={"provider_id": world.provider_id})).json()
    assert by_physio["total"] == 1

    accounts = await world.admin.get(f"{API}/admin/patients", params={"search": "0300 2000"})
    account = accounts.json()["items"][0]
    assert account["phone"] == world.patient_phone
    assert account["orders_count"] == 1
    assert account["people_count"] == 1
    by_account = (await world.admin.get(url, params={"booked_by": account["id"]})).json()
    assert by_account["total"] == 1


async def test_patient_account_record(world: World) -> None:
    await _completed_order(world)
    accounts = (await world.admin.get(f"{API}/admin/patients")).json()["items"]
    detail = (await world.admin.get(f"{API}/admin/patients/{accounts[0]['id']}")).json()
    assert detail["completed_orders"] == 1
    assert detail["spent_pkr"] == 3000
    assert detail["people"][0]["name"] == "Ammi"
    staff = await world.admin.get(f"{API}/admin/patients/{world.provider_id}")
    assert staff.status_code == 404


async def test_physio_record_has_stats_ratings_and_ledger(world: World) -> None:
    booking = await _completed_order(world)
    detail = (await world.admin.get(f"{API}/admin/providers/{world.provider_id}")).json()
    assert detail["stats"]["sessions_completed"] == 1
    assert detail["stats"]["orders_total"] == 1
    assert detail["rating_count"] == 1
    assert detail["approved_at"] is not None

    reviews = (
        await world.admin.get(f"{API}/admin/reviews", params={"provider_id": world.provider_id})
    ).json()
    assert reviews["items"][0]["booking_number"] == booking["number"]
    assert reviews["items"][0]["reviewer_name"] == "Ali"

    ledger = (
        await world.admin.get(f"{API}/admin/wallet/providers/{world.provider_id}/transactions")
    ).json()["items"]
    assert ledger[0]["type"] == "COMMISSION"
    assert ledger[0]["booking_number"] == booking["number"]
    assert ledger[0]["session_sequence"] == 1
    mine = (await world.physio.get(f"{API}/provider/wallet/transactions")).json()["items"]
    assert mine[0]["booking_number"] == booking["number"]
    assert "created_by_name" not in mine[0]

    topups = (
        await world.admin.get(
            f"{API}/admin/wallet/topups", params={"provider_id": world.provider_id}
        )
    ).json()
    assert topups["total"] == 1
    assert topups["items"][0]["provider_name"] == "Dr Sana"
    assert topups["items"][0]["reviewed_by_name"] is not None


async def test_complaints_name_the_order_and_both_sides(world: World) -> None:
    booking = await _completed_order(world)
    complaint = (await world.admin.get(f"{API}/admin/complaints")).json()["items"][0]
    assert complaint["booking_number"] == booking["number"]
    assert complaint["raised_by_phone"] == world.patient_phone
    assert complaint["provider_name"] == "Dr Sana"
    mine = await world.admin.get(
        f"{API}/admin/complaints", params={"provider_id": world.provider_id}
    )
    assert mine.json()["total"] == 1
    low = (await world.admin.get(f"{API}/admin/low-ratings")).json()
    assert low[0]["provider_name"] == "Dr Sana"


async def test_record_history_is_filtered_by_entity(world: World) -> None:
    url = f"{API}/admin/audit-logs"
    entries = (
        await world.admin.get(
            url, params={"entity_type": "provider", "entity_id": world.provider_id}
        )
    ).json()["items"]
    assert entries
    assert all(entry["entity_id"] == world.provider_id for entry in entries)
    assert any(entry["action"] == "provider.approve" for entry in entries)
    assert all(entry["actor_name"] for entry in entries if entry["actor_id"])


async def test_physio_dashboard_counts_work_and_money(world: World) -> None:
    empty = (await world.physio.get(f"{API}/provider/dashboard")).json()
    assert empty["sessions_completed"] == 0
    assert empty["upcoming"] == []
    assert empty["can_accept_orders"] is True

    await _completed_order(world)
    offer = await _book(world, start=_at(days=2))
    upcoming = await _book(world, start=_at(days=4))
    await _accept(world, upcoming["id"])

    dashboard = (await world.physio.get(f"{API}/provider/dashboard")).json()
    assert dashboard["sessions_completed"] == 1
    assert dashboard["completed_this_month"] == 1
    assert dashboard["collected_this_month_pkr"] == 3000
    assert dashboard["commission_this_month_pkr"] == 600
    assert dashboard["balance_pkr"] == 1400
    assert dashboard["new_offers"] == 1
    assert dashboard["active_orders"] == 1
    assert dashboard["sessions_upcoming"] == 1
    assert [item["booking_id"] for item in dashboard["upcoming"]] == [upcoming["id"]]
    assert dashboard["upcoming"][0]["patient_name"] == "Ammi"
    assert offer["id"] not in [item["booking_id"] for item in dashboard["upcoming"]]


async def test_only_physios_have_a_dashboard(world: World) -> None:
    assert (await world.patient.get(f"{API}/provider/dashboard")).status_code == 403
