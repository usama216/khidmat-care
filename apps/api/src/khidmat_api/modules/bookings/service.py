"""Booking queries used by other modules."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.modules.bookings.models import Booking, BookingStatus


async def count_bookings(session: AsyncSession, status: BookingStatus) -> int:
    count = await session.scalar(
        select(func.count()).select_from(Booking).where(Booking.status == status)
    )
    return count or 0
