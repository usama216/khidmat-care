from httpx import ASGITransport, AsyncClient

from khidmat_api.main import create_app
from tests.conftest import build_settings


async def test_liveness(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_with_the_real_lifespan_and_database(database_url: str) -> None:
    app = create_app(build_settings(database_url))
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client,
    ):
        response = await client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_reports_an_unreachable_database() -> None:
    # Port 1 refuses connections, and the password must not reach the response.
    url = "postgresql+asyncpg://user:top-secret@127.0.0.1:1/none"
    app = create_app(build_settings(url))
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client,
    ):
        response = await client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert "top-secret" not in response.text
