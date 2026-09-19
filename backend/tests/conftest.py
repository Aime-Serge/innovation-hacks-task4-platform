from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import get_settings
from app.db.session import get_engine
from app.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent

# Every real client sends this — see app/csrf.py. Tests construct
# TestClient directly (not through a browser), so it has to be set
# explicitly here to exercise the same request shape the frontend sends.
FETCH_HEADERS = {"X-Requested-With": "XMLHttpRequest"}


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Runs the real Alembic migrations against DATABASE_URL once per test
    session — the same schema-creation path used in production, not a
    create_all() shortcut."""
    alembic_cfg = Config(str(REPO_ROOT / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")
    yield


@pytest.fixture(autouse=True)
def no_real_gemini_key_by_default(monkeypatch):
    """Settings reads GEMINI_API_KEY straight out of .env (pydantic-
    settings' env_file loading — not conditional on the shell's own
    exports), so a developer's real local key would otherwise make
    every AI-related test either hit the live API for real (burning
    quota, adding real latency/flakiness) or fail outright when a test
    asserts on the fallback path specifically. Tests are supposed to be
    hermetic regardless of what happens to be sitting in a local .env;
    test_ai_failure_modes.py's own fixture sets a fake key afterward for
    the handful of tests that need one configured to exercise the call
    path against a mocked client.

    Important: this sets an empty string, not monkeypatch.delenv. Pydantic-
    settings' precedence is real env vars > .env file > field default —
    deleting the OS var just makes it fall through to .env's real value
    again; an explicit empty string is what actually wins over it."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def reset_database():
    """Truncate every table before each test so tests stay isolated."""
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE tasks, projects, users CASCADE"))
    yield


def _register(email: str, name: str = "Ada Lovelace", password: str = "supersecret") -> TestClient:
    c = TestClient(app, headers=FETCH_HEADERS)
    c.post("/auth/register", json={"name": name, "email": email, "password": password})
    # Registering no longer signs you in — log in explicitly, the way a
    # real user now has to.
    c.post("/auth/login", json={"email": email, "password": password})
    return c


@pytest.fixture
def anon_client() -> TestClient:
    """No session cookie — for asserting protected routes reject anonymous
    requests, and for exercising register/login themselves."""
    return TestClient(app, headers=FETCH_HEADERS)


@pytest.fixture
def client() -> TestClient:
    """An authenticated client (registered, then logged in) — the default
    for tests exercising normal, logged-in behavior."""
    return _register("ada@example.com")


@pytest.fixture
def user(client) -> dict:
    return client.get("/auth/me").json()


@pytest.fixture
def other_client() -> TestClient:
    """A second, independent authenticated user — for cross-tenant
    isolation tests: one user must never see or edit another's data."""
    return _register("grace@example.com", name="Grace Hopper")


@pytest.fixture
def project(client) -> dict:
    return client.post(
        "/projects", json={"name": "Analytical Engine", "description": "A project"}
    ).json()
