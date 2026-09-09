from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_engine
from app.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent


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
    """Equivalent of Task 2's `._users.clear()` etc. for a real database:
    truncate every table before each test so tests stay isolated."""
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE tasks, projects, users CASCADE"))
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def user(client):
    return client.post(
        "/users",
        json={"name": "Ada Lovelace", "email": "ada@example.com", "password": "supersecret"},
    ).json()


@pytest.fixture
def project(client, user):
    return client.post(
        "/projects",
        json={"name": "Analytical Engine", "description": "A project", "owner_id": user["id"]},
    ).json()
