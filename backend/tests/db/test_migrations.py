"""TC-370 to TC-373, TC-399: migrations go up, down and up; models agree; names follow the rule."""

import re

import pytest

from tests import sql_support
from tests.db.conftest import Db
from tests.sql_support import Postgres

PK = re.compile(r"^pk_[a-z_]+$")
FK = re.compile(
    r"^fk_(users|projects|tasks|activity|refresh_tokens|ai_requests|profiles|profile_skills)_[a-z_]+_(users|projects|tasks)$"
)
UQ = re.compile(r"^uq_(users|refresh_tokens)_[a-z_]+$")
CK = re.compile(
    r"^ck_(users|projects|tasks|activity|refresh_tokens|ai_requests|profiles|profile_skills)_[a-z_0-9]+$"
)
TRG = re.compile(r"^trg_profile_skills_[a-z_]+$")  # the 10-skill constraint trigger (ADR-604)
IX = re.compile(
    r"^ix_(users|projects|tasks|activity|refresh_tokens|ai_requests|profile_skills)_[a-z_]+$"
)

# Section 6, column by column: (table, column) -> (type, nullable)
COLUMNS = {
    # Task 4, section 6: ai_requests
    ("ai_requests", "id"): ("uuid", "NO"),
    ("ai_requests", "user_id"): ("uuid", "YES"),
    ("ai_requests", "feature"): ("text", "NO"),
    ("ai_requests", "status"): ("text", "NO"),
    ("ai_requests", "provider"): ("text", "NO"),
    ("ai_requests", "model"): ("text", "YES"),
    ("ai_requests", "prompt_version"): ("text", "NO"),
    ("ai_requests", "input_tokens"): ("integer", "YES"),
    ("ai_requests", "output_tokens"): ("integer", "YES"),
    ("ai_requests", "latency_ms"): ("integer", "YES"),
    ("ai_requests", "error_code"): ("text", "YES"),
    ("ai_requests", "created_at"): ("timestamp with time zone", "NO"),
    # Task 4, section 6: refresh_tokens
    ("refresh_tokens", "id"): ("uuid", "NO"),
    ("refresh_tokens", "user_id"): ("uuid", "NO"),
    ("refresh_tokens", "family_id"): ("uuid", "NO"),
    ("refresh_tokens", "token_hash"): ("text", "NO"),
    ("refresh_tokens", "expires_at"): ("timestamp with time zone", "NO"),
    ("refresh_tokens", "used_at"): ("timestamp with time zone", "YES"),
    ("refresh_tokens", "revoked_at"): ("timestamp with time zone", "YES"),
    ("refresh_tokens", "created_at"): ("timestamp with time zone", "NO"),
    # Minimal profile, pack section 5
    ("users", "given_name"): ("text", "YES"),
    ("users", "family_name"): ("text", "YES"),
    ("profiles", "user_id"): ("uuid", "NO"),
    ("profiles", "discipline"): ("text", "NO"),
    ("profiles", "seniority"): ("text", "NO"),
    ("profiles", "employment_status"): ("text", "NO"),
    ("profiles", "company_name"): ("text", "YES"),
    ("profiles", "job_title"): ("text", "YES"),
    ("profiles", "country_code"): ("text", "NO"),
    ("profiles", "city"): ("text", "YES"),
    ("profiles", "time_zone"): ("text", "NO"),
    ("profiles", "headline"): ("text", "YES"),
    ("profiles", "about"): ("text", "NO"),
    ("profiles", "github_url"): ("text", "YES"),
    ("profiles", "linkedin_url"): ("text", "YES"),
    ("profiles", "website_url"): ("text", "YES"),
    ("profiles", "show_professional_details"): ("boolean", "NO"),
    ("profiles", "terms_version"): ("text", "NO"),
    ("profiles", "terms_accepted_at"): ("timestamp with time zone", "NO"),
    ("profiles", "age_confirmed_at"): ("timestamp with time zone", "YES"),
    ("profiles", "created_at"): ("timestamp with time zone", "NO"),
    ("profiles", "updated_at"): ("timestamp with time zone", "NO"),
    ("profile_skills", "id"): ("uuid", "NO"),
    ("profile_skills", "user_id"): ("uuid", "NO"),
    ("profile_skills", "name"): ("text", "NO"),
    ("profile_skills", "sort_order"): ("smallint", "NO"),
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
    rule = {"p": PK, "f": FK, "u": UQ, "c": CK, "t": TRG}
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


@pytest.mark.sql
async def test_mt17_migration_0008_backfills_existing_users_and_reverses_cleanly(
    postgres: Postgres,
) -> None:
    """MF-19, MN-07: users that exist before 0008 keep every value and gain a neutral profile."""
    name = "ih_rt_profile"
    await sql_support.create_empty_database(postgres, name)
    await sql_support.amigrate(postgres, name, "0007")
    db = Db(postgres.engine("admin", name))
    first, second = await db.user(name="Ada"), await db.user(name="Grace", theme="dark")
    await db.task(await db.project(first), assignee=second)

    await sql_support.amigrate(postgres, name, "0008")
    rows = await db.run(
        "SELECT user_id, discipline, seniority, employment_status, country_code, time_zone, "
        "terms_version, age_confirmed_at, show_professional_details, about, company_name, "
        "job_title, terms_accepted_at, created_at FROM profiles ORDER BY user_id"
    )
    assert {r.user_id for r in rows} == {first, second}
    for r in rows:
        assert (r.discipline, r.seniority, r.employment_status) == ("other", "mid", "between_roles")
        assert (r.country_code, r.time_zone, r.terms_version) == ("ZZ", "UTC", "legacy")
        assert r.age_confirmed_at is None
        assert r.show_professional_details is True
        assert (r.about, r.company_name, r.job_title) == ("", None, None)
        assert r.terms_accepted_at is not None
    users = await db.run("SELECT name, theme, given_name, family_name FROM users ORDER BY name")
    assert [(u.name, u.theme, u.given_name, u.family_name) for u in users] == [
        ("Ada", "system", None, None),
        ("Grace", "dark", None, None),
    ]

    await sql_support.amigrate(postgres, name, "0007", down=True)
    tables = {r.tablename for r in await db.run("SELECT tablename FROM pg_tables")}
    assert not tables & {"profiles", "profile_skills"}
    columns = await db.run(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    )
    assert not {"given_name", "family_name"} & {c.column_name for c in columns}
    assert (await db.run("SELECT count(*) AS n FROM users"))[0].n == 2  # nothing lost
    assert (await db.run("SELECT count(*) AS n FROM tasks"))[0].n == 1

    await sql_support.amigrate(postgres, name, "head")
    assert (await db.run("SELECT count(*) AS n FROM profiles"))[0].n == 2
    await db.engine.dispose()
