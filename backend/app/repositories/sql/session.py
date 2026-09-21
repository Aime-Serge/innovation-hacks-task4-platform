"""Engine, pool, per-operation session and the unit of work (sections 7 and 8)."""

import asyncio
import hashlib
import logging
import time
from types import TracebackType
from typing import Any, Self

from sqlalchemy import text
from sqlalchemy.engine import Connection, ExecutionContext
from sqlalchemy.engine.interfaces import DBAPICursor
from sqlalchemy.event import listen
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool

from app.core.config import Settings
from app.core.logging import LOGGER_NAME
from app.repositories.sql.activity import SqlActivityRepository
from app.repositories.sql.errors import translate
from app.repositories.sql.projects import SqlProjectRepository
from app.repositories.sql.tasks import SqlTaskRepository
from app.repositories.sql.users import SqlUserRepository

_log = logging.getLogger(LOGGER_NAME)
_STARTED = "devdash_started"


class SqlUnitOfWork:
    """One session and one transaction. Only `commit` commits; leaving without it rolls back."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> Self:
        session = self._sessions()
        self._session = session
        self.users = SqlUserRepository(session)
        self.projects = SqlProjectRepository(session)
        self.tasks = SqlTaskRepository(session)
        self.activity = SqlActivityRepository(session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        session = self._session
        if session is None:
            raise RuntimeError("the unit of work was left before it was entered")
        try:
            await session.rollback()  # a no-op after a commit; undoes everything otherwise
        finally:
            await session.close()
        if exc is not None:
            mapped = translate(exc, "read")
            if mapped is not None and mapped is not exc:
                raise mapped from None

    async def commit(self) -> None:
        if self._session is None:
            raise RuntimeError("commit needs an entered unit of work")
        try:
            await self._session.commit()
        except Exception as error:
            mapped = translate(error, "update")
            if mapped is None:
                raise
            raise mapped from None


class Database:
    """Owns the engine. One per app; `dispose` closes every pooled connection."""

    def __init__(self, settings: Settings) -> None:
        url = settings.database_url
        if url is None:  # Settings guarantees a URL when the backend is sql
            raise RuntimeError("DATABASE_URL: required when STORAGE_BACKEND=sql")
        self.engine: AsyncEngine = create_async_engine(
            url.get_secret_value(),
            poolclass=AsyncAdaptedQueuePool,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout_s,
            # No pre-ping: it costs a round trip per checkout. A dead connection is handled when it
            # fails (SQLAlchemy discards the whole pool, ADR-329), so the next request reconnects.
            pool_pre_ping=False,
            pool_recycle=1800,
            connect_args={
                "timeout": settings.db_pool_timeout_s,
                # A dead server must never hold a request open longer than a query may run.
                "command_timeout": settings.db_statement_timeout_ms / 1000 + 1,
                "server_settings": {
                    "application_name": "devdash-api",
                    "statement_timeout": str(settings.db_statement_timeout_ms),
                    "lock_timeout": str(settings.db_lock_timeout_ms),
                    "idle_in_transaction_session_timeout": str(settings.db_idle_tx_timeout_ms),
                    "timezone": "UTC",
                },
            },
        )
        info = {"timeout": settings.db_pool_timeout_s}
        self._sessions = async_sessionmaker(
            self.engine, expire_on_commit=False, autoflush=False, info=info
        )
        # Reads run in autocommit: one statement, no BEGIN and no ROLLBACK round trips. At READ
        # COMMITTED a transaction adds no consistency to a read, so nothing is lost (ADR-329).
        self._read_sessions = async_sessionmaker(
            self.engine.execution_options(isolation_level="AUTOCOMMIT"),
            expire_on_commit=False,
            autoflush=False,
            info=info,
        )
        self._slow_ms = settings.db_slow_query_ms
        self._ping_timeout = min(settings.db_pool_timeout_s, 3.0)
        listen(self.engine.sync_engine, "before_cursor_execute", self._before)
        listen(self.engine.sync_engine, "after_cursor_execute", self._after)

    def uow(self, read_only: bool = False) -> SqlUnitOfWork:
        return SqlUnitOfWork(self._read_sessions if read_only else self._sessions)

    async def ping(self) -> bool:
        """FR-322: a real query, not a socket check, and it answers within seconds (NFR-312)."""
        probe = asyncio.ensure_future(self._probe())
        done, _ = await asyncio.wait({probe}, timeout=self._ping_timeout)
        if not done:
            probe.cancel()  # not awaited: cleaning up a hung connection must not hold this answer
            raise TimeoutError("the database did not answer in time")
        return probe.result()

    async def _probe(self) -> bool:
        async with self.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return True

    def checked_out(self) -> int:
        """Connections in use right now; 0 when the service is idle (NFR-305)."""
        pool = self.engine.pool
        return int(pool.checkedout()) if isinstance(pool, AsyncAdaptedQueuePool) else 0

    async def dispose(self) -> None:
        await self.engine.dispose()

    def _before(
        self,
        connection: Connection,
        cursor: DBAPICursor,
        statement: str,
        parameters: Any,
        context: ExecutionContext | None,
        executemany: bool,
    ) -> None:
        connection.info[_STARTED] = time.perf_counter()

    def _after(
        self,
        connection: Connection,
        cursor: DBAPICursor,
        statement: str,
        parameters: Any,
        context: ExecutionContext | None,
        executemany: bool,
    ) -> None:
        """NFR-324: a slow query is logged with a fingerprint and duration, never its values."""
        started = connection.info.pop(_STARTED, None)
        if started is None:
            return
        millis = (time.perf_counter() - started) * 1000
        if millis >= self._slow_ms:
            fingerprint = hashlib.sha256(statement.encode()).hexdigest()[:12]
            _log.warning(
                "slow query",
                extra={"fingerprint": fingerprint, "durationMs": round(millis, 1)},
            )
