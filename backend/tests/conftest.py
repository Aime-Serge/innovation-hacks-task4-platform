from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

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
def reset_database():
    """Truncate every table before each test so tests stay isolated."""
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE tasks, projects, users CASCADE"))
    yield


def _register(email: str, name: str = "Ada Lovelace", password: str = "supersecret") -> TestClient:
    c = TestClient(app, headers=FETCH_HEADERS)
    c.post("/auth/register", json={"name": name, "email": email, "password": password})
    return c


@pytest.fixture
def anon_client() -> TestClient:
    """No session cookie — for asserting protected routes reject anonymous
    requests, and for exercising register/login themselves."""
    return TestClient(app, headers=FETCH_HEADERS)


@pytest.fixture
def client() -> TestClient:
    """An authenticated client (session cookie already set from
    /auth/register) — the default for tests exercising normal, logged-in
    behavior."""
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
