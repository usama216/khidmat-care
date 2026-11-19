"""Staff change a physiotherapist's or patient's phone after confirming who's asking."""

from fastapi import FastAPI

from tests.test_marketplace import API, World, _client, world  # noqa: F401

LOGIN = f"{API}/auth/login"


async def test_admin_changes_a_physio_phone_and_old_logins_stop(app: FastAPI, world: World) -> None:
    changed = await world.admin.post(
        f"{API}/admin/providers/{world.provider_id}/phone",
        json={"phone": "0321 5550001", "reason": "Called from the old number"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json() == {"phone": "+923215550001"}

    refreshed = await world.physio.post(f"{API}/auth/refresh")
    assert refreshed.status_code == 401, "Every existing login is signed out"

    fresh = _client(app)
    old = await fresh.post(LOGIN, json={"identifier": "03001000001", "password": "physio-password"})
    assert old.status_code == 401
    new = await fresh.post(LOGIN, json={"identifier": "03215550001", "password": "physio-password"})
    assert new.status_code == 200, new.text
    await fresh.aclose()

    history = (
        await world.admin.get(
            f"{API}/admin/audit-logs",
            params={"entity_type": "provider", "entity_id": world.provider_id},
        )
    ).json()["items"]
    entry = next(item for item in history if item["action"] == "user.phone_changed")
    assert entry["metadata"] == {
        "from": world.physio_phone,
        "to": "+923215550001",
        "reason": "Called from the old number",
    }


async def test_phone_changes_are_checked(world: World) -> None:
    url = f"{API}/admin/providers/{world.provider_id}/phone"
    cases = [
        ({"phone": world.patient_phone, "reason": "Asked on call"}, 409),  # Someone else's.
        ({"phone": world.physio_phone, "reason": "Asked on call"}, 409),  # Unchanged.
        ({"phone": "12345678", "reason": "Asked on call"}, 409),  # Not a phone number.
        ({"phone": "03215550001", "reason": ""}, 422),  # A reason is required.
    ]
    for body, status in cases:
        response = await world.admin.post(url, json=body)
        assert response.status_code == status, (body, response.text)


async def test_admin_changes_a_patient_phone(world: World) -> None:
    accounts = (await world.admin.get(f"{API}/admin/patients", params={"search": "Ali"})).json()
    user_id = accounts["items"][0]["id"]
    changed = await world.admin.post(
        f"{API}/admin/patients/{user_id}/phone",
        json={"phone": "+923335550002", "reason": "Lost the old SIM"},
    )
    assert changed.status_code == 200, changed.text
    detail = (await world.admin.get(f"{API}/admin/patients/{user_id}")).json()
    assert detail["phone"] == "+923335550002"


async def test_the_patient_route_cannot_change_a_physio(world: World) -> None:
    physio = (await world.admin.get(f"{API}/admin/providers/{world.provider_id}")).json()
    response = await world.admin.post(
        f"{API}/admin/patients/{physio['user_id']}/phone",
        json={"phone": "03215550003", "reason": "Asked on call"},
    )
    assert response.status_code == 404
