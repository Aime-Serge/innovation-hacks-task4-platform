"""TC-370 to TC-373, TC-399: migrations go up, down and up; models agree; names follow the rule."""

import re

import pytest

from tests import sql_support
from tests.db.conftest import Db
from tests.sql_support import Postgres

PK = re.compile(r"^pk_[a-z_]+$")
FK = re.compile(r"^fk_(users|projects|tasks|activity)_[a-z_]+_(users|projects|tasks)$")
UQ = re.compile(r"^uq_(users)_[a-z_]+$")
CK = re.compile(r"^ck_(users|projects|tasks|activity)_[a-z_]+$")
IX = re.compile(r"^ix_(users|projects|tasks|activity)_[a-z_]+$")

# Section 6, column by column: (table, column) -> (type, nullable)
COLUMNS = {
    ("users", "id"): ("uuid", "NO"),
    ("users", "name"): ("text", "NO"),
    ("users", "email"): ("text", "NO"),
    ("users", "password_hash"): ("text", "NO"),
    ("users", "role"): ("text", "NO"),
    ("users", "avatar_url"): ("text", "YES"),
    ("users", "theme"): ("text", "NO"),
    ("users", "created_at"): ("timestamp with time zone", "NO"),
    ("users", "updated_at"): ("timestamp with time zone", "NO"),
    ("projects", "id"): ("uuid", "NO"),
    ("projects", "name"): ("text", "NO"),
    ("projects", "description"): ("text", "NO"),
    ("projects", "status"): ("text", "NO"),
    ("projects", "due_date"): ("date", "YES"),
    ("projects", "owner_id"): ("uuid", "NO"),
    ("projects", "created_at"): ("timestamp with time zone", "NO"),
    ("projects", "updated_at"): ("timestamp with time zone", "NO"),
    ("tasks", "id"): ("uuid", "NO"),
    ("tasks", "project_id"): ("uuid", "NO"),
    ("tasks", "title"): ("text", "NO"),
    ("tasks", "description"): ("text", "NO"),
    ("tasks", "status"): ("text", "NO"),
    ("tasks", "priority"): ("text", "NO"),
    ("tasks", "priority_rank"): ("smallint", "NO"),
    ("tasks", "due_date"): ("date", "YES"),
    ("tasks", "assignee_id"): ("uuid", "YES"),
    ("tasks", "completed_at"): ("timestamp with time zone", "YES"),
    ("tasks", "created_at"): ("timestamp with time zone", "NO"),
    ("tasks", "updated_at"): ("timestamp with time zone", "NO"),
    ("activity", "id"): ("uuid", "NO"),
    ("activity", "actor_id"): ("uuid", "NO"),
    ("activity", "project_id"): ("uuid", "NO"),
    ("activity", "task_id"): ("uuid", "YES"),
    ("activity", "type"): ("text", "NO"),
    ("activity", "at"): ("timestamp with time zone", "NO"),
}
DEFAULTS = {
    ("users", "role"): "'developer'",
    ("users", "theme"): "'system'",
    ("projects", "description"): "''",
    ("projects", "status"): "'planned'",
    ("tasks", "description"): "''",
    ("tasks", "status"): "'todo'",
    ("tasks", "priority"): "'medium'",
    ("users", "id"): "gen_random_uuid()",
    ("users", "created_at"): "now()",
}


@pytest.mark.sql
async def test_tc399_column_types_nullability_and_defaults_match_section_6(admin_db: Db) -> None:
    rows = await admin_db.run(
        "SELECT table_name, column_name, data_type, is_nullable, column_default, is_generated "
        "FROM information_schema.columns WHERE table_schema = 'public' "
        "AND table_name <> 'alembic_version'"
    )
    found = {(r.table_name, r.column_name): (r.data_type, r.is_nullable) for r in rows}
    assert found == COLUMNS
    defaults = {(r.table_name, r.column_name): r.column_default for r in rows}
    for key, fragment in DEFAULTS.items():
        assert fragment in str(defaults[key]), key
    generated = {(r.table_name, r.column_name) for r in rows if r.is_generated == "ALWAYS"}
    assert generated == {("tasks", "priority_rank")}


@pytest.mark.sql
async def test_tc373_every_constraint_and_index_follows_the_naming_convention(
    admin_db: Db,
) -> None:
    constraints = await admin_db.run(
        "SELECT conname, contype::text AS contype FROM pg_constraint c "
        "JOIN pg_namespace n ON n.oid = c.connamespace "
        "WHERE n.nspname = 'public' AND conname <> 'alembic_version_pkc'"
    )
    rule = {"p": PK, "f": FK, "u": UQ, "c": CK}
    bad = [r.conname for r in constraints if not rule[r.contype].match(r.conname)]
    assert bad == []
    indexes = await admin_db.run(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' "
        "AND indexname NOT LIKE 'pk\\_%' AND indexname NOT LIKE 'uq\\_%' "
        "AND indexname <> 'alembic_version_pkc'"
    )
    assert [r.indexname for r in indexes if not IX.match(r.indexname)] == []


@pytest.mark.sql
async def test_fr306_every_foreign_key_column_is_indexed(admin_db: Db) -> None:
    rows = await admin_db.run(
        "SELECT c.conrelid::regclass::text AS tbl, a.attname AS col "
        "FROM pg_constraint c JOIN pg_attribute a "
        "ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]"
        " WHERE c.contype = 'f' AND NOT EXISTS ("
        "  SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])"
    )
    assert [(r.tbl, r.col) for r in rows] == []


@pytest.mark.sql
async def test_tc370_up_down_up_on_an_empty_database(postgres: Postgres) -> None:
    await sql_support.create_empty_database(postgres, "ih_rt_empty")
    await sql_support.amigrate(postgres, "ih_rt_empty")
    await sql_support.amigrate(postgres, "ih_rt_empty", "base", down=True)
    tables = Db(postgres.engine("admin", "ih_rt_empty"))
    left = await tables.run("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    assert [r.tablename for r in left] == ["alembic_version"]  # only Alembic's own bookkeeping
    await sql_support.amigrate(postgres, "ih_rt_empty")
    names = {
        r.tablename
        for r in await tables.run("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    }
    assert names >= {"users", "projects", "tasks", "activity", "alembic_version"}
    await tables.engine.dispose()


@pytest.mark.sql
async def test_tc371_up_down_up_on_a_seeded_database(postgres: Postgres) -> None:
    await sql_support.create_empty_database(postgres, "ih_rt_seeded")
    await sql_support.amigrate(postgres, "ih_rt_seeded")
    db = Db(postgres.engine("admin", "ih_rt_seeded"))
    owner = await db.user()
    await db.task(await db.project(owner))
    await sql_support.amigrate(
        postgres, "ih_rt_seeded", "0002", down=True
    )  # a step down keeps data
    assert (await db.run("SELECT count(*) AS n FROM tasks"))[0].n == 1
    await sql_support.amigrate(postgres, "ih_rt_seeded", "base", down=True)
    await sql_support.amigrate(postgres, "ih_rt_seeded")
    assert (await db.run("SELECT count(*) AS n FROM tasks"))[0].n == 0
    await db.engine.dispose()


@pytest.mark.sql
def test_tc372_alembic_check_finds_no_difference_between_models_and_migrations(
    postgres: Postgres, worker_db: str
) -> None:
    sql_support.check_drift(postgres, worker_db)  # raises on any drift
