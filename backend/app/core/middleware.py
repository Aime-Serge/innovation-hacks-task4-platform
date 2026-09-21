"""Pure ASGI middleware: request id and JSON logs, security headers, body guard (section 9)."""

import asyncio
import logging
import re
import time
from collections.abc import MutableMapping
from typing import Any
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import LOGGER_NAME, request_id_var
from app.core.responses import GENERIC_500, error_response

_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
_API_CSP = "default-src 'none'; frame-ancestors 'none'"
_DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net; "
    "frame-ancestors 'none'"
)
_BODY_METHODS = {"POST", "PUT", "PATCH"}
logger = logging.getLogger(LOGGER_NAME)


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope["headers"]:
        if key == name:
            return str(value.decode("latin-1"))
    return None


class RequestContextMiddleware:
    """Request id, timeout, one JSON log line per request, and a generic 500 (FR-232, NFR-217)."""

    def __init__(self, app: ASGIApp, timeout_seconds: float) -> None:
        self.app = app
        self.timeout = timeout_seconds

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        supplied = _header(scope, b"x-request-id")
        request_id = supplied if supplied and _REQUEST_ID.match(supplied) else str(uuid4())
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        state: dict[str, Any] = {"status": 500, "sent": False, "error": None}

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                state["status"] = message["status"]
                state["sent"] = True
                headers: list[tuple[bytes, bytes]] = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            async with asyncio.timeout(self.timeout):
                await self.app(scope, receive, send_with_id)
        except TimeoutError:
            state["error"] = "TimeoutError"
            if not state["sent"]:
                response = error_response(
                    503, "SERVICE_UNAVAILABLE", "The request took too long. Try again."
                )
                await response(scope, receive, send_with_id)
        except Exception as error:
            state["error"] = type(error).__name__  # the class only: never the message or trace
            if not state["sent"]:
                response = error_response(500, "INTERNAL_ERROR", GENERIC_500)
                await response(scope, receive, send_with_id)
        finally:
            self._log(scope, state, time.perf_counter() - started, request_id)
            request_id_var.reset(token)

    def _log(
        self, scope: Scope, state: MutableMapping[str, Any], seconds: float, request_id: str
    ) -> None:
        extra: dict[str, object] = {
            "requestId": request_id,
            "method": scope["method"],
            "path": scope["path"],  # never the query string: it can carry search text
            "status": state["status"],
            "durationMs": round(seconds * 1000, 2),
            "userId": scope.get("state", {}).get("user_id"),
            "errorType": state["error"],
        }
        level = logging.ERROR if state["status"] >= 500 else logging.INFO
        logger.log(level, "request", extra=extra)


class SecurityHeadersMiddleware:
    """NFR-213: nosniff and friends on every response, no-store on auth responses."""

    def __init__(self, app: ASGIApp, production: bool) -> None:
        self.app = app
        self.production = production

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope["path"]
        docs = path.startswith(_DOCS_PATHS)
        auth_route = path.startswith("/api/v1/auth") or (
            scope["method"] == "POST" and path == "/api/v1/users"
        )

        async def send_secure(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers: list[tuple[bytes, bytes]] = list(message.get("headers", []))
                own_csp = any(name.lower() == b"content-security-policy" for name, _ in headers)
                extra = {
                    b"x-content-type-options": b"nosniff",
                    b"referrer-policy": b"no-referrer",
                    b"x-frame-options": b"DENY",
                    b"content-security-policy": (_DOCS_CSP if docs else _API_CSP).encode(),
                }
                if own_csp:  # a route with its own policy (the welcome page) keeps it
                    del extra[b"content-security-policy"]
                if auth_route:
                    extra[b"cache-control"] = b"no-store"
                if self.production:
                    extra[b"strict-transport-security"] = b"max-age=63072000; includeSubDomains"
                headers.extend(extra.items())
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_secure)


class _BodyTooLarge(Exception):
    pass


class BodyGuardMiddleware:
    """NFR-214 and section 6: 413 over the limit, 415 unless application/json."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in _BODY_METHODS:
            await self.app(scope, receive, send)
            return
        length_header = _header(scope, b"content-length")
        has_body = (length_header not in (None, "0")) or _header(scope, b"transfer-encoding")
        declared = int(length_header) if length_header and length_header.isdigit() else 0
        if declared > self.max_bytes:
            await self._reject(
                413, "PAYLOAD_TOO_LARGE", "The request body is too large.", scope, receive, send
            )
            return
        content_type = (_header(scope, b"content-type") or "").split(";")[0].strip().lower()
        if has_body and content_type != "application/json":
            await self._reject(
                415,
                "UNSUPPORTED_MEDIA_TYPE",
                "The content type must be application/json.",
                scope,
                receive,
                send,
            )
            return
        seen = 0
        rejected = False

        async def counted() -> Message:
            nonlocal seen, rejected
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes and not rejected:
                    # Answer now: the framework would turn this exception into a 400 (ADR-219).
                    rejected = True
                    await self._reject(
                        413,
                        "PAYLOAD_TOO_LARGE",
                        "The request body is too large.",
                        scope,
                        receive,
                        send,
                    )
                    raise _BodyTooLarge
            return message

        async def guarded_send(message: Message) -> None:
            if not rejected:
                await send(message)

        try:
            await self.app(scope, counted, guarded_send)
        except _BodyTooLarge:
            return

    @staticmethod
    async def _reject(
        status: int, code: str, message: str, scope: Scope, receive: Receive, send: Send
    ) -> None:
        await error_response(status, code, message)(scope, receive, send)
