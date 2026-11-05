"""Provider queries used by other modules."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.providers.models import Provider, ProviderStatus


async def count_providers(session: AsyncSession, status: ProviderStatus) -> int:
    count = await session.scalar(
        select(func.count()).select_from(Provider).where(Provider.status == status)
    )
    return count or 0
