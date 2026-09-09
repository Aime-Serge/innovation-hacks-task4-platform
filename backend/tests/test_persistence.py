"""Integration tests that only make sense against a real database — they
exercise persistence-across-restart, cascade-delete behavior, relationship
queries, and schema-level validation independent of the Pydantic layer.

Task 2's own endpoint tests (test_users.py, test_projects.py, test_tasks.py,
test_error_handling.py) run unmodified against this same database via
conftest.py and are the proof that external API behavior didn't change.
"""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from app.db.models import ProjectModel, TaskModel, UserModel
from app.db.session import get_engine, get_session_factory, session_scope
from app.main import app


def test_data_survives_a_simulated_server_restart(client, project):
    """Create data, then force brand-new DB connections (as if the server
    process had been killed and restarted) and confirm the data is still
    readable through a fresh TestClient/app instance."""
    task = client.post(
        "/tasks", json={"title": "Persist me", "project_id": project["id"]}
    ).json()

    # Simulate a restart: drop every cached engine/session-factory/connection.
    get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()

    fresh_client = TestClient(app)
    r = fresh_client.get(f"/tasks/{task['id']}")
    assert r.status_code == 200
    assert r.json()["title"] == "Persist me"

    r2 = fresh_client.get(f"/projects/{project['id']}")
    assert r2.status_code == 200
    assert r2.json()["id"] == project["id"]


def test_deleting_project_cascades_to_its_tasks(client, project):
    """Task 2 has no DELETE /projects route, so this exercises the
    Architect's cascade rule directly at the database layer."""
    task = client.post(
        "/tasks", json={"title": "Orphan candidate", "project_id": project["id"]}
    ).json()

    with session_scope() as session:
        row = session.get(ProjectModel, project["id"])
        session.delete(row)

    with session_scope() as session:
        assert session.get(TaskModel, task["id"]) is None
        assert session.get(ProjectModel, project["id"]) is None


def test_deleting_user_cascades_to_projects_and_tasks(client, user, project):
    """DELETE /users/{id} deletes unconditionally in Task 2 with no
    ownership check — cascading here preserves that exact external
    behavior instead of introducing a new FK-violation error."""
    task = client.post(
        "/tasks", json={"title": "Also orphaned", "project_id": project["id"]}
    ).json()

    r = client.delete(f"/users/{user['id']}")
    assert r.status_code == 204

    with session_scope() as session:
        assert session.get(UserModel, user["id"]) is None
        assert session.get(ProjectModel, project["id"]) is None
        assert session.get(TaskModel, task["id"]) is None


def test_tasks_for_project_relationship_query_is_correct(client, user):
    project_a = client.post(
        "/projects", json={"name": "Project A", "owner_id": user["id"]}
    ).json()
    project_b = client.post(
        "/projects", json={"name": "Project B", "owner_id": user["id"]}
    ).json()

    client.post("/tasks", json={"title": "A1", "project_id": project_a["id"]})
    client.post("/tasks", json={"title": "A2", "project_id": project_a["id"]})
    client.post("/tasks", json={"title": "B1", "project_id": project_b["id"]})

    r = client.get(f"/tasks?project_id={project_a['id']}")
    assert r.status_code == 200
    titles = {t["title"] for t in r.json()}
    assert titles == {"A1", "A2"}


def test_schema_rejects_invalid_task_status_bypassing_api_layer():
    """Raw SQL, not the ORM's Python-side Enum check — proves the
    Postgres native enum itself rejects the value, independent of any
    Pydantic/SQLAlchemy validation."""
    with pytest.raises(DataError):
        with session_scope() as session:
            session.execute(
                text(
                    "INSERT INTO tasks (id, title, project_id, status) "
                    "VALUES (gen_random_uuid(), 'bad status', :project_id, 'archived')"
                ),
                {"project_id": str(uuid4())},
            )


def test_schema_rejects_task_with_nonexistent_project_bypassing_api_layer():
    with pytest.raises(IntegrityError):
        with session_scope() as session:
            row = TaskModel(title="Ghost", project_id=uuid4())
            session.add(row)


def test_schema_rejects_null_required_field_bypassing_api_layer():
    with pytest.raises(IntegrityError):
        with session_scope() as session:
            session.execute(
                text(
                    "INSERT INTO users (id, name, email, password_hash) "
                    "VALUES (gen_random_uuid(), NULL, 'nobody@example.com', 'x')"
                )
            )


def test_schema_rejects_duplicate_email_bypassing_api_layer(user):
    with pytest.raises(IntegrityError):
        with session_scope() as session:
            row = UserModel(name="Dup", email=user["email"], password_hash="x")
            session.add(row)


def test_schema_rejects_oversized_field_bypassing_api_layer(project):
    """VARCHAR(150) on projects.name — the API layer's Pydantic
    max_length=150 would already reject this, but this test bypasses
    that entirely to confirm the column itself enforces the limit."""
    with pytest.raises(DataError):
        with session_scope() as session:
            row = ProjectModel(
                name="x" * 151,
                owner_id=project["owner_id"],
            )
            session.add(row)
