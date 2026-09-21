"""TC-313, TC-360 to TC-362, TC-398, NFR-309: errors, outages, restarts, pool and slow queries."""

import asyncio
import json
import logging
import time
from typing import Any

import pytest
from pydantic import SecretStr
from sqlalchemy.exc import DBAPIError, InterfaceError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app.core.errors import (
    EmailAlreadyExists,
    ProjectNotEmpty,
    ServiceUnavailable,
    UserOwnsProjects,
    ValidationFailed,
)
from app.core.logging import LOGGER_NAME, JsonFormatter
from app.repositories.base import TransientStoreError
from app.repositories.sql.errors import translate
from tests import sql_support
from tests.conftest import DEV, LEAD, Env, build_env, error_code, make_project, make_task
from tests.sql_support import Server


class Driver(Exception):
    """A stand-in for the asyncpg exception: what the translator reads is its SQLSTATE and name."""

    def __init__(self, sqlstate: str, constraint_name: str | None = None) -> None:
        super().__init__("driver text that must never reach a client: SELECT secret FROM users")
        self.sqlstate = sqlstate
        self.constraint_name = constraint_name


def failure(sqlstate: str, name: str | None = None) -> DBAPIError:
    wrapper = Exception("adapter")
    wrapper.__cause__ = Driver(sqlstate, name)
    return DBAPIError("INSERT INTO t VALUES (:x)", {"x": "secret value"}, wrapper)


@pytest.mark.parametrize(
    ("state", "name", "operation", "expected"),
    [
        ("23505", "uq_users_email", "insert", EmailAlreadyExists),
        ("23503", "fk_tasks_project_id_projects", "delete", ProjectNotEmpty),
        ("23503", "fk_projects_owner_id_users", "delete", UserOwnsProjects),
        ("23503", "fk_tasks_project_id_projects", "insert", ValidationFailed),
        ("23503", "fk_tasks_assignee_id_users", "update", ValidationFailed),
        ("23514", "ck_tasks_title_length", "insert", ValidationFailed),
        ("40P01", None, "update", TransientStoreError),
        ("55P03", None, "update", TransientStoreError),
        ("57014", None, "read", TransientStoreError),
        ("08006", None, "read", ServiceUnavailable),
        ("53300", None, "read", ServiceUnavailable),
        ("57P01", None, "read", ServiceUnavailable),
    ],
)
def test_tc313_every_row_of_the_translation_table(
    state: str, name: str | None, operation: Any, expected: type[Exception]
) -> None:
    mapped = translate(failure(state, name), operation)
    assert isinstance(mapped, expected)
    assert "SELECT" not in str(mapped)
    assert "secret" not in str(mapped)


def test_tc313_fields_are_named_for_a_missing_reference() -> None:
    project = translate(failure("23503", "fk_tasks_project_id_projects"), "insert")
    assignee = translate(failure("23503", "fk_tasks_assignee_id_users"), "insert")
    assert isinstance(project, ValidationFailed)
    assert isinstance(assignee, ValidationFailed)
    assert [d.field for d in project.details or []] == ["projectId"]
    assert [d.field for d in assignee.details or []] == ["assigneeId"]


def test_tc313_connection_failures_and_unknown_errors() -> None:
    assert isinstance(translate(ConnectionRefusedError(), "read"), ServiceUnavailable)
    assert isinstance(translate(TimeoutError(), "read"), ServiceUnavailable)
    assert isinstance(translate(PoolTimeoutError("pool"), "read"), ServiceUnavailable)
    assert isinstance(translate(InterfaceError("x", {}, Exception()), "read"), ServiceUnavailable)
    assert translate(failure("42P01"), "read") is None  # anything else stays a generic 500
    assert translate(ValueError("not a database error"), "read") is None


@pytest.mark.sql
async def test_tc313_a_check_violation_reaches_a_client_as_422_without_internals(
    sql_env: Env,
) -> None:
    """Skip application validation on purpose, so the database is the one that refuses."""
    project = await make_project(sql_env, DEV)
    from app.repositories.sql.tasks import SqlTaskRepository

    original = SqlTaskRepository.add

    async def with_blank_title(self: SqlTaskRepository, task: Any) -> Any:
        from dataclasses import replace

        return await original(self, replace(task, title=""))

    SqlTaskRepository.add = with_blank_title  # type: ignore[method-assign]  # a forced fault
    try:
        response = await sql_env.client.post(
            "/api/v1/tasks",
            json={"projectId": project["id"], "title": "fine"},
            headers=sql_env.auth(DEV),
        )
    finally:
        SqlTaskRepository.add = original  # type: ignore[method-assign]  # restore
    assert response.status_code == 422
    assert error_code(response) == "VALIDATION_ERROR"
    for leaked in ("ck_", "tasks", "INSERT", "asyncpg", "postgres"):
        assert leaked not in response.text


@pytest.mark.sql
async def test_tc322_foreign_key_and_restrict_rules_surface_as_the_documented_codes(
    sql_env: Env,
) -> None:
    project = await make_project(sql_env, DEV)
    await make_task(sql_env, project["id"])
    blocked = await sql_env.client.delete(
        f"/api/v1/projects/{project['id']}", headers=sql_env.auth(DEV)
    )
    assert (blocked.status_code, error_code(blocked)) == (409, "PROJECT_NOT_EMPTY")
    me = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(DEV))).json()
    owner = await sql_env.client.delete(f"/api/v1/users/{me['id']}", headers=sql_env.auth(LEAD))
    assert (owner.status_code, error_code(owner)) == (409, "USER_OWNS_PROJECTS")


@pytest.mark.sql
async def test_tc308_activity_and_cascade_survive_task_and_project_deletion(sql_env: Env) -> None:
    project = await make_project(sql_env, DEV)
    task = await make_task(sql_env, project["id"])
    await sql_env.client.delete(f"/api/v1/tasks/{task['id']}", headers=sql_env.auth(DEV))
    feed = (await sql_env.client.get("/api/v1/activity", headers=sql_env.auth(DEV))).json()
    entry = next(
        item
        for item in feed["items"]
        if item["type"] == "created"
        and item["projectId"] == project["id"]
        and item["taskId"] is None
    )
    assert entry  # the entry stays and its task reference is empty (set null)
    await sql_env.client.delete(f"/api/v1/projects/{project['id']}", headers=sql_env.auth(DEV))
    feed = (await sql_env.client.get("/api/v1/activity", headers=sql_env.auth(DEV))).json()
    assert all(item["projectId"] != project["id"] for item in feed["items"])  # cascaded away


@pytest.mark.sql
async def test_tc362_no_connection_is_left_checked_out_after_load(sql_env: Env) -> None:
    project = await make_project(sql_env, DEV)
    await asyncio.gather(
        *(sql_env.client.get("/api/v1/tasks", headers=sql_env.auth(DEV)) for _ in range(80)),
        *(
            sql_env.client.post(
                "/api/v1/tasks",
                json={"projectId": project["id"], "title": f"t{n}"},
                headers=sql_env.auth(DEV),
            )
            for n in range(30)
        ),
        *(
            sql_env.client.get("/api/v1/tasks/not-a-uuid", headers=sql_env.auth(DEV))
            for _ in range(10)
        ),
    )
    assert sql_env.container.database is not None
    assert sql_env.container.database.checked_out() == 0


@pytest.mark.sql
async def test_tc361_readiness_is_a_real_query(sql_env: Env) -> None:
    assert (await sql_env.client.get("/readyz")).status_code == 200


@pytest.mark.sql
async def test_tc398_a_slow_query_is_logged_with_a_fingerprint_and_no_values(
    sql_env: Env,
) -> None:
    from sqlalchemy import text

    class Capture(logging.Handler):
        def __init__(self) -> None:
            super().__init__()
            self.lines: list[str] = []

        def emit(self, record: logging.LogRecord) -> None:
            self.lines.append(self.format(record))

    capture = Capture()
    capture.setFormatter(JsonFormatter())
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    logger.addHandler(capture)
    assert sql_env.container.database is not None
    sql_env.container.database._slow_ms = 50
    try:
        async with sql_env.container.database.engine.connect() as connection:
            await connection.execute(text("SELECT pg_sleep(0.15), 'hunter2-value' AS secret"))
    finally:
        logger.removeHandler(capture)
    slow = [json.loads(line) for line in capture.lines if "slow query" in line]
    assert slow, "the slow query was not logged"
    assert len(slow[0]["fingerprint"]) == 12
    assert slow[0]["durationMs"] >= 100
    assert "hunter2" not in "".join(capture.lines)


@pytest.mark.sql
@pytest.mark.slow
async def test_tc360_outage_gives_503_then_recovers_without_a_restart(
    dedicated: Server,
) -> None:
    postgres = dedicated.postgres
    await sql_support.empty_tables(postgres, sql_support.TEMPLATE)
    async for env in build_env(
        "empty",
        storage_backend="sql",
        database_url=SecretStr(postgres.url("app", sql_support.TEMPLATE)),
    ):
        # build_env seeded through `empty_tables`-less path, so the accounts exist and can log in.
        assert (await env.client.get("/readyz")).status_code == 200
        dedicated.pause()
        try:
            started = time.monotonic()
            ready = await env.client.get("/readyz")
            ready_seconds = time.monotonic() - started
            started = time.monotonic()
            projects = await env.client.get("/api/v1/projects", headers=env.auth(LEAD))
            elapsed = time.monotonic() - started
            assert ready_seconds < 5, f"/readyz took {ready_seconds:.1f}s"
            assert ready.status_code == 503
            assert error_code(ready) == "SERVICE_UNAVAILABLE"
            assert projects.status_code == 503
            assert error_code(projects) == "SERVICE_UNAVAILABLE"
            assert elapsed < 5.5, f"the outage took {elapsed:.1f}s to report"  # NFR-312
            for leaked in ("postgres", "asyncpg", "sqlalchemy", "ih_app", "SELECT"):
                assert leaked not in projects.text
        finally:
            dedicated.unpause()
        deadline = time.monotonic() + 30
        while True:  # NFR-312: back within 30 s of the database returning, with no restart
            response = await env.client.get("/api/v1/projects", headers=env.auth(LEAD))
            if response.status_code == 200:
                break
            assert time.monotonic() < deadline, "the API did not recover"
            await asyncio.sleep(0.5)


@pytest.mark.sql
@pytest.mark.slow
async def test_nfr309_data_survives_an_api_restart_and_a_database_restart(
    dedicated: Server,
) -> None:
    def settings_for(server: Server) -> dict[str, Any]:
        return {
            "storage_backend": "sql",
            "database_url": SecretStr(server.postgres.url("app", sql_support.TEMPLATE)),
        }

    created: dict[str, str] = {}
    await sql_support.empty_tables(dedicated.postgres, sql_support.TEMPLATE)
    async for env in build_env("empty", **settings_for(dedicated)):
        project = await make_project(env, DEV, name="Durable")
        task = await make_task(env, project["id"], title="Still here", priority="urgent")
        created = {"project": project["id"], "task": task["id"]}
    # the API restarts: a brand new app, engine and pool, on the same database
    async for env in build_env(None, **settings_for(dedicated)):
        login = await env.login(DEV)
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        again = await env.client.get(f"/api/v1/tasks/{created['task']}", headers=headers)
        assert again.status_code == 200
        assert again.json()["title"] == "Still here"
    # the database restarts too
    dedicated.restart()
    async for env in build_env(None, **settings_for(dedicated)):
        login = await env.login(DEV)
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        project_again = await env.client.get(
            f"/api/v1/projects/{created['project']}", headers=headers
        )
        assert project_again.status_code == 200
        assert project_again.json()["progress"]["totalTasks"] == 1
