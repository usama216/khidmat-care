"""Business settings changed from the dashboard, such as commission and minimum balance."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError
from khidmat_api.modules.catalog.models import PlatformSetting

COMMISSION_KEY = "commission.default_bps"
MINIMUM_BALANCE_KEY = "wallet.minimum_balance_pkr"
TOPUP_INSTRUCTIONS_KEY = "wallet.topup_instructions"

DEFAULT_MINIMUM_BALANCE_PKR = 700


@dataclass(frozen=True)
class PlatformSettings:
    commission_bps: int | None
    minimum_balance_pkr: int
    topup_instructions: str


async def get_platform_settings(session: AsyncSession) -> PlatformSettings:
    commission = await session.get(PlatformSetting, COMMISSION_KEY)
    minimum = await session.get(PlatformSetting, MINIMUM_BALANCE_KEY)
    instructions = await session.get(PlatformSetting, TOPUP_INSTRUCTIONS_KEY)
    return PlatformSettings(
        commission_bps=commission.value if commission else None,
        minimum_balance_pkr=minimum.value if minimum else DEFAULT_MINIMUM_BALANCE_PKR,
        topup_instructions=instructions.value if instructions else "",
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
