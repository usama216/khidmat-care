"""Cross-cutting API behaviour: errors, request ids, security headers, CORS and hosts."""

from fastapi import FastAPI
from httpx import AsyncClient
from pydantic import BaseModel

from khidmat_api.core.config import Environment
from khidmat_api.core.errors import ConflictError
from khidmat_api.core.middleware import _loggable_path
from khidmat_api.main import create_app
from tests.conftest import ALLOWED_ORIGIN, build_settings


class _Payload(BaseModel):
    age: int


def _add_routes(app: FastAPI) -> None:
    @app.post("/test/validate")
    async def _validate(payload: _Payload) -> _Payload:
        return payload

    @app.get("/test/app-error")
    async def _app_error() -> None:
        raise ConflictError("Already booked.", details={"booking": "KC-1001"})

    @app.get("/test/crash")
    async def _crash() -> None:
        raise RuntimeError("secret internal detail")


async def test_response_gets_a_generated_request_id(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert len(response.headers["X-Request-ID"]) == 32


async def test_safe_request_id_is_reused(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": "trace-abc-12345"})
    assert response.headers["X-Request-ID"] == "trace-abc-12345"


async def test_unsafe_request_id_is_replaced(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": 'bad" id=injected'})
    assert response.headers["X-Request-ID"] != 'bad" id=injected'


async def test_security_headers_are_set(client: AsyncClient) -> None:
    headers = (await client.get("/healthz")).headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"
    assert headers["Cache-Control"] == "no-store"


async def test_unknown_route_uses_the_error_shape(client: AsyncClient) -> None:
    response = await client.get("/nope")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


async def test_app_error_uses_the_error_shape(app: FastAPI, client: AsyncClient) -> None:
    _add_routes(app)
    response = await client.get("/test/app-error")
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "conflict"
    assert error["message"] == "Already booked."
    assert error["details"] == {"booking": "KC-1001"}


async def test_validation_error_does_not_echo_submitted_data(
    app: FastAPI, client: AsyncClient
) -> None:
    _add_routes(app)
    response = await client.post("/test/validate", json={"age": "PRIVATE-VALUE"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["details"][0]["field"] == "body.age"
    assert "PRIVATE-VALUE" not in response.text


async def test_unhandled_error_hides_details_and_keeps_cors(
    app: FastAPI, client: AsyncClient
) -> None:
    _add_routes(app)
    response = await client.get("/test/crash", headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret internal detail" not in response.text
    assert response.headers["Access-Control-Allow-Origin"] == ALLOWED_ORIGIN
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]


async def test_cors_allows_only_configured_origins(client: AsyncClient) -> None:
    allowed = await client.get("/healthz", headers={"Origin": ALLOWED_ORIGIN})
    assert allowed.headers["Access-Control-Allow-Origin"] == ALLOWED_ORIGIN
    assert allowed.headers["Access-Control-Allow-Credentials"] == "true"

    denied = await client.get("/healthz", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in denied.headers


async def test_unknown_host_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"Host": "evil.example"})
    assert response.status_code == 400


async def test_docs_are_available_outside_production(client: AsyncClient) -> None:
    assert (await client.get("/openapi.json")).status_code == 200


def test_docs_are_disabled_in_production(database_url: str) -> None:
    settings = build_settings(
        database_url,
        environment=Environment.PRODUCTION,
        ip_hash_secret="test-secret",
        jwt_secret="x" * 48,
        encryption_key="k" * 48,
    )
    app = create_app(settings)
    assert app.docs_url is None
    assert app.openapi_url is None


def test_signed_link_tokens_are_masked_in_logs() -> None:
    assert _loggable_path("/api/v1/files/local/secret-token") == "/api/v1/files/local/***"
    assert _loggable_path("/api/v1/bookings") == "/api/v1/bookings"
