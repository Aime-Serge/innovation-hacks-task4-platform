"""Fixtures for tests that talk to PostgreSQL directly, as the application role (section 10)."""

from collections.abc import AsyncIterator, Iterator
from typing import Any
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.sql.errors import constraint, sqlstate
from tests import sql_support
from tests.conftest import Env, build_env
from tests.sql_support import Postgres


class Db:
    """Raw SQL as one role. Every statement autocommits, so a failure never poisons the next."""

    def __init__(self, engine: AsyncEngine) -> None:
        self.engine = engine

    async def run(self, sql: str, **params: Any) -> Any:
        async with self.engine.connect() as connection:
            result = await connection.execute(text(sql), params)
            rows = result.all() if result.returns_rows else result.rowcount
            await connection.commit()  # a no-op on an autocommit engine, needed on the app's own
            return rows

    async def rejected(self, sql: str, **params: Any) -> tuple[str | None, str | None]:
        """Run a statement that must fail; return (SQLSTATE, constraint name)."""
        try:
            await self.run(sql, **params)
        except DBAPIError as error:
            return sqlstate(error), constraint(error)
        raise AssertionError(f"the database accepted: {sql}")

    async def user(self, **overrides: Any) -> UUID:
        values: dict[str, Any] = {
            "id": uuid4(),
            "name": "Ada",
            "email": f"{uuid4().hex}@example.com",
            "hash": "argon2-hash",
            "role": "developer",
            "avatar": None,
            "theme": "system",
        } | overrides
        await self.run(
            "INSERT INTO users (id, name, email, password_hash, role, avatar_url, theme) "
            "VALUES (:id, :name, :email, :hash, :role, :avatar, :theme)",
            **values,
        )
        return UUID(str(values["id"]))

    async def project(self, owner: UUID, **overrides: Any) -> UUID:
        values: dict[str, Any] = {
            "id": uuid4(),
            "owner": owner,
            "name": "Atlas",
            "description": "",
            "status": "active",
        } | overrides
        await self.run(
            "INSERT INTO projects (id, name, description, status, owner_id) "
            "VALUES (:id, :name, :description, :status, :owner)",
            **values,
        )
        return UUID(str(values["id"]))

    async def task(self, project: UUID, **overrides: Any) -> UUID:
        values: dict[str, Any] = {
            "id": uuid4(),
            "project": project,
            "title": "Write docs",
            "description": "",
            "status": "todo",
            "priority": "medium",
            "assignee": None,
            "completed": None,
        } | overrides
        await self.run(
            "INSERT INTO tasks (id, project_id, title, description, status, priority, "
            "assignee_id, completed_at) VALUES (:id, :project, :title, :description, :status, "
            ":priority, :assignee, :completed)",
            **values,
        )
        return UUID(str(values["id"]))

    async def activity(self, actor: UUID, project: UUID, task: UUID | None = None) -> UUID:
        activity_id = uuid4()
        await self.run(
            "INSERT INTO activity (id, actor_id, project_id, task_id, type) "
            "VALUES (:id, :actor, :project, :task, 'created')",
            id=activity_id,
            actor=actor,
            project=project,
            task=task,
        )
        return activity_id


@pytest.fixture
async def clean(postgres: Postgres, worker_db: str) -> str:
    """An empty, fully migrated database (a clone of the template) for one test."""
    await sql_support.empty_tables(postgres, worker_db)
    return worker_db


@pytest.fixture
async def app_db(postgres: Postgres, clean: str) -> AsyncIterator[Db]:
    """Raw SQL as ih_app: the API's own account, which is what must not be able to cheat."""
    db = Db(postgres.engine("app", clean))
    try:
        yield db
    finally:
        await db.engine.dispose()


@pytest.fixture
async def admin_db(postgres: Postgres, clean: str) -> AsyncIterator[Db]:
    db = Db(postgres.engine("admin", clean))
    try:
        yield db
    finally:
        await db.engine.dispose()


@pytest.fixture(scope="module")
def dedicated() -> Iterator[sql_support.Server]:
    """A private PostgreSQL that a test may pause or restart without disturbing the others."""
    server = sql_support.Server()
    try:
        sql_support.migrate(server.postgres, sql_support.TEMPLATE)
        yield server
    finally:
        server.stop()


@pytest.fixture
async def sql_env(clean: str, postgres: Postgres) -> AsyncIterator[Env]:
    """The whole API on PostgreSQL, whatever --backend says, seeded with the `empty` profile."""
    async for value in build_env(
        "empty",
        storage_backend="sql",
        database_url=SecretStr(postgres.url("app", clean)),
    ):
        yield value
