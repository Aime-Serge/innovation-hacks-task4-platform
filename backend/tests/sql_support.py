"""A disposable PostgreSQL for the tests (NFR-323).

One container per test session, started from the same `database/init/roles.sh` compose uses.
The schema is built once by running the Alembic migrations into a template database (the real
migrations are exercised, never `create_all`), then each pytest worker clones it. Credentials are
generated for the run, exist only in memory and in this container, and are never written anywhere.
"""

import asyncio
import os
import secrets
import time
from collections.abc import Coroutine, Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.core.container import DockerContainer

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "postgres:16.4"
ADMIN = "ih_admin"
TEMPLATE = "ih_template"
USERS = {"admin": ADMIN, "migrator": "ih_migrator", "app": "ih_app", "readonly": "ih_readonly"}
CLEAR_STATEMENTS = (
    "DELETE FROM activity",
    "DELETE FROM tasks",
    "DELETE FROM projects",
    "DELETE FROM users",
)
TABLES = ("activity", "tasks", "projects", "users")


@dataclass(frozen=True)
class Passwords:
    admin: str
    migrator: str
    app: str
    readonly: str


@dataclass(frozen=True)
class Postgres:
    host: str
    port: int
    passwords: Passwords

    def url(self, role: str, database: str, options: str = "") -> str:
        password = getattr(self.passwords, role)
        user = {
            "admin": ADMIN,
            "migrator": "ih_migrator",
            "app": "ih_app",
            "readonly": "ih_readonly",
        }[role]
        return f"postgresql+asyncpg://{user}:{password}@{self.host}:{self.port}/{database}{options}"

    def engine(self, role: str, database: str) -> AsyncEngine:
        """An autocommit engine for one role, so DDL and cleanup run without a transaction."""
        return create_async_engine(
            self.url(role, database), isolation_level="AUTOCOMMIT", poolclass=NullPool
        )

    async def run(self, role: str, database: str, *statements: str) -> None:
        engine = self.engine(role, database)
        try:
            async with engine.connect() as connection:
                for statement in statements:
                    await connection.execute(text(statement))
        finally:
            await engine.dispose()


def _new_passwords() -> Passwords:
    return Passwords(*(secrets.token_urlsafe(24) for _ in range(4)))


def run_coro[T](coro: Coroutine[Any, Any, T]) -> T:
    """Run a coroutine to completion from sync code, even when the caller sits in an event loop."""
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


def start_container() -> tuple[DockerContainer, Postgres]:
    passwords = _new_passwords()
    container = (
        DockerContainer(IMAGE)
        .with_env("POSTGRES_DB", TEMPLATE)
        .with_env("POSTGRES_USER", ADMIN)
        .with_env("POSTGRES_PASSWORD", passwords.admin)
        .with_env("APP_DB_PASSWORD", passwords.app)
        .with_env("MIGRATOR_DB_PASSWORD", passwords.migrator)
        .with_env("READONLY_DB_PASSWORD", passwords.readonly)
        .with_exposed_ports(5432)
        .with_volume_mapping(str(ROOT / "database" / "init"), "/docker-entrypoint-initdb.d", "ro")
    )
    container.start()
    postgres = Postgres(
        container.get_container_host_ip(), int(container.get_exposed_port(5432)), passwords
    )
    _wait_until_ready(postgres)
    return container, postgres


def _wait_until_ready(postgres: Postgres) -> None:
    async def probe() -> None:
        await postgres.run("admin", TEMPLATE, "SELECT 1")

    deadline = time.monotonic() + 90
    while True:
        try:
            run_coro(probe())
            return
        except Exception:
            if time.monotonic() > deadline:
                raise
            time.sleep(0.5)


def _config() -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    return config


def _migrate_here(
    postgres: Postgres, database: str, revision: str = "head", *, down: bool = False
) -> None:
    """Run Alembic as the migration role. The URL goes in the environment, as in production."""
    previous = os.environ.get("MIGRATION_DATABASE_URL")
    os.environ["MIGRATION_DATABASE_URL"] = postgres.url("migrator", database)
    try:
        (command.downgrade if down else command.upgrade)(_config(), revision)
    finally:
        if previous is None:
            os.environ.pop("MIGRATION_DATABASE_URL", None)
        else:
            os.environ["MIGRATION_DATABASE_URL"] = previous


def build_template(postgres: Postgres) -> None:
    migrate(postgres, TEMPLATE)


async def clone_database(postgres: Postgres, name: str) -> None:
    """A fresh copy of the migrated template, owned by the migration role (ADR-308)."""
    await postgres.run(
        "admin",
        "postgres",
        f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)',
        f'CREATE DATABASE "{name}" TEMPLATE "{TEMPLATE}" OWNER ih_migrator',
        f'GRANT CONNECT ON DATABASE "{name}" TO ih_app, ih_readonly',
    )


async def empty_tables(postgres: Postgres, database: str) -> None:
    """Between tests: every table emptied, children first. Cheap next to recreating the schema."""
    await postgres.run("admin", database, *CLEAR_STATEMENTS)


def worker_database() -> str:
    return f"ih_test_{os.environ.get('PYTEST_XDIST_WORKER', 'main')}"


def stop(container: DockerContainer) -> None:
    container.stop()


def iter_tables() -> Iterator[str]:
    yield from TABLES


def _check_here(postgres: Postgres, database: str) -> None:
    """`alembic check`: raises when the models and the migrations disagree (FR-320)."""
    previous = os.environ.get("MIGRATION_DATABASE_URL")
    os.environ["MIGRATION_DATABASE_URL"] = postgres.url("migrator", database)
    try:
        command.check(_config())
    finally:
        if previous is None:
            os.environ.pop("MIGRATION_DATABASE_URL", None)
        else:
            os.environ["MIGRATION_DATABASE_URL"] = previous


async def create_empty_database(postgres: Postgres, name: str) -> None:
    """A bare database owned by the migration role, for migration round trips."""
    await postgres.run(
        "admin",
        "postgres",
        f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)',
        f'CREATE DATABASE "{name}" OWNER ih_migrator',
    )


def migrate(
    postgres: Postgres, database: str, revision: str = "head", *, down: bool = False
) -> None:
    """Alembic starts its own event loop, so it always runs in a fresh thread."""
    with ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(_migrate_here, postgres, database, revision, down=down).result()


def check_drift(postgres: Postgres, database: str) -> None:
    with ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(_check_here, postgres, database).result()


async def amigrate(
    postgres: Postgres, database: str, revision: str = "head", *, down: bool = False
) -> None:
    """`migrate` for async tests: Alembic starts its own event loop, so it runs in a thread."""
    await asyncio.to_thread(migrate, postgres, database, revision, down=down)


class Server:
    """A container the test may pause, restart or stop. Its host port is read fresh each time,
    because Docker may hand out a different one after a restart."""

    def __init__(self) -> None:
        self.container, first = start_container()
        self.passwords = first.passwords

    @property
    def postgres(self) -> Postgres:
        return Postgres(
            self.container.get_container_host_ip(),
            int(self.container.get_exposed_port(5432)),
            self.passwords,
        )

    def pause(self) -> None:
        self.container.get_wrapped_container().pause()

    def unpause(self) -> None:
        self.container.get_wrapped_container().unpause()

    def restart(self) -> None:
        self.container.get_wrapped_container().restart(timeout=10)
        _wait_until_ready(self.postgres)

    def stop(self) -> None:
        self.container.stop()
