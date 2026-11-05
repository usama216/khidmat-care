"""Rules the database itself must enforce, whatever bugs the application code has."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import DateTime, PrimaryKeyConstraint, UniqueConstraint, inspect
from sqlalchemy.engine import Connection
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from khidmat_api.core.enums import Gender
from khidmat_api.model_registry import Base
from khidmat_api.modules.bookings.models import (
    AssignmentStatus,
    Booking,
    BookingAssignment,
    TreatmentSession,
)
from khidmat_api.modules.catalog.models import Area, ServicePackage, ServiceType
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.patients.models import Address, Patient
from khidmat_api.modules.payments.models import Payment
from khidmat_api.modules.providers.models import Provider

NOW = datetime(2026, 11, 5, tzinfo=UTC)


@dataclass
class World:
    user: User
    area: Area
    provider: Provider
    booking: Booking


async def _make_user(session: AsyncSession) -> User:
    user = User(phone=f"+92300{uuid4().int % 10_000_000:07d}")
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def world(session: AsyncSession) -> World:
    user = await _make_user(session)
    provider_user = await _make_user(session)
    area = Area(name=f"Area {uuid4()}", name_urdu="علاقہ")
    service = ServiceType(slug=str(uuid4()), name="Stroke rehab", name_urdu="فالج")
    session.add_all([area, service])
    await session.flush()

    package = ServicePackage(service_type_id=service.id, sessions_count=10, price_pkr=30000)
    patient = Patient(owner_id=user.id, name="Patient", gender=Gender.FEMALE)
    provider = Provider(
        user_id=provider_user.id,
        gender=Gender.FEMALE,
        cnic_encrypted="ciphertext",
        cnic_hash=str(uuid4()),
        qualification="DPT",
        experience_years=3,
    )
    session.add_all([package, patient, provider])
    await session.flush()

    booking = Booking(
        patient_id=patient.id,
        booked_by_id=user.id,
        service_type_id=service.id,
        package_id=package.id,
        sessions_count=10,
        price_total_pkr=30000,
        commission_bps=2000,
        address_line="House 1",
        area_id=area.id,
        lat=31.5,
        lng=74.3,
        preferred_start_at=NOW,
        condition="Stroke",
    )
    session.add(booking)
    await session.flush()
    return World(user=user, area=area, provider=provider, booking=booking)


def _session_row(world: World, **overrides: object) -> TreatmentSession:
    values: dict[str, object] = {
        "booking_id": world.booking.id,
        "provider_id": world.provider.id,
        "sequence": 1,
        "scheduled_at": NOW,
    }
    return TreatmentSession(**(values | overrides))


def _payment(world: World, **overrides: object) -> Payment:
    values: dict[str, object] = {
        "booking_id": world.booking.id,
        "amount_pkr": 3000,
        "commission_pkr": 600,
        "provider_payout_pkr": 2400,
        "recorded_by_id": world.user.id,
        "collected_at": NOW,
    }
    return Payment(**(values | overrides))


async def _expect_rejected(session: AsyncSession, row: object, constraint: str) -> None:
    async with session.begin_nested():
        session.add(row)
        with pytest.raises(IntegrityError, match=constraint):
            await session.flush()
        await session.rollback()


async def test_booking_numbers_start_at_1001_and_increase(
    session: AsyncSession, world: World
) -> None:
    assert world.booking.number >= 1001


@pytest.mark.parametrize("score", [-1, 11])
async def test_pain_score_must_be_0_to_10(session: AsyncSession, world: World, score: int) -> None:
    await _expect_rejected(
        session, _session_row(world, pain_score=score), "ck_treatment_sessions_pain_score_range"
    )


async def test_session_numbers_are_unique_per_booking(session: AsyncSession, world: World) -> None:
    session.add(_session_row(world))
    await session.flush()
    await _expect_rejected(session, _session_row(world), "uq_treatment_sessions_booking_sequence")


async def test_commission_and_payout_must_add_up_to_the_amount(
    session: AsyncSession, world: World
) -> None:
    await _expect_rejected(
        session, _payment(world, commission_pkr=700), "ck_payments_split_adds_up"
    )


async def test_a_booking_can_have_only_one_open_assignment(
    session: AsyncSession, world: World
) -> None:
    def assignment(status: AssignmentStatus) -> BookingAssignment:
        return BookingAssignment(
            booking_id=world.booking.id,
            provider_id=world.provider.id,
            assigned_by_id=world.user.id,
            status=status,
        )

    session.add(assignment(AssignmentStatus.REJECTED))
    session.add(assignment(AssignmentStatus.OFFERED))
    await session.flush()  # A rejected offer doesn't block a new one.
    await _expect_rejected(
        session,
        assignment(AssignmentStatus.ACCEPTED),
        "uq_booking_assignments_one_open_per_booking",
    )


async def test_a_user_can_have_only_one_default_address(
    session: AsyncSession, world: World
) -> None:
    def address(*, is_default: bool) -> Address:
        return Address(
            user_id=world.user.id,
            address_line="House 1",
            area_id=world.area.id,
            lat=31.5,
            lng=74.3,
            is_default=is_default,
        )

    session.add_all([address(is_default=True), address(is_default=False)])
    await session.flush()
    await _expect_rejected(session, address(is_default=True), "uq_addresses_one_default_per_user")


def test_every_foreign_key_has_a_supporting_index() -> None:
    """Without an index, joins and parent deletes scan the whole child table."""
    missing: list[str] = []
    for table in Base.metadata.sorted_tables:
        indexed_first = {index.columns[0].name for index in table.indexes}
        indexed_first |= {
            next(iter(constraint.columns)).name
            for constraint in table.constraints
            if isinstance(constraint, PrimaryKeyConstraint | UniqueConstraint)
        }
        missing.extend(
            f"{table.name}.{column.name}"
            for column in table.columns
            if column.foreign_keys and column.name not in indexed_first
        )
    assert missing == []


def test_every_datetime_column_is_timezone_aware() -> None:
    naive = [
        f"{table.name}.{column.name}"
        for table in Base.metadata.sorted_tables
        for column in table.columns
        if isinstance(column.type, DateTime) and not column.type.timezone
    ]
    assert naive == []


async def test_database_has_every_model_table_and_enum_checks(engine: AsyncEngine) -> None:
    def inspect_database(connection: Connection) -> tuple[set[str], set[str | None]]:
        inspector = inspect(connection)
        checks = {check["name"] for check in inspector.get_check_constraints("users")}
        return set(inspector.get_table_names()), checks

    async with engine.connect() as connection:
        tables, user_checks = await connection.run_sync(inspect_database)

    assert set(Base.metadata.tables) <= tables
    assert {"ck_users_role", "ck_users_locale"} <= user_checks
