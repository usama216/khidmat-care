from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.catalog.models import Area, ServiceType
from khidmat_api.seed import LAHORE_AREAS, PHYSIO_SERVICES, seed_reference_data


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
