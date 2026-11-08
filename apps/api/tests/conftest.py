"""Test fixtures. Tests run on a real Postgres, built by the real migrations.

Set TEST_DATABASE_URL to use a server other than the one in infra/docker-compose.yml. The target
database is dropped and recreated on every run, so never point it at a database you care about.
"""

import asyncio
import os
import tempfile
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import asyncpg
import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from khidmat_api.core.config import Environment, Settings
from khidmat_api.core.database import get_session
from khidmat_api.main import create_app

API_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEST_DATABASE_URL = (
    "postgresql+asyncpg://khidmat:khidmat_local_only@localhost:5432/khidmat_test"
)
ALLOWED_ORIGIN = "https://khidmat.example"


async def _recreate_database(url: str) -> None:
    parsed = make_url(url)
    connection = await asyncpg.connect(
        host=parsed.host,
        port=parsed.port,
        user=parsed.username,
        password=parsed.password,
        database="postgres",
    )
    try:
        await connection.execute(f'DROP DATABASE IF EXISTS "{parsed.database}" WITH (FORCE)')
        await connection.execute(f'CREATE DATABASE "{parsed.database}"')
    finally:
        await connection.close()


def recreate_database(url: str) -> None:
    asyncio.run(_recreate_database(url))


def alembic_config(url: str) -> Config:
    config = Config(API_ROOT / "alembic.ini")
    config.attributes["database_url"] = url
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session")
def database_url() -> str:
    return os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


@pytest.fixture(scope="session")
def _migrated_database(database_url: str) -> None:
    recreate_database(database_url)
    command.upgrade(alembic_config(database_url), "head")


@pytest.fixture(scope="session")
async def engine(database_url: str, _migrated_database: None) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """A session whose work is rolled back after each test, even after it commits."""
    async with engine.connect() as connection:
        transaction = await connection.begin()
        async with AsyncSession(
            bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
        ) as test_session:
            yield test_session
        await transaction.rollback()


def build_settings(database_url: str, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": Environment.TEST,
        "database_url": database_url,
        "cors_origins": [ALLOWED_ORIGIN],
        "allowed_hosts": ["localhost"],
        "log_level": "CRITICAL",
        "local_upload_dir": str(Path(tempfile.gettempdir()) / "khidmat-test-uploads"),
    }
    return Settings(_env_file=None, **(values | overrides))  # type: ignore[arg-type]


@pytest.fixture
def settings(database_url: str) -> Settings:
    return build_settings(database_url)


@pytest.fixture
def app(settings: Settings, session: AsyncSession) -> Iterator[FastAPI]:
    application = create_app(settings)

    async def _override_session() -> AsyncIterator[AsyncSession]:
        yield session

    application.dependency_overrides[get_session] = _override_session
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    # Unhandled errors must become responses, so the transport doesn't re-raise them.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://localhost") as http_client:
        yield http_client
