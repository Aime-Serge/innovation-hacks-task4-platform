"""TC-303, TC-305, TC-307, TC-320 to TC-324: the database rejects bad data, whoever writes it.

Every statement runs as the application role with raw SQL, so this proves that even the API's own
account cannot store an invalid row (TH-307). The matrix at the top is checked against the live
catalogue, so a constraint added without a bypass test fails NFR-307.
"""

from typing import Any
from uuid import uuid4

import pytest

from tests.db.conftest import Db

UNIQUE, FK, CHECK, NOT_NULL = "23505", "23503", "23514", "23502"
LONG = "x" * 81
UUID_1 = "11111111-1111-1111-1111-111111111111"

USER = (
    "INSERT INTO users (id, name, email, password_hash, role, avatar_url, theme) "
    "VALUES (gen_random_uuid(), :name, :email, :hash, :role, :avatar, :theme)"
)
GOOD_USER: dict[str, Any] = {
    "name": "Ada",
    "email": "ada@example.com",
    "hash": "h",
    "role": "developer",
    "avatar": None,
    "theme": "system",
}
PROJECT = (
    "INSERT INTO projects (id, name, description, status, owner_id) "
    "VALUES (gen_random_uuid(), :name, :description, :status, :owner)"
)
TASK = (
    "INSERT INTO tasks (id, project_id, title, description, status, priority, completed_at) "
    "VALUES (gen_random_uuid(), :project, :title, :description, :status, :priority, :completed)"
)

# (id, statement, overrides of a valid row, expected constraint) for every ck_ constraint.
USER_CASES = [
    ("name empty", {"name": ""}, "ck_users_name_length"),
    ("name 81 chars", {"name": LONG}, "ck_users_name_length"),
    ("name untrimmed", {"name": " Ada"}, "ck_users_name_length"),
    ("email uppercase", {"email": "Ada@Example.com"}, "ck_users_email_format"),
    ("email no at", {"email": "ada.example.com"}, "ck_users_email_format"),
    ("email too long", {"email": "a" * 250 + "@x.io"}, "ck_users_email_format"),
    ("hash empty", {"hash": ""}, "ck_users_password_hash_present"),
    ("role unknown", {"role": "admin"}, "ck_users_role"),
    ("avatar http", {"avatar": "http://example.com/a.png"}, "ck_users_avatar_url"),
    ("avatar too long", {"avatar": "https://e.io/" + "a" * 2050}, "ck_users_avatar_url"),
    ("theme unknown", {"theme": "blue"}, "ck_users_theme"),
]
PROJECT_CASES = [
    ("name empty", {"name": ""}, "ck_projects_name_length"),
    ("name 81 chars", {"name": LONG}, "ck_projects_name_length"),
    ("description 2001", {"description": "d" * 2001}, "ck_projects_description_length"),
    ("status unknown", {"status": "archived"}, "ck_projects_status"),
]
TASK_CASES = [
    ("title empty", {"title": ""}, "ck_tasks_title_length"),
    ("title 121 chars", {"title": "t" * 121}, "ck_tasks_title_length"),
    ("description 4001", {"description": "d" * 4001}, "ck_tasks_description_length"),
    ("status unknown", {"status": "blocked"}, "ck_tasks_status"),
    ("priority critical", {"priority": "critical"}, "ck_tasks_priority"),
    ("done without completed_at", {"status": "done"}, "ck_tasks_completed_consistency"),
    (
        "completed_at on a todo task",
        {"completed": "2026-09-20T12:00:00+00:00"},
        "ck_tasks_completed_consistency",
    ),
]


NOT_NULL_INSERTS = {
    "name": "INSERT INTO users (id, name) VALUES (gen_random_uuid(), NULL)",
    "email": "INSERT INTO users (id, name, email) VALUES (gen_random_uuid(), 'A', NULL)",
    "password_hash": "INSERT INTO users (id, name, email, password_hash) "
    "VALUES (gen_random_uuid(), 'A', 'a@b.c', NULL)",
    "role": "INSERT INTO users (id, name, email, password_hash, role) "
    "VALUES (gen_random_uuid(), 'A', 'a@b.c', 'h', NULL)",
    "theme": "INSERT INTO users (id, name, email, password_hash, theme) "
    "VALUES (gen_random_uuid(), 'A', 'a@b.c', 'h', NULL)",
}


async def _expect(db: Db, statement: str, params: dict[str, Any], name: str, state: str) -> None:
    got_state, got_name = await db.rejected(statement, **params)
    assert (got_state, got_name) == (state, name)


@pytest.mark.sql
@pytest.mark.parametrize(("label", "change", "name"), USER_CASES, ids=[c[0] for c in USER_CASES])
async def test_tc303_user_constraints_reject_direct_sql(
    app_db: Db, label: str, change: dict[str, Any], name: str
) -> None:
    await _expect(app_db, USER, GOOD_USER | change, name, CHECK)


@pytest.mark.sql
async def test_tc303_email_unique_ignoring_case_and_not_nulls(app_db: Db) -> None:
    await app_db.run(USER, **GOOD_USER)
    await _expect(app_db, USER, GOOD_USER, "uq_users_email", UNIQUE)  # FR-307
    # Upper case cannot even be stored, so the two spellings can never both exist.
    await _expect(
        app_db, USER, GOOD_USER | {"email": "ADA@example.com"}, "ck_users_email_format", CHECK
    )
    for column, statement in NOT_NULL_INSERTS.items():
        state, _ = await app_db.rejected(statement)
        assert state == NOT_NULL, column


@pytest.mark.sql
@pytest.mark.parametrize(
    ("label", "change", "name"), PROJECT_CASES, ids=[c[0] for c in PROJECT_CASES]
)
async def test_tc305_project_constraints_reject_direct_sql(
    app_db: Db, label: str, change: dict[str, Any], name: str
) -> None:
    owner = await app_db.user()
    good = {"name": "Atlas", "description": "", "status": "active", "owner": owner}
    await _expect(app_db, PROJECT, good | change, name, CHECK)


@pytest.mark.sql
@pytest.mark.parametrize(("label", "change", "name"), TASK_CASES, ids=[c[0] for c in TASK_CASES])
async def test_tc307_task_constraints_reject_direct_sql(
    app_db: Db, label: str, change: dict[str, Any], name: str
) -> None:
    project = await app_db.project(await app_db.user())
    good = {
        "project": project,
        "title": "Write",
        "description": "",
        "status": "todo",
        "priority": "medium",
        "completed": None,
    }
    if "completed" in change:
        change = {**change, "completed": _as_datetime(change["completed"])}
    await _expect(app_db, TASK, good | change, name, CHECK)


def _as_datetime(value: str) -> Any:
    from datetime import datetime

    return datetime.fromisoformat(value)


@pytest.mark.sql
async def test_tc307_task_may_be_done_only_with_completed_at(app_db: Db) -> None:
    project = await app_db.project(await app_db.user())
    when = _as_datetime("2026-09-20T12:00:00+00:00")
    await app_db.task(project, status="done", completed=when)  # accepted: consistent
    await app_db.task(project, status="in_review")  # accepted: no completion time


@pytest.mark.sql
async def test_tc307_activity_type_is_constrained(app_db: Db) -> None:
    actor = await app_db.user()
    project = await app_db.project(actor)
    statement = (
        "INSERT INTO activity (id, actor_id, project_id, type) "
        "VALUES (gen_random_uuid(), :actor, :project, :type)"
    )
    params = {"actor": actor, "project": project, "type": "deleted"}
    await _expect(app_db, statement, params, "ck_activity_type", CHECK)


@pytest.mark.sql
async def test_tc320_every_foreign_key_rejects_an_orphan(app_db: Db) -> None:
    ghost = uuid4()
    owner = await app_db.user()
    project = await app_db.project(owner)
    task = await app_db.task(project)
    cases: list[tuple[str, dict[str, Any], str]] = [
        (
            PROJECT,
            {"name": "P", "description": "", "status": "active", "owner": ghost},
            "fk_projects_owner_id_users",
        ),
        (
            TASK,
            {
                "project": ghost,
                "title": "T",
                "description": "",
                "status": "todo",
                "priority": "low",
                "completed": None,
            },
            "fk_tasks_project_id_projects",
        ),
        (
            "INSERT INTO tasks (id, project_id, title, assignee_id) "
            "VALUES (gen_random_uuid(), :project, 'T', :ghost)",
            {"project": project, "ghost": ghost},
            "fk_tasks_assignee_id_users",
        ),
        (
            "INSERT INTO activity (id, actor_id, project_id, type) "
            "VALUES (gen_random_uuid(), :ghost, :project, 'created')",
            {"project": project, "ghost": ghost},
            "fk_activity_actor_id_users",
        ),
        (
            "INSERT INTO activity (id, actor_id, project_id, type) "
            "VALUES (gen_random_uuid(), :owner, :ghost, 'created')",
            {"owner": owner, "ghost": ghost},
            "fk_activity_project_id_projects",
        ),
        (
            "INSERT INTO activity (id, actor_id, project_id, task_id, type) "
            "VALUES (gen_random_uuid(), :owner, :project, :ghost, 'created')",
            {"owner": owner, "project": project, "ghost": ghost},
            "fk_activity_task_id_tasks",
        ),
    ]
    for statement, params, name in cases:
        await _expect(app_db, statement, params, name, FK)
    assert task  # the valid rows above were accepted


@pytest.mark.sql
async def test_tc321_all_six_delete_actions(app_db: Db) -> None:
    owner = await app_db.user()
    other = await app_db.user()
    project = await app_db.project(owner)
    task = await app_db.task(project, assignee=other)
    await app_db.activity(other, project, task)

    # projects.owner_id and tasks.project_id: RESTRICT
    assert (await app_db.rejected("DELETE FROM users WHERE id = :id", id=owner))[1] == (
        "fk_projects_owner_id_users"
    )
    assert (await app_db.rejected("DELETE FROM projects WHERE id = :id", id=project))[1] == (
        "fk_tasks_project_id_projects"
    )
    # activity.task_id: SET NULL (the entry stays)
    await app_db.run("DELETE FROM tasks WHERE id = :id", id=task)
    rows = await app_db.run("SELECT task_id FROM activity")
    assert [r.task_id for r in rows] == [None]
    # tasks.assignee_id: SET NULL
    second = await app_db.task(project, assignee=other)
    await app_db.run("DELETE FROM users WHERE id = :id", id=other)  # cascades its activity too
    assigned = await app_db.run("SELECT assignee_id FROM tasks WHERE id = :id", id=second)
    assert assigned[0].assignee_id is None
    # activity.actor_id: CASCADE
    assert await app_db.run("SELECT count(*) AS n FROM activity") == [(0,)]
    # activity.project_id: CASCADE
    await app_db.run("DELETE FROM tasks")
    await app_db.activity(owner, project)
    await app_db.run("DELETE FROM projects WHERE id = :id", id=project)
    assert await app_db.run("SELECT count(*) AS n FROM activity") == [(0,)]


@pytest.mark.sql
async def test_tc324_no_orphans_after_the_scenario(admin_db: Db) -> None:
    owner = await admin_db.user()
    project = await admin_db.project(owner)
    await admin_db.task(project, assignee=owner)
    assert await orphan_count(admin_db) == 0


async def orphan_count(db: Db) -> int:
    """The orphan scan (NFR-306): rows whose parent is missing. Zero, always."""
    rows = await db.run(
        "SELECT "
        "(SELECT count(*) FROM projects p "
        "LEFT JOIN users u ON u.id = p.owner_id WHERE u.id IS NULL)"
        " + (SELECT count(*) FROM tasks t LEFT JOIN projects p ON p.id = t.project_id "
        "WHERE p.id IS NULL)"
        " + (SELECT count(*) FROM tasks t WHERE t.assignee_id IS NOT NULL AND NOT EXISTS "
        "(SELECT 1 FROM users u WHERE u.id = t.assignee_id))"
        " + (SELECT count(*) FROM activity a WHERE NOT EXISTS "
        "(SELECT 1 FROM users u WHERE u.id = a.actor_id))"
        " + (SELECT count(*) FROM activity a WHERE NOT EXISTS "
        "(SELECT 1 FROM projects p WHERE p.id = a.project_id))"
        " + (SELECT count(*) FROM activity a WHERE a.task_id IS NOT NULL AND NOT EXISTS "
        "(SELECT 1 FROM tasks t WHERE t.id = a.task_id)) AS n"
    )
    return int(rows[0].n)


@pytest.mark.sql
async def test_nfr307_every_constraint_in_the_catalogue_has_a_bypass_test(admin_db: Db) -> None:
    """NFR-307: 100% of constraints. A constraint added without a case above fails here."""
    covered = (
        {name for *_, name in USER_CASES}
        | {name for *_, name in PROJECT_CASES}
        | {name for *_, name in TASK_CASES}
        | {
            "uq_users_email",
            "ck_activity_type",
            "fk_projects_owner_id_users",
            "fk_tasks_project_id_projects",
            "fk_tasks_assignee_id_users",
            "fk_activity_actor_id_users",
            "fk_activity_project_id_projects",
            "fk_activity_task_id_tasks",
        }
    )
    rows = await admin_db.run(
        "SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace "
        "WHERE n.nspname = 'public' AND c.contype IN ('c', 'u', 'f')"
    )
    assert {row.conname for row in rows} == covered
