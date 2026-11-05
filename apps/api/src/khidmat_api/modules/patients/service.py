"""Patient queries used by other modules."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.patients.models import Patient


async def count_patients(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).select_from(Patient)) or 0
