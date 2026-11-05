"""Liveness and readiness probes, kept outside /api/v1 so they never change with the API."""

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import ServiceUnavailableError

router = APIRouter(tags=["health"])


@router.get("/healthz", summary="The process is running")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", summary="The API can reach its database")
async def readiness(session: SessionDep) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as exc:
        raise ServiceUnavailableError("The database is unavailable.") from exc
    return {"status": "ok"}
