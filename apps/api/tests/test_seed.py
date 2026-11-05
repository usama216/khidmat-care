import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.seed import LAHORE_AREAS, PHYSIO_SERVICES, seed_admin, seed_reference_data

ADMIN_PHONE = "+923001112233"


async def test_reference_data_can_be_seeded_repeatedly(session: AsyncSession) -> None:
    await seed_reference_data(session)
    await seed_reference_data(session)

    areas = await session.scalar(select(func.count()).select_from(Area))
    services = await session.scalar(select(func.count()).select_from(ServiceType))
    assert areas == len(LAHORE_AREAS)
    assert services == len(PHYSIO_SERVICES)


async def test_seeding_keeps_admin_edits_to_reference_data(session: AsyncSession) -> None:
    await seed_reference_data(session)
    service = await session.scalar(select(ServiceType).where(ServiceType.slug == "stroke"))
    assert service is not None
    service.name = "Renamed by admin"
    await session.flush()

    await seed_reference_data(session)
    await session.refresh(service)
    assert service.name == "Renamed by admin"


async def test_seed_admin_creates_and_promotes(session: AsyncSession) -> None:
    session.add(User(phone=ADMIN_PHONE, role=Role.PATIENT))
    await session.flush()

    await seed_admin(session, ADMIN_PHONE)

    user = await session.scalar(
        select(User).where(User.phone == ADMIN_PHONE).execution_options(populate_existing=True)
    )
    assert user is not None
    assert user.role is Role.ADMIN


async def test_seed_admin_rejects_a_badly_formatted_phone(session: AsyncSession) -> None:
    with pytest.raises(ValueError, match="international format"):
        await seed_admin(session, "03001112233")
