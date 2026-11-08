"""Pure ASGI middleware: request context, access logs and security headers."""

import re
import time
from uuid import uuid4

import structlog
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from khidmat_api.core.errors import error_body

logger = structlog.get_logger("khidmat.request")

REQUEST_ID_HEADER = "X-Request-ID"
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")

_SIGNED_LINK_PREFIX = "/api/v1/files/local/"


def _loggable_path(path: str) -> str:
    """Signed links carry a token in the path, which must never reach the logs."""
    return f"{_SIGNED_LINK_PREFIX}***" if path.startswith(_SIGNED_LINK_PREFIX) else path


_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    # Responses can contain medical data, so browsers and proxies must not store them.
    "Cache-Control": "no-store",
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in _SECURITY_HEADERS.items():
                    headers.setdefault(name, value)
            await send(message)

        await self.app(scope, receive, send_with_headers)


class RequestContextMiddleware:
    """Assign a request id, log each request and turn unhandled errors into a JSON 500.

    It catches errors itself because it sits inside the CORS middleware. Starlette's outermost
    error handler would send the 500 without CORS headers, and browsers would hide it.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = Headers(scope=scope).get(REQUEST_ID_HEADER, "")
        # Client-supplied ids are checked so they can't inject content into the logs.
        request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        started = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_with_id(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            logger.exception(
                "unhandled_exception", method=scope["method"], path=_loggable_path(scope["path"])
            )
            if response_started:
                raise
            response = JSONResponse(
                error_body("internal_error", "Something went wrong on our side."),
                status_code=500,
            )
            await response(scope, receive, send_with_id)
        finally:
            logger.info(
                "request_completed",
                method=scope["method"],
                path=_loggable_path(scope["path"]),  # Query strings can contain personal data.
                status=status_code,
                duration_ms=round((time.perf_counter() - started) * 1000, 1),
            )
