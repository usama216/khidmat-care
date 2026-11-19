"""Reference data every environment needs. Safe to run repeatedly.

Run with: uv run python -m khidmat_api.seed

Each service gets a single-session option. Fees are set by each physiotherapist.
"""

import asyncio
from dataclasses import dataclass

import structlog
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.config import get_settings
from khidmat_api.core.database import create_engine, create_session_factory
from khidmat_api.core.logging import configure_logging
from khidmat_api.modules.catalog.models import Area, ServiceCategory, ServiceType

logger = structlog.get_logger("khidmat.seed")

LAHORE_AREAS: tuple[tuple[str, str], ...] = (
    ("Allama Iqbal Town", "علامہ اقبال ٹاؤن"),
    ("Askari", "عسکری"),
    ("Bahria Town", "بحریہ ٹاؤن"),
    ("Cantt", "کینٹ"),
    ("DHA", "ڈی ایچ اے"),
    ("EME Society", "ای ایم ای سوسائٹی"),
    ("Faisal Town", "فیصل ٹاؤن"),
    ("Garden Town", "گارڈن ٹاؤن"),
    ("Gulberg", "گلبرگ"),
    ("Gulshan-e-Ravi", "گلشن راوی"),
    ("Johar Town", "جوہر ٹاؤن"),
    ("Lake City", "لیک سٹی"),
    ("Model Town", "ماڈل ٹاؤن"),
    ("Samanabad", "سمن آباد"),
    ("Shadman", "شادمان"),
    ("Township", "ٹاؤن شپ"),
    ("Valencia", "ویلینشیا"),
    ("Wapda Town", "واپڈا ٹاؤن"),
)


@dataclass(frozen=True)
class SeedService:
    slug: str
    name: str
    name_urdu: str


# Slugs match the service ids used by the web app.
PHYSIO_SERVICES: tuple[SeedService, ...] = (
    SeedService("post-surgery", "Post-surgery rehab", "سرجری کے بعد بحالی"),
    SeedService("stroke", "Stroke rehab", "فالج کے بعد بحالی"),
    SeedService("back-neck", "Back & neck pain", "کمر اور گردن کا درد"),
    SeedService("knee-joint", "Knee & joint pain", "گھٹنوں اور جوڑوں کا درد"),
    SeedService("elderly", "Elderly mobility", "بزرگوں کا چلنا پھرنا"),
    SeedService("sports", "Sports injuries", "کھیل کی چوٹیں"),
    SeedService("neuro", "Neuro rehab", "اعصابی بحالی"),
    SeedService("pediatric", "Children's physiotherapy", "بچوں کی فزیوتھراپی"),
)


async def seed_reference_data(session: AsyncSession) -> None:
    await session.execute(
        insert(Area)
        .values(
            [{"name": name, "name_urdu": urdu, "city": "Lahore"} for name, urdu in LAHORE_AREAS]
        )
        .on_conflict_do_nothing(index_elements=[Area.city, Area.name])
    )
    await session.execute(
        insert(ServiceType)
        .values(
            [
                {
                    "slug": service.slug,
                    "category": ServiceCategory.PHYSIO,
                    "name": service.name,
                    "name_urdu": service.name_urdu,
                    "sort_order": index,
                }
                for index, service in enumerate(PHYSIO_SERVICES)
            ]
        )
        .on_conflict_do_nothing(index_elements=[ServiceType.slug])
    )
    # Prices come from each physiotherapist's fee, so a package only sets how many sessions.
    # Every service can be booked for a single session.
    await session.execute(
        text(
            "INSERT INTO service_packages "
            "(id, service_type_id, sessions_count, price_pkr, is_active) "
            "SELECT gen_random_uuid(), s.id, 1, 0, true FROM service_types s "
            "WHERE NOT EXISTS (SELECT 1 FROM service_packages p "
            "WHERE p.service_type_id = s.id AND p.sessions_count = 1 AND p.is_active)"
        )
    )


async def _main() -> None:
    settings = get_settings()
    configure_logging(settings)
    engine = create_engine(settings)
    try:
        async with create_session_factory(engine)() as session:
            await seed_reference_data(session)
            await session.commit()
    finally:
        await engine.dispose()
    logger.info("seed_completed")


if __name__ == "__main__":
    asyncio.run(_main())
