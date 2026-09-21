"""TC-391, TC-392, TC-397: query plans, query counts and seed profiles on the `xl` data set.

The xl profile is 200 users, 1,000 projects, 20,000 tasks and 60,000 activity items (NFR-301). The
plans are read with EXPLAIN after ANALYZE, on real data, so an index that the planner ignores
shows up as a sequential scan.
"""

import json
from typing import Any

import pytest
from pydantic import SecretStr
from sqlalchemy import event, text

from app.container import build_container
from app.seed import SHAPES, seed
from tests import sql_support
from tests.conftest import PASSWORD, FakeClock, make_settings
from tests.db.conftest import Db
from tests.db.test_integrity import orphan_count
from tests.sql_support import Postgres

XL_DB = "ih_xl"


async def _load_xl(postgres: Postgres) -> None:
    await sql_support.clone_database(postgres, XL_DB)
    container = build_container(
        make_settings(storage_backend="sql", database_url=SecretStr(postgres.url("app", XL_DB))),
        FakeClock(),
    )
    try:
        await seed(container, "xl", PASSWORD)
    finally:
        await container.close()
    await postgres.run("admin", XL_DB, "ANALYZE")


@pytest.fixture(scope="module")
def xl(postgres: Postgres) -> None:
    """The xl data set, loaded once for this module (it takes a few seconds)."""
    sql_support.run_coro(_load_xl(postgres))


def plan_nodes(plan: dict[str, Any]) -> list[dict[str, Any]]:
    found = [plan]
    for child in plan.get("Plans", []):
        found += plan_nodes(child)
    return found


async def explain(
    postgres: Postgres, sql: str, *, prefer_index: bool = False, **params: Any
) -> list[dict[str, Any]]:
    """The plan for a statement. `prefer_index` forbids a sequential scan, to prove an index *can*
    answer the query on a table so small that the planner is right to scan it."""
    db = Db(postgres.engine("admin", XL_DB))
    try:
        async with db.engine.connect() as connection:
            if prefer_index:
                await connection.execute(text("SET enable_seqscan = off"))
            result = await connection.execute(text(f"EXPLAIN (FORMAT JSON) {sql}"), params)
            document = result.scalar_one()
    finally:
        await db.engine.dispose()
    tree = document if isinstance(document, list) else json.loads(document)
    return plan_nodes(tree[0]["Plan"])


@pytest.mark.sql
@pytest.mark.slow
async def test_tc397_the_xl_profile_has_the_promised_size_and_no_orphans(
    xl: None, postgres: Postgres
) -> None:
    db = Db(postgres.engine("admin", XL_DB))
    try:
        counts = {
            table: (await db.run(f"SELECT count(*) AS n FROM {table}"))[0].n  # noqa: S608
            for table in ("users", "projects", "tasks", "activity")
        }
        shape = SHAPES["xl"]
        assert counts == {
            "users": 4 + shape.extra_users,
            "projects": shape.projects,
            "tasks": shape.tasks,
            "activity": shape.activity,
        }
        assert await orphan_count(db) == 0
    finally:
        await db.engine.dispose()


@pytest.mark.sql
@pytest.mark.slow
@pytest.mark.parametrize(
    ("label", "where"),
    [
        (
            "by project",
            "WHERE project_id = (SELECT id FROM projects ORDER BY id LIMIT 1 OFFSET 40)",
        ),
        ("by assignee", "WHERE assignee_id = (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 30)"),
        (
            "by project and status",
            "WHERE project_id = (SELECT id FROM projects OFFSET 7 LIMIT 1) AND status = 'todo'",
        ),
        (
            "overdue",
            "WHERE status <> 'done' AND due_date < current_date - 7 "
            "AND due_date > current_date - 9",
        ),
        ("search", "WHERE title ILIKE '%Migrate audit log (Grove 12)%'"),
    ],
)
async def test_tc391_selective_task_filters_never_scan_the_whole_table(
    xl: None, postgres: Postgres, label: str, where: str
) -> None:
    nodes = await explain(postgres, f"SELECT id FROM tasks {where}", prefer_index=label == "search")  # noqa: S608
    scans = [n for n in nodes if n["Node Type"] == "Seq Scan" and n.get("Relation Name") == "tasks"]
    kinds = [(n["Node Type"], n.get("Index Name")) for n in nodes]
    assert scans == [], f"{label}: sequential scan of tasks: {kinds}"
    if label == "search":
        # 20,000 rows fit in a few hundred pages, so the planner rightly scans them. With the scan
        # forbidden it must reach for the trigram index, which proves the index serves the query.
        assert any(n.get("Index Name") == "ix_tasks_title_trgm" for n in nodes)


@pytest.mark.sql
@pytest.mark.slow
@pytest.mark.parametrize(
    ("sort", "index"),
    [
        ("ORDER BY priority_rank DESC, id LIMIT 20", "ix_tasks_priority_rank_id"),
        ("ORDER BY due_date ASC NULLS LAST, id LIMIT 20", "ix_tasks_due_date_id"),
    ],
)
async def test_tc391_sorted_pages_walk_an_index(
    xl: None, postgres: Postgres, sort: str, index: str
) -> None:
    nodes = await explain(postgres, f"SELECT id FROM tasks {sort}")  # noqa: S608
    assert any(n.get("Index Name") == index for n in nodes), [n["Node Type"] for n in nodes]


@pytest.mark.sql
@pytest.mark.slow
async def test_tc391_activity_feed_walks_its_index(xl: None, postgres: Postgres) -> None:
    nodes = await explain(postgres, "SELECT id FROM activity ORDER BY at DESC, id DESC LIMIT 10")
    assert any(n.get("Index Name") == "ix_activity_at_id" for n in nodes)


@pytest.mark.sql
@pytest.mark.slow
async def test_tc392_a_list_costs_a_constant_number_of_queries_at_any_page_size(
    xl: None, postgres: Postgres
) -> None:
    """NFR-304: 3 or fewer per request, counting the token's user lookup."""
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    app = create_app(
        make_settings(storage_backend="sql", database_url=SecretStr(postgres.url("app", XL_DB))),
        clock=FakeClock(),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        login = await client.post(
            "/api/v1/auth/login", json={"email": "amara.diallo@example.com", "password": PASSWORD}
        )
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        database = app.state.container.database
        counts: dict[str, int] = {}
        statements: list[str] = []
        engine = database.engine.sync_engine
        event.listen(engine, "before_cursor_execute", lambda *args: statements.append(args[2]))
        for size in (1, 20, 100):
            for path in ("/api/v1/tasks", "/api/v1/projects", "/api/v1/users", "/api/v1/activity"):
                statements.clear()
                query = (
                    f"pageSize={size}" if path != "/api/v1/activity" else f"limit={min(size, 50)}"
                )
                response = await client.get(f"{path}?{query}", headers=headers)
                assert response.status_code == 200, (path, response.text)
                counts[f"{path} size {size}"] = len(statements)
        await app.state.container.close()
    too_many = {name: n for name, n in counts.items() if n > 3}
    assert too_many == {}, counts
    # and the number does not grow with the page size
    for path in ("/api/v1/tasks", "/api/v1/projects", "/api/v1/users", "/api/v1/activity"):
        assert len({counts[f"{path} size {s}"] for s in (1, 20, 100)}) == 1, path
