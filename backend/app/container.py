"""Builds the object graph once per app. Nothing here is module-level state (section 7)."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app.ai.client import LLMClient
from app.ai.fake_client import FakeLLMClient
from app.ai.gemini_client import GeminiClient
from app.ai.service import AiService
from app.core.clock import Clock, IdFactory, SystemClock, UuidFactory
from app.core.config import Settings
from app.core.ratelimit import RateLimiter
from app.core.security import PasswordHasher, TokenCodec
from app.repositories.memory import (
    MemoryActivityRepository,
    MemoryAiRequestRepository,
    MemoryProjectRepository,
    MemoryRefreshTokenRepository,
    MemoryTaskRepository,
    MemoryUnitOfWork,
    MemoryUserRepository,
)
from app.repositories.sql import Database
from app.services.activity import ActivityService
from app.services.auth import AuthService
from app.services.dashboard import DashboardService
from app.services.projects import ProjectService
from app.services.session_service import SessionService
from app.services.tasks import TaskService
from app.services.transaction import UowFactory
from app.services.users import UserService


@dataclass
class Container:
    settings: Settings
    clock: Clock
    ids: IdFactory
    hasher: PasswordHasher
    limiter: RateLimiter
    uow: UowFactory
    auth: AuthService
    sessions: SessionService
    ai: AiService
    users: UserService
    projects: ProjectService
    tasks: TaskService
    activity: ActivityService
    dashboard: DashboardService
    database: Database | None = None
    readiness_checks: list[Callable[[], Awaitable[bool]]] = field(default_factory=list)

    async def is_ready(self) -> bool:
        """FR-322: every dependency answers. With SQL that means a query succeeds."""
        try:
            return all([await check() for check in self.readiness_checks])
        except Exception:
            return False

    async def close(self) -> None:
        """Release the connection pool at shutdown."""
        if self.database is not None:
            await self.database.dispose()


def build_container(
    settings: Settings,
    clock: Clock | None = None,
    ids: IdFactory | None = None,
    llm: LLMClient | None = None,
) -> Container:
    clock = clock or SystemClock()
    ids = ids or UuidFactory()
    hasher = PasswordHasher(settings.argon2_time_cost, settings.argon2_memory_kib)
    tokens = TokenCodec(
        settings.secret_key.get_secret_value(),
        settings.jwt_issuer,
        settings.jwt_audience,
        settings.access_token_ttl_seconds,
    )
    database: Database | None = None
    uow: UowFactory
    if settings.storage_backend == "sql":
        database = Database(settings)
        uow = database.uow
        readiness: Callable[[], Awaitable[bool]] = database.ping
    else:
        memory = MemoryUnitOfWork(
            MemoryUserRepository(),
            MemoryProjectRepository(),
            MemoryTaskRepository(),
            MemoryActivityRepository(),
            MemoryRefreshTokenRepository(),
            MemoryAiRequestRepository(),
        )

        def uow(read_only: bool = False) -> MemoryUnitOfWork:
            return memory  # the same shared repositories for every operation

        async def repositories_respond() -> bool:
            await memory.users.count_leads()
            return True

        readiness = repositories_respond
    activity = ActivityService(uow, clock, ids)
    auth = AuthService(uow, hasher, tokens, clock)
    if llm is None:
        if settings.llm_provider == "gemini":
            key = settings.llm_api_key.get_secret_value() if settings.llm_api_key else ""
            llm = GeminiClient(key, settings.llm_model or "")
        else:
            llm = FakeLLMClient(settings.fake_llm_scenario)
    return Container(
        settings=settings,
        clock=clock,
        ids=ids,
        hasher=hasher,
        limiter=RateLimiter(
            clock, settings.rate_limit_attempts, settings.rate_limit_window_seconds
        ),
        uow=uow,
        auth=auth,
        sessions=SessionService(uow, auth, tokens, clock, ids, settings.refresh_token_ttl_seconds),
        users=UserService(uow, hasher, clock, ids),
        projects=ProjectService(uow, activity, clock, ids),
        tasks=TaskService(uow, activity, clock, ids),
        ai=AiService(uow, llm, settings, clock, ids),
        activity=activity,
        dashboard=DashboardService(uow, clock),
        database=database,
        readiness_checks=[readiness],
    )
