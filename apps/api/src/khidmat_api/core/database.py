"""Async engine, session factory and the request-scoped session dependency."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from khidmat_api.core.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    connect_args = {"server_settings": {"application_name": "khidmat-api", "timezone": "UTC"}}
    if settings.db_null_pool:
        return create_async_engine(
            settings.database_url.get_secret_value(),
            poolclass=NullPool,
            connect_args=connect_args,
        )
    return create_async_engine(
        settings.database_url.get_secret_value(),
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,  # Replaces connections the database or network has dropped.
        connect_args=connect_args,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Provide a session per request. Services own the commit.

    Committing explicitly means a failed commit becomes an error response. Dependency cleanup
    can run after the response is sent, when a failure could no longer be reported.
    """
    session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
