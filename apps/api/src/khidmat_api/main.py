"""Application factory. Run with: uvicorn khidmat_api.main:create_app --factory"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from khidmat_api.core.config import Settings, get_settings
from khidmat_api.core.database import create_engine, create_session_factory
from khidmat_api.core.errors import register_error_handlers
from khidmat_api.core.logging import configure_logging
from khidmat_api.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from khidmat_api.modules.contact.router import router as contact_router
from khidmat_api.modules.health.router import router as health_router

API_V1_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings)
        app.state.session_factory = create_session_factory(engine)
        yield
        await engine.dispose()

    app = FastAPI(
        title="Khidmat Care API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )

    # The last middleware added runs first, so requests pass through CORS first.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,  # Auth uses HttpOnly cookies.
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    register_error_handlers(app)
    app.state.settings = settings

    app.include_router(health_router)

    api_v1 = APIRouter(prefix=API_V1_PREFIX)
    api_v1.include_router(contact_router)
    app.include_router(api_v1)

    return app
