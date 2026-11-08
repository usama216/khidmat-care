"""The whole order journey, and the business rules that protect it."""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import Settings
from khidmat_api.core.storage import S3Storage
from khidmat_api.modules.bookings.models import TreatmentSession
from khidmat_api.modules.catalog.models import PlatformSetting
from khidmat_api.modules.providers.models import Provider
from khidmat_api.modules.wallet.models import WalletTransaction
from khidmat_api.seed import seed_reference_data
from tests.test_auth import CREDENTIALS, LOGIN, make_user

API = "/api/v1"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
PDF = b"%PDF-1.7" + b"0" * 64
TZ = ZoneInfo("Asia/Karachi")


def _client(app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    return AsyncClient(transport=transport, base_url="http://localhost")


@dataclass
class World:
    admin: AsyncClient
    physio: AsyncClient
    patient: AsyncClient
    provider_id: str
    service_id: str
    area_id: str
    single_id: str
    package_id: str
    patient_id: str
    physio_phone: str
    patient_phone: str


async def _upload(client: AsyncClient, purpose: str, mime: str, data: bytes) -> str:
    started = await client.post(
        f"{API}/files/uploads",
        json={"purpose": purpose, "mime_type": mime, "size_bytes": len(data)},
    )
    assert started.status_code == 201, started.text
    body = started.json()
    posted = await client.post(
        body["upload"]["url"], data=body["upload"]["fields"], files={"file": ("f", data, mime)}
    )
    assert posted.status_code == 204, posted.text
    confirmed = await client.post(f"{API}/files/{body['file_id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    return str(body["file_id"])


def _at(days: int = 3, hour: int = 10) -> datetime:
    day = datetime.now(TZ).date() + timedelta(days=days)
    return datetime(day.year, day.month, day.day, hour, tzinfo=TZ)


async def _register_physio(
    app: FastAPI, admin: AsyncClient, *, phone: str, cnic: str, service_id: str, area_id: str
) -> tuple[AsyncClient, str]:
    physio = _client(app)
    created = await physio.post(
        f"{API}/auth/register",
        json={"name": "Dr Sana", "phone": phone, "password": "physio-password", "role": "PROVIDER"},
    )
    assert created.status_code == 201, created.text
    photo = await _upload(physio, "PROVIDER_PHOTO", "image/png", PNG)
    profile = await physio.put(
        f"{API}/provider/profile",
        json={
            "gender": "FEMALE",
            "cnic": cnic,
            "qualification": "DPT",
            "experience_years": 5,
            "photo_file_id": photo,
            "service_type_ids": [service_id],
            "area_ids": [area_id],
        },
    )
    assert profile.status_code == 200, profile.text
    provider_id = profile.json()["id"]
    for document in ("CNIC_FRONT", "CNIC_BACK", "DEGREE"):
        file_id = await _upload(physio, "PROVIDER_DOCUMENT", "application/pdf", PDF)
        attached = await physio.post(
            f"{API}/provider/documents", json={"type": document, "file_id": file_id}
        )
        assert attached.status_code == 201, attached.text
    slots = [{"day_of_week": d, "start_minute": 480, "end_minute": 1200} for d in range(7)]
    assert (
        await physio.put(f"{API}/provider/availability", json={"slots": slots})
    ).status_code == 200
    submitted = await physio.post(f"{API}/provider/submit", json={"accept_agreement": True})
    assert submitted.json()["status"] == "PENDING"

    detail = (await admin.get(f"{API}/admin/providers/{provider_id}")).json()
    for check in detail["required_checks"]:
        await admin.put(f"{API}/admin/providers/{provider_id}/checks/{check}", json={"done": True})
    approved = await admin.post(f"{API}/admin/providers/{provider_id}/approve")
    assert approved.json()["status"] == "APPROVED", approved.text
    return physio, provider_id


async def _top_up(physio: AsyncClient, admin: AsyncClient, amount: int, reference: str) -> None:
    proof = await _upload(physio, "TOPUP_PROOF", "image/png", PNG)
    topup = await physio.post(
        f"{API}/provider/wallet/topups",
        json={
            "amount_pkr": amount,
            "method": "JazzCash",
            "reference": reference,
            "proof_file_id": proof,
        },
    )
    assert topup.status_code == 201, topup.text
    reviewed = await admin.post(
        f"{API}/admin/wallet/topups/{topup.json()['id']}/review", json={"approve": True}
    )
    assert reviewed.json()["status"] == "APPROVED"


@pytest.fixture
async def world(app: FastAPI, client: AsyncClient, session: AsyncSession) -> AsyncIterator[World]:
    await seed_reference_data(session)
    await make_user(session)
    assert (await client.post(LOGIN, json=CREDENTIALS)).status_code == 200
    admin = client

    await admin.patch(f"{API}/admin/settings", json={"commission_bps": 2000})
    services = (await admin.get(f"{API}/admin/catalog/services")).json()
    service_id = services[0]["id"]
    single = await admin.post(
        f"{API}/admin/catalog/services/{service_id}/packages",
        json={"sessions_count": 1, "price_pkr": 3000},
    )
    package = await admin.post(
        f"{API}/admin/catalog/services/{service_id}/packages",
        json={"sessions_count": 3, "price_pkr": 8000},
    )
    catalog = (await admin.get(f"{API}/catalog")).json()
    area_id = catalog["areas"][0]["id"]

    physio, provider_id = await _register_physio(
        app,
        admin,
        phone="03001000001",
        cnic="35202-1234567-1",
        service_id=service_id,
        area_id=area_id,
    )
    await _top_up(physio, admin, 2000, "TXN-1")

    patient = _client(app)
    await patient.post(
        f"{API}/auth/register",
        json={
            "name": "Ali",
            "phone": "03002000002",
            "password": "patient-password",
            "role": "PATIENT",
        },
    )
    person = await patient.post(
        f"{API}/patients",
        json={"name": "Ammi", "gender": "FEMALE", "birth_year": 1960, "relation": "PARENT"},
    )
    yield World(
        admin=admin,
        physio=physio,
        patient=patient,
        provider_id=provider_id,
        service_id=service_id,
        area_id=area_id,
        single_id=single.json()["id"],
        package_id=package.json()["id"],
        patient_id=person.json()["id"],
        physio_phone="+923001000001",
        patient_phone="+923002000002",
    )
    await physio.aclose()
    await patient.aclose()


async def _book(
    world: World, *, package: str | None = None, start: datetime | None = None
) -> dict[str, Any]:
    response = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": package or world.single_id,
            "provider_id": world.provider_id,
            "address_line": "House 12, Street 4",
            "area_id": world.area_id,
            "start_at": (start or _at()).isoformat(),
            "condition": "Knee replacement three weeks ago",
        },
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


async def _accept(world: World, booking_id: str) -> dict[str, Any]:
    response = await world.physio.post(
        f"{API}/provider/jobs/{booking_id}/respond", json={"accept": True}
    )
    assert response.status_code == 200, response.text
    jobs = (await world.physio.get(f"{API}/provider/jobs")).json()["items"]
    return next(job for job in jobs if job["id"] == booking_id)


async def _move_session(session: AsyncSession, session_id: str, when: datetime) -> None:
    await session.execute(
        update(TreatmentSession)
        .where(TreatmentSession.id == UUID(session_id))
        .values(scheduled_at=when)
    )
    await session.flush()
    session.expire_all()


async def _finish(world: World, session_id: str) -> None:
    for step in ("ON_THE_WAY", "ARRIVED"):
        moved = await world.physio.post(
            f"{API}/provider/sessions/{session_id}/status", json={"status": step}
        )
        assert moved.status_code == 200, moved.text
    done = await world.physio.post(
        f"{API}/provider/sessions/{session_id}/status",
        json={"status": "COMPLETED", "pain_score": 4, "notes": "Good progress"},
    )
    assert done.status_code == 200, done.text


# Verification -----------------------------------------------------------------------------------


async def test_cnic_is_encrypted_and_masked_for_the_physio(
    world: World, session: AsyncSession
) -> None:
    saved = await session.get(Provider, UUID(world.provider_id))
    assert saved is not None
    assert "3520212345671" not in saved.cnic_encrypted
    assert "3520212345671" not in saved.cnic_hash
    mine = (await world.physio.get(f"{API}/provider/profile")).json()
    assert "3520212345671" not in json.dumps(mine)
    assert mine["cnic_masked"] == "35202-*******-1"
    full = (await world.admin.get(f"{API}/admin/providers/{world.provider_id}")).json()
    assert full["cnic"] == "3520212345671"


async def test_one_cnic_one_account(app: FastAPI, world: World) -> None:
    other = _client(app)
    await other.post(
        f"{API}/auth/register",
        json={
            "name": "Copy",
            "phone": "03003000003",
            "password": "another-password",
            "role": "PROVIDER",
        },
    )
    response = await other.put(
        f"{API}/provider/profile",
        json={
            "gender": "MALE",
            "cnic": "3520212345671",
            "qualification": "DPT",
            "experience_years": 1,
            "service_type_ids": [world.service_id],
            "area_ids": [world.area_id],
        },
    )
    assert response.status_code == 409
    await other.aclose()


async def test_submit_needs_documents_and_agreement(app: FastAPI, world: World) -> None:
    other = _client(app)
    await other.post(
        f"{API}/auth/register",
        json={
            "name": "New",
            "phone": "03003000004",
            "password": "another-password",
            "role": "PROVIDER",
        },
    )
    await other.put(
        f"{API}/provider/profile",
        json={
            "gender": "MALE",
            "cnic": "3520299999991",
            "qualification": "DPT",
            "experience_years": 1,
            "service_type_ids": [world.service_id],
            "area_ids": [world.area_id],
        },
    )
    no_agreement = await other.post(f"{API}/provider/submit", json={"accept_agreement": False})
    assert no_agreement.status_code == 409
    no_docs = await other.post(f"{API}/provider/submit", json={"accept_agreement": True})
    assert no_docs.status_code == 409
    assert "Upload" in no_docs.json()["error"]["message"]
    await other.aclose()


async def test_approval_requires_every_check(app: FastAPI, world: World) -> None:
    physio = _client(app)
    await physio.post(
        f"{API}/auth/register",
        json={
            "name": "Hamza",
            "phone": "03003000005",
            "password": "another-password",
            "role": "PROVIDER",
        },
    )
    photo = await _upload(physio, "PROVIDER_PHOTO", "image/png", PNG)
    profile = await physio.put(
        f"{API}/provider/profile",
        json={
            "gender": "MALE",
            "cnic": "3520288888881",
            "qualification": "DPT",
            "experience_years": 2,
            "photo_file_id": photo,
            "service_type_ids": [world.service_id],
            "area_ids": [world.area_id],
        },
    )
    provider_id = profile.json()["id"]
    for document in ("CNIC_FRONT", "CNIC_BACK", "DEGREE"):
        file_id = await _upload(physio, "PROVIDER_DOCUMENT", "application/pdf", PDF)
        await physio.post(f"{API}/provider/documents", json={"type": document, "file_id": file_id})
    await physio.post(f"{API}/provider/submit", json={"accept_agreement": True})

    early = await world.admin.post(f"{API}/admin/providers/{provider_id}/approve")
    assert early.status_code == 409

    rejected = await world.admin.post(
        f"{API}/admin/providers/{provider_id}/reject", json={"reason": "Degree is unclear"}
    )
    assert rejected.json()["status"] == "REJECTED"
    assert (await physio.get(f"{API}/provider/profile")).json()[
        "status_reason"
    ] == "Degree is unclear"
    await physio.aclose()


async def test_only_approved_physios_are_listed_and_never_with_a_phone(world: World) -> None:
    listed = await world.patient.get(f"{API}/physios", params={"service_id": world.service_id})
    assert [row["id"] for row in listed.json()] == [world.provider_id]
    assert listed.json()[0]["availability"]
    assert "phone" not in listed.text
    assert world.physio_phone not in listed.text

    suspended = await world.admin.post(
        f"{API}/admin/providers/{world.provider_id}/suspend", json={"reason": "Investigating"}
    )
    assert suspended.status_code == 200
    assert (await world.patient.get(f"{API}/physios")).json() == []
    await world.admin.post(f"{API}/admin/providers/{world.provider_id}/reactivate")


# Files ------------------------------------------------------------------------------------------


async def test_upload_checks_the_real_file_content(world: World) -> None:
    started = await world.physio.post(
        f"{API}/files/uploads",
        json={"purpose": "PROVIDER_DOCUMENT", "mime_type": "application/pdf", "size_bytes": 10},
    )
    body = started.json()
    await world.physio.post(
        body["upload"]["url"],
        data=body["upload"]["fields"],
        files={"file": ("x.pdf", b"not a real pdf at all", "application/pdf")},
    )
    confirmed = await world.physio.post(f"{API}/files/{body['file_id']}/confirm")
    assert confirmed.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"purpose": "PROVIDER_PHOTO", "mime_type": "application/pdf", "size_bytes": 10},
        {"purpose": "PROVIDER_DOCUMENT", "mime_type": "text/html", "size_bytes": 10},
    ],
)
async def test_disallowed_file_types_are_refused(world: World, payload: dict[str, object]) -> None:
    assert (await world.physio.post(f"{API}/files/uploads", json=payload)).status_code == 409


async def test_oversized_declared_files_are_refused(world: World) -> None:
    response = await world.physio.post(
        f"{API}/files/uploads",
        json={"purpose": "TOPUP_PROOF", "mime_type": "image/png", "size_bytes": 9 * 1024 * 1024},
    )
    assert response.status_code == 422


async def test_private_documents_are_limited_to_owner_and_verifiers(
    app: FastAPI, world: World, session: AsyncSession
) -> None:
    file_id = await _upload(world.physio, "PROVIDER_DOCUMENT", "application/pdf", PDF)
    assert (await world.physio.get(f"{API}/files/{file_id}/url")).status_code == 200
    assert (await world.patient.get(f"{API}/files/{file_id}/url")).status_code == 403
    assert (await world.admin.get(f"{API}/files/{file_id}/url")).status_code == 200

    link = (await world.physio.get(f"{API}/files/{file_id}/url")).json()["url"]
    anonymous = _client(app)
    assert (await anonymous.get(link)).content == PDF
    assert (await anonymous.get(f"{API}/files/local/not-a-token")).status_code == 404
    await anonymous.aclose()


async def test_s3_upload_ticket_limits_size_and_type(monkeypatch: pytest.MonkeyPatch) -> None:
    # The host's own credentials must never be picked up instead of ours.
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "HOSTROLEKEY")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "host-secret")
    storage = S3Storage("khidmat-test-bucket", "ap-southeast-2", "OURKEY", "our-secret")
    ticket = storage.upload_ticket("provider_document/x.pdf", "application/pdf", 1000)
    assert ticket.url == "https://khidmat-test-bucket.s3.ap-southeast-2.amazonaws.com/"
    assert ticket.fields["key"] == "provider_document/x.pdf"
    assert ticket.fields["Content-Type"] == "application/pdf"
    link = storage.download_url("provider_document/x.pdf")
    assert "X-Amz-Expires=300" in link
    assert "OURKEY" in link
    assert "HOSTROLEKEY" not in link


def test_uploads_use_s3_only_when_a_bucket_is_set(settings: Settings) -> None:
    from khidmat_api.core.storage import LocalStorage, UnconfiguredStorage, create_storage
    from tests.conftest import build_settings

    url = settings.database_url.get_secret_value()
    assert isinstance(create_storage(settings), LocalStorage)
    deployed = build_settings(
        url,
        environment="production",
        ip_hash_secret="s",
        jwt_secret="x" * 48,
        encryption_key="k" * 48,
    )
    assert isinstance(create_storage(deployed), UnconfiguredStorage)
    with_bucket = deployed.model_copy(
        update={
            "s3_bucket": "bucket",
            "s3_access_key_id": "key",
            "s3_secret_access_key": SecretStr("secret"),
        }
    )
    assert isinstance(create_storage(with_bucket), S3Storage)
    with pytest.raises(ValueError, match="S3_ACCESS_KEY_ID"):
        build_settings(
            url,
            environment="production",
            ip_hash_secret="s",
            jwt_secret="x" * 48,
            encryption_key="k" * 48,
            s3_bucket="bucket",
        )


# Contact and cancellation rules -----------------------------------------------------------------


async def test_numbers_stay_hidden_until_two_hours_before(
    world: World, session: AsyncSession
) -> None:
    booking = await _book(world)
    offered = (await world.physio.get(f"{API}/provider/jobs")).json()["items"][0]
    assert offered["address_line"] is None, "Address is hidden before acceptance"
    assert world.patient_phone not in json.dumps(offered)

    job = await _accept(world, booking["id"])
    assert job["address_line"] == "House 12, Street 4"
    session_row = job["sessions"][0]
    assert session_row["contact_phone"] is None

    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["sessions"][0]["contact_phone"] is None
    assert world.physio_phone not in json.dumps(mine)

    await _move_session(session, session_row["id"], datetime.now(UTC) + timedelta(minutes=119))
    open_job = (await world.physio.get(f"{API}/provider/jobs")).json()["items"][0]
    assert open_job["sessions"][0]["contact_phone"] == world.patient_phone
    open_mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert open_mine["sessions"][0]["contact_phone"] == world.physio_phone

    await _move_session(session, session_row["id"], datetime.now(UTC) + timedelta(minutes=121))
    closed = (await world.physio.get(f"{API}/provider/jobs")).json()["items"][0]
    assert closed["sessions"][0]["contact_phone"] is None


async def test_numbers_hide_again_after_the_session(world: World, session: AsyncSession) -> None:
    booking = await _book(world, package=None)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]
    await _move_session(session, session_id, datetime.now(UTC) + timedelta(minutes=30))
    await _finish(world, session_id)
    finished = (await world.physio.get(f"{API}/provider/jobs")).json()["items"][0]
    assert finished["sessions"][0]["contact_phone"] is None


@pytest.mark.parametrize("who", ["patient", "physio"])
async def test_nobody_can_cancel_inside_two_hours(
    world: World, session: AsyncSession, who: str
) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]
    await _move_session(session, session_id, datetime.now(UTC) + timedelta(minutes=90))

    url = (
        f"{API}/bookings/sessions/{session_id}/cancel"
        if who == "patient"
        else f"{API}/provider/sessions/{session_id}/cancel"
    )
    client = world.patient if who == "patient" else world.physio
    locked = await client.post(url, json={"reason": "Changed my mind"})
    assert locked.status_code == 409
    assert locked.json()["error"]["code"] == "cancel_locked"


async def test_whole_order_cannot_be_cancelled_inside_two_hours(
    world: World, session: AsyncSession
) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    await _move_session(
        session, job["sessions"][0]["id"], datetime.now(UTC) + timedelta(minutes=90)
    )
    locked = await world.patient.post(
        f"{API}/bookings/{booking['id']}/cancel", json={"reason": "Changed my mind"}
    )
    assert locked.json()["error"]["code"] == "cancel_locked"


async def test_cancelling_earlier_works_and_charges_nothing(world: World) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    cancelled = await world.patient.post(
        f"{API}/bookings/{booking['id']}/cancel", json={"reason": "Travelling this week"}
    )
    assert cancelled.json()["status"] == "CANCELLED"
    assert cancelled.json()["sessions"][0]["status"] == "CANCELLED"
    assert job["sessions"][0]["can_cancel"] is True
    wallet = (await world.physio.get(f"{API}/provider/wallet")).json()
    assert wallet["balance_pkr"] == 2000


async def test_staff_can_act_inside_the_lock_without_commission(
    world: World, session: AsyncSession
) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]
    await _move_session(session, session_id, datetime.now(UTC) + timedelta(minutes=30))
    closed = await world.admin.post(
        f"{API}/admin/bookings/sessions/{session_id}/close",
        json={"status": "NO_SHOW", "reason": "Patient was not home"},
    )
    assert closed.json()["status"] == "NO_SHOW"
    assert (await world.physio.get(f"{API}/provider/wallet")).json()["balance_pkr"] == 2000


# Orders -----------------------------------------------------------------------------------------


async def test_rejected_order_can_go_to_another_physio(app: FastAPI, world: World) -> None:
    booking = await _book(world)
    no_reason = await world.physio.post(
        f"{API}/provider/jobs/{booking['id']}/respond", json={"accept": False}
    )
    assert no_reason.status_code == 409
    rejected = await world.physio.post(
        f"{API}/provider/jobs/{booking['id']}/respond",
        json={"accept": False, "reason": "On leave that day"},
    )
    assert rejected.json()["status"] == "PENDING_ASSIGNMENT"
    assert (await world.physio.get(f"{API}/provider/jobs")).json()["total"] == 0

    second, second_id = await _register_physio(
        app,
        world.admin,
        phone="03001000009",
        cnic="3520277777771",
        service_id=world.service_id,
        area_id=world.area_id,
    )
    await _top_up(second, world.admin, 1000, "TXN-2")
    chosen = await world.patient.post(
        f"{API}/bookings/{booking['id']}/choose-provider",
        json={"provider_id": second_id, "start_at": _at().isoformat()},
    )
    assert chosen.json()["status"] == "AWAITING_ACCEPTANCE"
    assert chosen.json()["provider"]["id"] == second_id
    await second.aclose()


@pytest.mark.parametrize(
    "change", ["wrong_area", "wrong_service", "past", "off_hours", "other_patient"]
)
async def test_invalid_orders_are_refused(
    app: FastAPI, world: World, session: AsyncSession, change: str
) -> None:
    payload: dict[str, object] = {
        "patient_id": world.patient_id,
        "service_type_id": world.service_id,
        "package_id": world.single_id,
        "provider_id": world.provider_id,
        "address_line": "House 12, Street 4",
        "area_id": world.area_id,
        "start_at": _at().isoformat(),
        "condition": "Knee pain",
    }
    catalog = (await world.patient.get(f"{API}/catalog")).json()
    client = world.patient
    if change == "wrong_area":
        payload["area_id"] = catalog["areas"][1]["id"]
    elif change == "wrong_service":
        payload["service_type_id"] = catalog["services"][1]["id"]
    elif change == "past":
        payload["start_at"] = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    elif change == "off_hours":
        payload["start_at"] = _at(hour=23).isoformat()
    else:
        client = _client(app)
        await client.post(
            f"{API}/auth/register",
            json={
                "name": "Other",
                "phone": "03004000004",
                "password": "another-password",
                "role": "PATIENT",
            },
        )
    response = await client.post(f"{API}/bookings", json=payload)
    assert response.status_code in {404, 409}, response.text
    if client is not world.patient:
        await client.aclose()


async def test_two_orders_cannot_share_a_time(world: World) -> None:
    first = await _book(world)
    await _accept(world, first["id"])
    second = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.single_id,
            "provider_id": world.provider_id,
            "address_line": "House 12, Street 4",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Knee pain",
        },
    )
    assert second.status_code == 409


async def test_slots_exclude_taken_times(world: World) -> None:
    day = _at().date().isoformat()
    url = f"{API}/physios/{world.provider_id}/slots"
    before = (await world.patient.get(url, params={"day": day})).json()
    assert len(before) == 12
    booking = await _book(world)
    await _accept(world, booking["id"])
    after = (await world.patient.get(url, params={"day": day})).json()
    assert len(after) == 11


async def test_patients_cannot_see_each_others_orders(app: FastAPI, world: World) -> None:
    booking = await _book(world)
    other = _client(app)
    await other.post(
        f"{API}/auth/register",
        json={
            "name": "Other",
            "phone": "03004000005",
            "password": "another-password",
            "role": "PATIENT",
        },
    )
    assert (await other.get(f"{API}/bookings")).json()["total"] == 0
    cancel = await other.post(
        f"{API}/bookings/{booking['id']}/cancel", json={"reason": "Not mine at all"}
    )
    assert cancel.status_code == 404
    await other.aclose()


async def test_order_needs_commission_to_be_set(world: World, session: AsyncSession) -> None:
    setting = await session.get(PlatformSetting, "commission.default_bps")
    assert setting is not None
    await session.delete(setting)
    await session.flush()
    response = await world.patient.post(
        f"{API}/bookings",
        json={
            "patient_id": world.patient_id,
            "service_type_id": world.service_id,
            "package_id": world.single_id,
            "provider_id": world.provider_id,
            "address_line": "House 12, Street 4",
            "area_id": world.area_id,
            "start_at": _at().isoformat(),
            "condition": "Knee pain",
        },
    )
    assert response.status_code == 409


# Balance and commission --------------------------------------------------------------------------


async def test_commission_is_cut_once_when_a_session_completes(
    world: World, session: AsyncSession
) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]

    premature = await world.physio.post(
        f"{API}/provider/sessions/{session_id}/status",
        json={"status": "COMPLETED", "pain_score": 3},
    )
    assert premature.status_code == 409

    await _finish(world, session_id)
    wallet = (await world.physio.get(f"{API}/provider/wallet")).json()
    assert wallet["balance_pkr"] == 2000 - 600

    again = await world.physio.post(
        f"{API}/provider/sessions/{session_id}/status",
        json={"status": "COMPLETED", "pain_score": 3},
    )
    assert again.status_code == 409
    assert (await world.physio.get(f"{API}/provider/wallet")).json()["balance_pkr"] == 1400

    history = (await world.physio.get(f"{API}/provider/wallet/transactions")).json()["items"]
    assert history[0]["type"] == "COMMISSION"
    assert history[0]["amount_pkr"] == -600
    assert history[0]["balance_after_pkr"] == 1400

    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["status"] == "COMPLETED"
    assert mine["sessions"][0]["pain_score"] == 4


async def test_package_commission_adds_up_exactly(world: World, session: AsyncSession) -> None:
    booking = await _book(world, package=world.package_id)
    job = await _accept(world, booking["id"])
    first = job["sessions"][0]["id"]
    await _finish(world, first)

    for days in (5, 7):
        added = await world.physio.post(
            f"{API}/provider/jobs/{booking['id']}/sessions",
            json={"start_at": _at(days=days).isoformat()},
        )
        assert added.status_code == 201, added.text
        await _finish(world, added.json()["session_id"])

    extra = await world.physio.post(
        f"{API}/provider/jobs/{booking['id']}/sessions",
        json={"start_at": _at(days=9).isoformat()},
    )
    assert extra.status_code == 409

    total = await session.scalar(
        select(func.sum(WalletTransaction.amount_pkr)).where(
            WalletTransaction.provider_id == UUID(world.provider_id),
            WalletTransaction.type == "COMMISSION",
        )
    )
    assert total == -1600, "20% of Rs 8,000 across three sessions"
    mine = (await world.patient.get(f"{API}/bookings")).json()["items"][0]
    assert mine["status"] == "COMPLETED"


async def test_commission_rate_is_fixed_when_booking(world: World) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    await world.admin.patch(f"{API}/admin/settings", json={"commission_bps": 5000})
    await _finish(world, job["sessions"][0]["id"])
    assert (await world.physio.get(f"{API}/provider/wallet")).json()["balance_pkr"] == 1400


async def test_low_balance_blocks_new_orders_but_not_accepted_ones(world: World) -> None:
    first = await _book(world)
    job = await _accept(world, first["id"])
    offered = await _book(world, start=_at(hour=12))

    await world.admin.post(
        f"{API}/admin/wallet/providers/{world.provider_id}/adjust",
        json={"amount_pkr": -1500, "note": "Test correction"},
    )

    wallet = (await world.physio.get(f"{API}/provider/wallet")).json()
    assert wallet["balance_pkr"] == 500
    assert wallet["can_accept_orders"] is False
    blocked = await world.physio.post(
        f"{API}/provider/jobs/{offered['id']}/respond", json={"accept": True}
    )
    assert blocked.status_code == 409
    assert "700" in blocked.json()["error"]["message"]
    assert (await world.patient.get(f"{API}/physios")).json() == []

    await _finish(world, job["sessions"][0]["id"])
    assert (await world.physio.get(f"{API}/provider/wallet")).json()["balance_pkr"] == -100


async def test_minimum_balance_can_be_changed(world: World) -> None:
    await world.admin.patch(f"{API}/admin/settings", json={"minimum_balance_pkr": 5000})
    assert (await world.patient.get(f"{API}/physios")).json() == []
    await world.admin.patch(f"{API}/admin/settings", json={"minimum_balance_pkr": 700})
    assert len((await world.patient.get(f"{API}/physios")).json()) == 1


async def test_topup_reference_only_works_once(world: World) -> None:
    proof = await _upload(world.physio, "TOPUP_PROOF", "image/png", PNG)
    duplicate = await world.physio.post(
        f"{API}/provider/wallet/topups",
        json={
            "amount_pkr": 500,
            "method": "JazzCash",
            "reference": "TXN-1",
            "proof_file_id": proof,
        },
    )
    assert duplicate.status_code == 409


async def test_topup_is_reviewed_only_once(world: World) -> None:
    proof = await _upload(world.physio, "TOPUP_PROOF", "image/png", PNG)
    topup = await world.physio.post(
        f"{API}/provider/wallet/topups",
        json={"amount_pkr": 500, "method": "Bank", "reference": "TXN-9", "proof_file_id": proof},
    )
    url = f"{API}/admin/wallet/topups/{topup.json()['id']}/review"
    no_reason = await world.admin.post(url, json={"approve": False})
    assert no_reason.status_code == 409
    rejected = await world.admin.post(
        url, json={"approve": False, "reason": "Payment not received"}
    )
    assert rejected.json()["status"] == "REJECTED"
    assert (await world.admin.post(url, json={"approve": True})).status_code == 409
    assert (await world.physio.get(f"{API}/provider/wallet")).json()["balance_pkr"] == 2000


# Feedback ---------------------------------------------------------------------------------------


async def test_rating_updates_the_physio_and_only_happens_once(world: World) -> None:
    booking = await _book(world)
    job = await _accept(world, booking["id"])
    session_id = job["sessions"][0]["id"]

    early = await world.patient.post(
        f"{API}/bookings/sessions/{session_id}/review", json={"rating": 5}
    )
    assert early.status_code == 409

    await _finish(world, session_id)
    review = await world.patient.post(
        f"{API}/bookings/sessions/{session_id}/review", json={"rating": 2, "comment": "Came late"}
    )
    assert review.status_code == 201
    again = await world.patient.post(
        f"{API}/bookings/sessions/{session_id}/review", json={"rating": 5}
    )
    assert again.status_code == 409

    listed = (await world.patient.get(f"{API}/physios")).json()[0]
    assert listed["rating_avg"] == 2
    assert listed["rating_count"] == 1
    low = (await world.admin.get(f"{API}/admin/low-ratings")).json()
    assert low[0]["comment"] == "Came late"


async def test_complaint_flow(world: World) -> None:
    booking = await _book(world)
    created = await world.patient.post(
        f"{API}/bookings/{booking['id']}/complaints",
        json={"text": "The physio asked for extra cash"},
    )
    assert created.status_code == 201
    page = (await world.admin.get(f"{API}/admin/complaints")).json()
    complaint = page["items"][0]
    assert complaint["status"] == "OPEN"

    url = f"{API}/admin/complaints/{complaint['id']}"
    no_note = await world.admin.patch(url, json={"status": "RESOLVED"})
    assert no_note.status_code == 409
    resolved = await world.admin.patch(
        url, json={"status": "RESOLVED", "resolution": "Refunded and warned the physio"}
    )
    assert resolved.json()["resolved_at"] is not None
    overview = (await world.admin.get(f"{API}/admin/overview")).json()
    assert overview["open_complaints"] == 0


async def test_staff_can_see_phones_and_reassign(app: FastAPI, world: World) -> None:
    booking = await _book(world)
    page = (await world.admin.get(f"{API}/admin/bookings")).json()
    row = page["items"][0]
    assert row["booker_phone"] == world.patient_phone
    assert row["provider_phone"] == world.physio_phone

    second, second_id = await _register_physio(
        app,
        world.admin,
        phone="03001000010",
        cnic="3520266666661",
        service_id=world.service_id,
        area_id=world.area_id,
    )
    await _top_up(second, world.admin, 1000, "TXN-3")
    moved = await world.admin.post(
        f"{API}/admin/bookings/{booking['id']}/assign",
        json={"provider_id": second_id, "start_at": _at().isoformat()},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["provider"]["id"] == second_id
    assert (await world.physio.get(f"{API}/provider/jobs")).json()["total"] == 0
    await second.aclose()
