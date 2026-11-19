"""Business settings changed from the dashboard, such as commission and minimum balance."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError
from khidmat_api.modules.catalog.models import PlatformSetting

COMMISSION_KEY = "commission.default_bps"
MINIMUM_BALANCE_KEY = "wallet.minimum_balance_pkr"
TOPUP_INSTRUCTIONS_KEY = "wallet.topup_instructions"
HOLD_HOURS_KEY = "booking.hold_hours"
FEE_MIN_KEY = "fee.min_pkr"
FEE_MAX_KEY = "fee.max_pkr"

DEFAULT_MINIMUM_BALANCE_PKR = 700
# How long a physiotherapist has to reply before the held time is released.
DEFAULT_HOLD_HOURS = 3
DEFAULT_FEE_MIN_PKR = 1000
DEFAULT_FEE_MAX_PKR = 10000


@dataclass(frozen=True)
class PlatformSettings:
    commission_bps: int | None
    minimum_balance_pkr: int
    topup_instructions: str
    hold_hours: int
    fee_min_pkr: int
    fee_max_pkr: int


async def get_platform_settings(session: AsyncSession) -> PlatformSettings:
    rows = await session.scalars(
        select(PlatformSetting).where(
            PlatformSetting.key.in_(
                (
                    COMMISSION_KEY,
                    MINIMUM_BALANCE_KEY,
                    TOPUP_INSTRUCTIONS_KEY,
                    HOLD_HOURS_KEY,
                    FEE_MIN_KEY,
                    FEE_MAX_KEY,
                )
            )
        )
    )
    values = {row.key: row.value for row in rows}
    return PlatformSettings(
        commission_bps=values.get(COMMISSION_KEY),
        minimum_balance_pkr=values.get(MINIMUM_BALANCE_KEY, DEFAULT_MINIMUM_BALANCE_PKR),
        topup_instructions=values.get(TOPUP_INSTRUCTIONS_KEY, ""),
        hold_hours=values.get(HOLD_HOURS_KEY, DEFAULT_HOLD_HOURS),
        fee_min_pkr=values.get(FEE_MIN_KEY, DEFAULT_FEE_MIN_PKR),
        fee_max_pkr=values.get(FEE_MAX_KEY, DEFAULT_FEE_MAX_PKR),
    )


async def set_platform_setting(session: AsyncSession, key: str, value: object) -> None:
    setting = await session.get(PlatformSetting, key)
    if setting is None:
        session.add(PlatformSetting(key=key, value=value))
    else:
        setting.value = value


async def require_commission_bps(session: AsyncSession) -> int:
    commission = (await get_platform_settings(session)).commission_bps
    if commission is None:
        raise ConflictError("Bookings are not open yet. Please contact support.")
    return commission
