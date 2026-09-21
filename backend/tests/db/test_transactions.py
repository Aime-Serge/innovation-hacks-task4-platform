"""TC-350 to TC-353, TC-302: atomic operations and races end in a valid state (FR-313, FR-314).

A forced failure part-way through an operation must leave nothing behind, and the races are repeated
200 times because a race that passes once proves nothing (NFR-313).
"""

import asyncio
from typing import Any

import pytest

from app.core.errors import EmailAlreadyExists
from tests.conftest import DEV, LEAD, OTHER, Env, error_code, make_project, make_task
from tests.db.conftest import Db

RUNS = 200


class Boom(Exception):
    pass


async def _count(env: Env, table: str) -> int:
    statements = {
        "tasks": "SELECT count(*) AS n FROM tasks",
        "projects": "SELECT count(*) AS n FROM projects",
        "activity": "SELECT count(*) AS n FROM activity",
    }
    db = Db(env.container.database.engine)  # type: ignore[union-attr]  # sql_env is always SQL
    return int((await db.run(statements[table]))[0].n)


async def _activity_of(env: Env, task_id: str) -> list[str]:
    db = Db(env.container.database.engine)  # type: ignore[union-attr]  # sql_env is always SQL
    rows = await db.run("SELECT type FROM activity WHERE task_id = :id ORDER BY at, id", id=task_id)
    return [row.type for row in rows]


def _fail_after_first_write(monkeypatch: pytest.MonkeyPatch, env: Env) -> None:
    async def explode(*_: Any, **__: Any) -> None:
        raise Boom

    monkeypatch.setattr(env.container.activity, "record", explode)


@pytest.mark.sql
async def test_tc350_task_create_and_its_activity_are_one_transaction(
    sql_env: Env, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = await make_project(sql_env, DEV)
    before = (await _count(sql_env, "tasks"), await _count(sql_env, "activity"))
    _fail_after_first_write(monkeypatch, sql_env)
    response = await sql_env.client.post(
        "/api/v1/tasks", json={"projectId": project["id"], "title": "X"}, headers=sql_env.auth(DEV)
    )
    assert response.status_code == 500
    assert (await _count(sql_env, "tasks"), await _count(sql_env, "activity")) == before


@pytest.mark.sql
async def test_tc350_project_create_and_its_activity_are_one_transaction(
    sql_env: Env, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fail_after_first_write(monkeypatch, sql_env)
    response = await sql_env.client.post(
        "/api/v1/projects", json={"name": "Ghost"}, headers=sql_env.auth(DEV)
    )
    assert response.status_code == 500
    assert await _count(sql_env, "projects") == 0


@pytest.mark.sql
async def test_tc350_status_change_and_its_activity_are_one_transaction(
    sql_env: Env, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = await make_project(sql_env, DEV)
    task = await make_task(sql_env, project["id"])
    _fail_after_first_write(monkeypatch, sql_env)
    response = await sql_env.client.patch(
        f"/api/v1/tasks/{task['id']}/status",
        json={"status": "in_progress"},
        headers=sql_env.auth(DEV),
    )
    assert response.status_code == 500
    unchanged = await sql_env.client.get(f"/api/v1/tasks/{task['id']}", headers=sql_env.auth(DEV))
    assert unchanged.json()["status"] == "todo"
    assert await _activity_of(sql_env, task["id"]) == ["created"]


@pytest.mark.sql
async def test_tc350_user_delete_unassigns_and_deletes_or_does_neither(
    sql_env: Env, monkeypatch: pytest.MonkeyPatch
) -> None:
    other = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(OTHER))).json()
    project = await make_project(sql_env, DEV)
    task = await make_task(sql_env, project["id"], assigneeId=other["id"])

    async def explode(*_: Any, **__: Any) -> bool:
        raise Boom

    from app.repositories.sql.users import SqlUserRepository

    monkeypatch.setattr(SqlUserRepository, "delete", explode)
    response = await sql_env.client.delete(
        f"/api/v1/users/{other['id']}", headers=sql_env.auth(LEAD)
    )
    assert response.status_code == 500
    after = await sql_env.client.get(f"/api/v1/tasks/{task['id']}", headers=sql_env.auth(DEV))
    assert after.json()["assigneeId"] == other["id"]  # the unassignment was rolled back
    still_there = await sql_env.client.get(
        f"/api/v1/users/{other['id']}", headers=sql_env.auth(DEV)
    )
    assert still_there.status_code == 200


@pytest.mark.sql
@pytest.mark.slow
async def test_tc351_two_simultaneous_status_changes_record_one_change(sql_env: Env) -> None:
    project = await make_project(sql_env, DEV)
    for run in range(RUNS):
        task = await make_task(sql_env, project["id"], title=f"race {run}")
        url = f"/api/v1/tasks/{task['id']}/status"
        first, second = await asyncio.gather(
            sql_env.client.patch(url, json={"status": "in_progress"}, headers=sql_env.auth(DEV)),
            sql_env.client.patch(url, json={"status": "in_progress"}, headers=sql_env.auth(LEAD)),
        )
        assert (first.status_code, second.status_code) == (200, 200)
        # Without the row lock both would read "todo" and both would log a change.
        assert sorted(await _activity_of(sql_env, task["id"])) == [
            "created",
            "status_changed",
        ], run


@pytest.mark.sql
@pytest.mark.slow
async def test_tc352_two_leads_cannot_demote_each_other_to_none(sql_env: Env) -> None:
    lead_a = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(LEAD))).json()
    other = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(OTHER))).json()
    db = Db(sql_env.container.database.engine)  # type: ignore[union-attr]  # SQL env
    for run in range(RUNS):
        await db.run(
            "UPDATE users SET role = 'lead' WHERE id IN (:a, :b)", a=lead_a["id"], b=other["id"]
        )
        demote_b = sql_env.client.patch(
            f"/api/v1/users/{other['id']}", json={"role": "developer"}, headers=sql_env.auth(LEAD)
        )
        demote_a = sql_env.client.patch(
            f"/api/v1/users/{lead_a['id']}", json={"role": "developer"}, headers=sql_env.auth(OTHER)
        )
        first, second = await asyncio.gather(demote_b, demote_a)
        leads = (await db.run("SELECT count(*) AS n FROM users WHERE role = 'lead'"))[0].n
        assert leads >= 1, f"run {run}: no lead is left"
        # One demotion wins. The other is refused by the last-lead rule (409), or by the role check
        # (403) when the winner had already demoted the caller before its request was read.
        assert sorted((first.status_code, second.status_code)) in ([200, 403], [200, 409]), run


@pytest.mark.sql
@pytest.mark.slow
async def test_tc352_two_leads_cannot_delete_each_other(sql_env: Env) -> None:
    db = Db(sql_env.container.database.engine)  # type: ignore[union-attr]  # SQL env
    lead_a = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(LEAD))).json()
    other = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(OTHER))).json()
    await db.run("UPDATE users SET role = 'lead' WHERE id = :id", id=other["id"])
    saved = await db.run(
        "SELECT id, name, email, password_hash, created_at, updated_at FROM users "
        "WHERE id IN (:a, :b)",
        a=lead_a["id"],
        b=other["id"],
    )
    for run in range(RUNS):
        first, second = await asyncio.gather(
            sql_env.client.delete(f"/api/v1/users/{other['id']}", headers=sql_env.auth(LEAD)),
            sql_env.client.delete(f"/api/v1/users/{lead_a['id']}", headers=sql_env.auth(OTHER)),
        )
        leads = (await db.run("SELECT count(*) AS n FROM users WHERE role = 'lead'"))[0].n
        assert leads >= 1, f"run {run}: no lead is left"
        # One deletion wins. The other is refused by the last-lead rule, or by authentication
        # when the winner had already removed the caller's account.
        assert sorted((first.status_code, second.status_code)) in ([204, 401], [204, 409]), run
        for row in saved:  # put both accounts back as leads for the next round
            await db.run(
                "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) "
                "VALUES (:id, :name, :email, :hash, 'lead', :created, :updated) "
                "ON CONFLICT (id) DO UPDATE SET role = 'lead'",
                id=row.id,
                name=row.name,
                email=row.email,
                hash=row.password_hash,
                created=row.created_at,
                updated=row.updated_at,
            )


@pytest.mark.sql
@pytest.mark.slow
async def test_tc353_task_creation_racing_project_deletion_stays_valid(sql_env: Env) -> None:
    for run in range(RUNS):
        project = await make_project(sql_env, DEV, name=f"P{run}")
        deletion, creation = await asyncio.gather(
            sql_env.client.delete(f"/api/v1/projects/{project['id']}", headers=sql_env.auth(DEV)),
            sql_env.client.post(
                "/api/v1/tasks",
                json={"projectId": project["id"], "title": "racing"},
                headers=sql_env.auth(DEV),
            ),
        )
        outcome = (deletion.status_code, creation.status_code)
        assert outcome in ((204, 422), (409, 201)), (run, outcome)
        if outcome == (409, 201):
            assert error_code(deletion) == "PROJECT_NOT_EMPTY"
    db = Db(sql_env.container.database.engine)  # type: ignore[union-attr]  # SQL env
    orphans = await db.run(
        "SELECT count(*) AS n FROM tasks t "
        "WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id)"
    )
    assert orphans[0].n == 0


@pytest.mark.sql
async def test_tc302_twenty_simultaneous_registrations_of_one_email_create_one_account(
    sql_env: Env,
) -> None:
    body = {"name": "Ada", "email": "race@example.com", "password": "correct-horse-battery"}
    responses = await asyncio.gather(
        *(sql_env.client.post("/api/v1/users", json=body) for _ in range(20))
    )
    codes = sorted(r.status_code for r in responses)
    assert codes == [201] + [409] * 19
    assert {error_code(r) for r in responses if r.status_code == 409} == {EmailAlreadyExists.code}
