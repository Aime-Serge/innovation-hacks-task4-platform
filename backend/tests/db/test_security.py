"""TC-330 to TC-337: configuration, roles, secrets and the password hash (section 9)."""

import re
import subprocess
from pathlib import Path
from typing import Any

import pytest
import yaml
from pydantic import SecretStr, ValidationError
from sqlalchemy import event

from app.core.config import Settings, load_settings
from tests.conftest import DEV, LEAD, OTHER, Env, make_settings
from tests.db.conftest import Db

ROOT = Path(__file__).resolve().parents[2]
PLACEHOLDER_URL = "postgresql+asyncpg://ih_app:<set-me>@db.example.com:5432/ih_platform"
SECRET_URL = "postgresql+asyncpg://ih_app:S3cr3t-Pa55@db.example.com:5432/ih_platform"


def _sql(**more: Any) -> Settings:
    return make_settings(storage_backend="sql", database_url=SecretStr(SECRET_URL), **more)


def test_tc330_a_missing_database_url_stops_startup_and_names_the_variable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir("/")
    monkeypatch.setenv("SECRET_KEY", "k" * 40)
    monkeypatch.setenv("STORAGE_BACKEND", "sql")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(SystemExit, match="DATABASE_URL"):
        load_settings()


@pytest.mark.parametrize("name", ["DATABASE_URL", "MIGRATION_DATABASE_URL"])
def test_tc330_an_invalid_url_names_the_variable(
    name: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir("/")
    monkeypatch.setenv("SECRET_KEY", "k" * 40)
    monkeypatch.setenv("STORAGE_BACKEND", "sql")
    monkeypatch.setenv("DATABASE_URL", SECRET_URL)
    monkeypatch.setenv(name, "mysql://user:pw@host/db")
    with pytest.raises(SystemExit, match=name):
        load_settings()


def test_tc333_production_refuses_the_memory_backend() -> None:
    with pytest.raises(ValidationError, match="STORAGE_BACKEND"):
        make_settings(app_env="production", storage_backend="memory")


def test_tc333_production_refuses_a_connection_string_without_tls() -> None:
    with pytest.raises(ValidationError, match="TLS"):
        make_settings(
            app_env="production", storage_backend="sql", database_url=SecretStr(SECRET_URL)
        )
    for mode in ("require", "verify-ca", "verify-full"):
        ok = make_settings(
            app_env="production",
            storage_backend="sql",
            database_url=SecretStr(f"{SECRET_URL}?ssl={mode}"),
        )
        assert ok.is_production


def test_tc333_development_needs_no_tls() -> None:
    assert _sql().storage_backend == "sql"


def test_tc334_settings_never_print_the_password() -> None:
    settings = _sql(migration_database_url=SecretStr(SECRET_URL))
    for text in (repr(settings), str(settings), settings.model_dump_json()):
        assert "S3cr3t" not in text


@pytest.mark.sql
async def test_tc334_no_response_or_log_line_contains_the_connection_string(
    sql_env: Env, caplog: pytest.LogCaptureFixture
) -> None:
    password = sql_env.container.settings.database_url
    assert password is not None
    secret = password.get_secret_value().split(":")[2].split("@")[0]
    responses = [
        await sql_env.client.get("/readyz"),
        await sql_env.client.get("/api/v1/projects/not-a-uuid", headers=sql_env.auth(DEV)),
        await sql_env.client.get("/api/v1/nope"),
    ]
    assert all(secret not in r.text for r in responses)
    assert secret not in caplog.text


SECRETS = ("POSTGRES_PASSWORD", "APP_DB_PASSWORD", "MIGRATOR_DB_PASSWORD", "READONLY_DB_PASSWORD")


def _compose_config(env: dict[str, str]) -> "subprocess.CompletedProcess[str]":
    compose = ROOT / "database" / "docker-compose.yml"
    return subprocess.run(  # noqa: S603
        ["docker", "compose", "-f", str(compose), "config"],  # noqa: S607
        capture_output=True,
        text=True,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin", **env},
        check=False,
    )


@pytest.mark.parametrize("missing", SECRETS)
def test_tc337_compose_refuses_each_unset_secret_and_names_it(missing: str) -> None:
    # Which variable compose reports first depends on its version, so leave exactly one unset.
    env = {name: "placeholder" for name in SECRETS if name != missing}
    result = _compose_config(env)
    assert result.returncode != 0
    assert missing in result.stderr


def test_tc337_compose_binds_the_database_port_to_loopback() -> None:
    compose = ROOT / "database" / "docker-compose.yml"
    ports = yaml.safe_load(compose.read_text())["services"]["db"]["ports"]
    assert all(str(port).startswith("127.0.0.1:") for port in ports)
    assert _compose_config({name: "placeholder" for name in SECRETS}).returncode == 0


def test_tc337_role_script_refuses_missing_passwords() -> None:
    script = (ROOT / "database" / "init" / "roles.sh").read_text()
    for name in ("APP_DB_PASSWORD", "MIGRATOR_DB_PASSWORD", "READONLY_DB_PASSWORD"):
        assert f': "${{{name}:?' in script


def test_tc331_env_example_holds_only_placeholders_for_passwords() -> None:
    text = (ROOT / ".env.example").read_text()
    for line in text.splitlines():
        if re.match(
            r"^(POSTGRES_PASSWORD|APP_DB_PASSWORD|MIGRATOR_DB_PASSWORD|READONLY_DB_PASSWORD)=", line
        ):
            assert line.endswith("=<set-me>"), line
    for url in re.findall(r"^(?:MIGRATION_)?DATABASE_URL=(\S+)$", text, flags=re.M):
        assert "<set-me>" in url


def test_tc331_no_postgres_url_with_a_real_password_is_tracked() -> None:
    from tests.security.test_repo_hygiene import tracked_files

    pattern = re.compile(r"postgres(?:ql)?(?:\+\w+)?://[^:/\s]+:([^@\s]+)@")
    hits = []
    for path in tracked_files():
        if path.suffix in {".pdf", ".png", ".lock"}:
            continue
        for match in pattern.finditer(path.read_text(errors="ignore")):
            password = match.group(1)
            if (
                password not in {"<set-me>", "<password>", "S3cr3t-Pa55"}
                and "{" not in password
                and not password.startswith("$")
            ):
                hits.append(f"{path.relative_to(ROOT)}: {match.group(0)[:40]}")
    assert hits == []


@pytest.mark.sql
@pytest.mark.parametrize(
    "statement",
    [
        "CREATE TABLE evil (id int)",
        "ALTER TABLE users ADD COLUMN evil int",
        "DROP TABLE users",
        "CREATE INDEX evil ON users (name)",
        "CREATE EXTENSION IF NOT EXISTS hstore",
        "TRUNCATE users CASCADE",
        "CREATE ROLE evil",
        "ALTER TABLE tasks DROP CONSTRAINT ck_tasks_status",
    ],
)
async def test_tc332_the_application_role_cannot_change_the_schema(
    app_db: Db, statement: str
) -> None:
    state, _ = await app_db.rejected(statement)
    assert state == "42501", statement  # insufficient_privilege


@pytest.mark.sql
async def test_tc332_the_application_role_can_read_and_write_rows(app_db: Db) -> None:
    await app_db.user()
    assert (await app_db.run("SELECT count(*) AS n FROM users"))[0].n == 1
    await app_db.run("UPDATE users SET name = 'Renamed'")
    await app_db.run("DELETE FROM users")


@pytest.mark.sql
async def test_tc336_the_read_only_role_reads_but_never_the_hash_and_never_writes(
    admin_db: Db, postgres: Any, clean: str
) -> None:
    await admin_db.user()
    reader = Db(postgres.engine("readonly", clean))
    try:
        assert await reader.run("SELECT id, name, email FROM users")
        assert (await reader.run("SELECT count(*) AS n FROM tasks"))[0].n == 0
        for blocked in (
            "SELECT password_hash FROM users",
            "SELECT * FROM users",
            "INSERT INTO projects (id, name, owner_id) "
            "VALUES (gen_random_uuid(), 'x', gen_random_uuid())",
            "UPDATE users SET name = 'x'",
            "DELETE FROM tasks",
            "CREATE TABLE evil (id int)",
        ):
            state, _ = await reader.rejected(blocked)
            assert state == "42501", blocked
    finally:
        await reader.engine.dispose()


@pytest.mark.sql
async def test_tc335_password_hash_is_selected_only_by_the_login_lookup(sql_env: Env) -> None:
    assert sql_env.container.database is not None
    seen: list[str] = []
    engine = sql_env.container.database.engine.sync_engine

    def capture(conn: Any, cursor: Any, statement: str, *rest: Any) -> None:
        seen.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        me = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(LEAD))).json()
        other = (await sql_env.client.get("/api/v1/auth/me", headers=sql_env.auth(OTHER))).json()
        await sql_env.client.get("/api/v1/users", headers=sql_env.auth(DEV))
        await sql_env.client.get(f"/api/v1/users/{other['id']}", headers=sql_env.auth(DEV))
        await sql_env.client.patch(
            f"/api/v1/users/{other['id']}", json={"name": "Renamed"}, headers=sql_env.auth(LEAD)
        )
        await sql_env.client.post(
            "/api/v1/users",
            json={"name": "New", "email": "new@example.com", "password": "brand-new-password"},
        )
        await sql_env.login("new@example.com", "brand-new-password")
        await sql_env.client.delete(f"/api/v1/users/{me['id']}", headers=sql_env.auth(OTHER))
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    selects = [s for s in seen if "password_hash" in s and s.lstrip().upper().startswith("SELECT")]
    assert len(selects) == 1, selects  # the one login lookup (NFR-318)
    assert "users.email = " in selects[0]
    writes = [
        s for s in seen if "password_hash" in s and not s.lstrip().upper().startswith("SELECT")
    ]
    assert len(writes) == 1
    assert writes[0].lstrip().upper().startswith("INSERT")
