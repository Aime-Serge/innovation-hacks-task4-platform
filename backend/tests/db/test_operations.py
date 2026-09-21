"""TC-301, TC-311, TC-380, TC-397: persistence, live CRUD, generated docs and seed profiles."""

from datetime import date
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import SecretStr

from app.container import build_container
from app.domain.queries import ActivityQuery
from app.seed import SHAPES, seed
from scripts import generate_db_docs
from tests import sql_support
from tests.conftest import DEV, LEAD, NOW, PASSWORD, Env, FakeClock, make_settings
from tests.db.conftest import Db
from tests.db.test_integrity import orphan_count
from tests.sql_support import Postgres

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.sql
async def test_tc311_live_crud_for_each_entity_with_the_rows_inspected(
    sql_env: Env, postgres: Postgres, clean: str
) -> None:
    db = Db(postgres.engine("admin", clean))
    try:
        # users
        created = await sql_env.client.post(
            "/api/v1/users",
            json={
                "name": "Ada Lovelace",
                "email": "ADA@Example.com",
                "password": "correct-horse-battery",
            },
        )
        user_id = created.json()["id"]
        row = (
            await db.run(
                "SELECT name, email, role, password_hash FROM users WHERE id = :i", i=user_id
            )
        )[0]
        assert (row.name, row.email, row.role) == ("Ada Lovelace", "ada@example.com", "developer")
        assert row.password_hash.startswith("$argon2id$")  # stored hashed, never the password
        me = sql_env.auth(DEV)
        await sql_env.client.patch(
            f"/api/v1/users/{user_id}", json={"name": "Ada L."}, headers=sql_env.auth(LEAD)
        )
        assert (await db.run("SELECT name FROM users WHERE id = :i", i=user_id))[0].name == "Ada L."
        # projects
        project = (
            await sql_env.client.post(
                "/api/v1/projects", json={"name": "Atlas", "dueDate": "2026-12-01"}, headers=me
            )
        ).json()
        prow = (
            await db.run(
                "SELECT name, status, due_date FROM projects WHERE id = :i", i=project["id"]
            )
        )[0]
        assert (prow.name, prow.status, prow.due_date) == ("Atlas", "planned", date(2026, 12, 1))
        await sql_env.client.patch(
            f"/api/v1/projects/{project['id']}",
            json={"status": "active", "dueDate": None},
            headers=me,
        )
        prow = (
            await db.run("SELECT status, due_date FROM projects WHERE id = :i", i=project["id"])
        )[0]
        assert (prow.status, prow.due_date) == ("active", None)
        # tasks, through the whole workflow
        task = (
            await sql_env.client.post(
                "/api/v1/tasks",
                json={"projectId": project["id"], "title": "Ship", "priority": "urgent"},
                headers=me,
            )
        ).json()
        trow = (
            await db.run(
                "SELECT status, priority, priority_rank, completed_at FROM tasks WHERE id = :i",
                i=task["id"],
            )
        )[0]
        assert (trow.status, trow.priority, trow.priority_rank, trow.completed_at) == (
            "todo",
            "urgent",
            4,
            None,
        )
        for step in ("in_progress", "in_review", "done"):
            await sql_env.client.patch(
                f"/api/v1/tasks/{task['id']}/status", json={"status": step}, headers=me
            )
        trow = (await db.run("SELECT status, completed_at FROM tasks WHERE id = :i", i=task["id"]))[
            0
        ]
        assert trow.status == "done"
        assert trow.completed_at == NOW  # set from the injected clock, not the database's (BR-307)
        assert (await db.run("SELECT count(*) AS n FROM activity"))[
            0
        ].n == 5  # project and task created, then three status changes
        # deletes, in dependency order
        assert (
            await sql_env.client.delete(f"/api/v1/tasks/{task['id']}", headers=me)
        ).status_code == 204
        assert (await db.run("SELECT count(*) AS n FROM tasks"))[0].n == 0
        assert (
            await sql_env.client.delete(f"/api/v1/projects/{project['id']}", headers=me)
        ).status_code == 204
        assert (await db.run("SELECT count(*) AS n FROM projects"))[0].n == 0
        assert (
            await sql_env.client.delete(f"/api/v1/users/{user_id}", headers=sql_env.auth(LEAD))
        ).status_code == 204
        assert (await db.run("SELECT count(*) AS n FROM users WHERE id = :i", i=user_id))[0].n == 0
        assert await orphan_count(db) == 0
    finally:
        await db.engine.dispose()


@pytest.mark.sql
async def test_tc397_every_profile_loads_and_leaves_no_orphans(
    postgres: Postgres, clean: str
) -> None:
    db = Db(postgres.engine("admin", clean))
    try:
        for profile in ("empty", "default", "large"):
            await sql_support.empty_tables(postgres, clean)
            container = build_container(
                make_settings(
                    storage_backend="sql", database_url=SecretStr(postgres.url("app", clean))
                ),
                FakeClock(),
            )
            try:
                result = await seed(container, profile, PASSWORD)
            finally:
                await container.close()
            shape = SHAPES[profile]
            assert (result.users, result.projects, result.tasks) == (
                4 + shape.extra_users,
                shape.projects,
                shape.tasks,
            )
            assert await orphan_count(db) == 0, profile
    finally:
        await db.engine.dispose()


@pytest.mark.sql
async def test_fr321_the_seed_command_refuses_production_and_an_unconfirmed_reset(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from app.seed.__main__ import main

    monkeypatch.chdir("/")
    monkeypatch.setenv("SECRET_KEY", "k" * 40)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("STORAGE_BACKEND", "sql")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://ih_app:<set-me>@db:5432/x?ssl=require")
    assert await main("default", False, False) == 1
    assert "APP_ENV=production" in capsys.readouterr().err
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://ih_app:<set-me>@db:5432/x")
    assert await main("default", True, False) == 1  # --reset without --yes
    assert "--yes" in capsys.readouterr().err


@pytest.mark.sql
def test_tc380_the_committed_erd_and_dictionary_match_the_migrated_schema(
    postgres: Postgres, worker_db: str
) -> None:
    schema = sql_support.run_coro(generate_db_docs.read_schema(postgres.url("migrator", worker_db)))
    assert (ROOT / "database/docs/erd.mmd").read_text() == generate_db_docs.render_erd(schema)
    assert (
        ROOT / "database/docs/data-dictionary.md"
    ).read_text() == generate_db_docs.render_dictionary(schema)


@pytest.mark.sql
async def test_tc301_data_written_through_the_api_is_read_back_through_a_new_engine(
    sql_env: Env, postgres: Postgres, clean: str
) -> None:
    """The persistence half of TC-301, TC-304 and TC-306; restarts are in the resilience tests."""
    project = (
        await sql_env.client.post(
            "/api/v1/projects", json={"name": "Kept"}, headers=sql_env.auth(DEV)
        )
    ).json()
    task = (
        await sql_env.client.post(
            "/api/v1/tasks",
            json={"projectId": project["id"], "title": "Kept too"},
            headers=sql_env.auth(DEV),
        )
    ).json()
    fresh = build_container(
        make_settings(storage_backend="sql", database_url=SecretStr(postgres.url("app", clean))),
        FakeClock(),
    )
    try:
        async with fresh.uow() as uow:
            stored = await uow.tasks.get(UUID(task["id"]))
            activity = await uow.activity.list(ActivityQuery())
    finally:
        await fresh.close()
    assert stored is not None
    assert stored.title == "Kept too"
    assert activity.total == 2  # the project and the task were both logged
