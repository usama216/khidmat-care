"""Migrations must match the models and be able to run in both directions."""

from alembic import command
from sqlalchemy import make_url

from tests.conftest import alembic_config, recreate_database


def test_migrations_round_trip_and_match_the_models(database_url: str) -> None:
    url = make_url(database_url).set(database=f"{make_url(database_url).database}_migrations")
    scratch_url = url.render_as_string(hide_password=False)
    recreate_database(scratch_url)
    config = alembic_config(scratch_url)

    command.upgrade(config, "head")
    command.check(config)  # Raises if the models changed without a migration.
    command.downgrade(config, "base")
    command.upgrade(config, "head")
