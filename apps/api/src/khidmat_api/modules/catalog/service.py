"""Catalog queries used by other modules."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.catalog.models import ServicePackage, ServiceType


async def count_active_services(session: AsyncSession) -> int:
    count = await session.scalar(
        select(func.count()).select_from(ServiceType).where(ServiceType.is_active)
    )
    return count or 0


async def count_active_packages(session: AsyncSession) -> int:
    count = await session.scalar(
        select(func.count()).select_from(ServicePackage).where(ServicePackage.is_active)
    )
    return count or 0
