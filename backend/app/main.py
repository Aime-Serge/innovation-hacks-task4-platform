"""App factory: settings, logging, container, middleware, routers, handlers (section 7)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, landing
from app.api.v1 import api_router
from app.container import Container, build_container
from app.core.clock import Clock, IdFactory
from app.core.config import Settings, load_settings
from app.core.handlers import register_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    BodyGuardMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
)
from app.seed import apply_seed_profile

DESCRIPTION = """
The backend for the DevDash dashboard: users, projects, tasks, activity and a dashboard summary.

**Try it in five steps**

1. `POST /api/v1/users` to register (or use a seeded account in development).
2. `POST /api/v1/auth/login` to get a token.
3. Click **Authorize** above and paste the `accessToken`.
4. `POST /api/v1/projects`, then `POST /api/v1/tasks`.
5. `PATCH /api/v1/tasks/{taskId}/status` to move a task through its workflow.

Every error has the same shape: `{"error": {"code", "message", "details"?, "requestId"}}`.
State is kept in memory and resets on restart (Task 3 adds the database).
"""

TAGS = [
    {"name": "Authentication", "description": "Log in and inspect the current token."},
    {"name": "Users", "description": "Registration, profiles and role management."},
    {"name": "Projects", "description": "Projects with calculated progress."},
    {"name": "Tasks", "description": "Tasks, filters, and the status workflow."},
    {"name": "Dashboard", "description": "Activity feed and summary for the dashboard."},
    {"name": "Health", "description": "Liveness and readiness for an orchestrator."},
]


def create_app(
    settings: Settings | None = None,
    clock: Clock | None = None,
    ids: IdFactory | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    configure_logging(settings.log_level)
    container = build_container(settings, clock, ids)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            await apply_seed_profile(container)
            yield
        finally:
            await container.close()

    docs = settings.docs_on
    app = FastAPI(
        title="DevDash API",
        version="1.0.0",
        description=DESCRIPTION,
        openapi_tags=TAGS,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
        generate_unique_id_function=lambda route: route.name,
        lifespan=lifespan,
    )
    app.state.container = container
    register_handlers(app)
    app.include_router(landing.router)
    app.include_router(health.router)
    app.include_router(api_router)

    # add_middleware wraps outward: the last one added runs first.
    app.add_middleware(BodyGuardMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Location", "Retry-After"],
    )
    app.add_middleware(SecurityHeadersMiddleware, production=settings.is_production)
    app.add_middleware(RequestContextMiddleware, timeout_seconds=settings.request_timeout_seconds)
    return app


__all__ = ["Container", "create_app"]
