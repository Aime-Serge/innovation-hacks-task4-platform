"""One test walking the whole user journey QA specified, end to end
against the real API contract — not a substitute for the focused unit
tests elsewhere, but the thing that proves the pieces actually compose:
register -> login -> create project -> create task -> assign -> set
priority/due date -> search/filter -> use the AI feature -> logout ->
confirm protected routes now reject.
"""

from fastapi.testclient import TestClient

from app.main import app

FETCH_HEADERS = {"X-Requested-With": "XMLHttpRequest"}


def test_full_user_journey():
    client = TestClient(app, headers=FETCH_HEADERS)

    # 1. Register (creates the account, hashes the password, starts a session).
    register = client.post(
        "/auth/register",
        json={"name": "Jordan Lee", "email": "jordan@example.com", "password": "supersecret1"},
    )
    assert register.status_code == 201
    me = register.json()["user"]
    assert "password" not in me and "password_hash" not in me

    # A second account, to assign a task to and to prove tenant isolation
    # doesn't leak into this same journey.
    teammate_client = TestClient(app, headers=FETCH_HEADERS)
    teammate = teammate_client.post(
        "/auth/register",
        json={"name": "Priya Shah", "email": "priya@example.com", "password": "supersecret2"},
    ).json()["user"]

    # 2. Login (separately from the register-issued session, proving the
    #    login path independently issues a working session).
    fresh_login_client = TestClient(app, headers=FETCH_HEADERS)
    login = fresh_login_client.post(
        "/auth/login", json={"email": "jordan@example.com", "password": "supersecret1"}
    )
    assert login.status_code == 200
    client = fresh_login_client  # continue the journey on the logged-in-via-/login session

    # 3. Create project.
    project = client.post(
        "/projects", json={"name": "Atlas Gateway", "description": "Rate-limited API gateway"}
    )
    assert project.status_code == 201
    project_id = project.json()["id"]
    assert project.json()["owner_id"] == me["id"]

    # 4. Create task.
    task = client.post(
        "/tasks", json={"title": "Add per-route rate limiting", "project_id": project_id}
    )
    assert task.status_code == 201
    task_id = task.json()["id"]
    assert task.json()["priority"] == "medium"  # default
    assert task.json()["assignee_id"] is None

    # 5. Assign, set priority + due date (single PATCH, matching the UI's
    #    TaskFormModal edit flow).
    updated = client.patch(
        f"/tasks/{task_id}",
        json={
            "priority": "high",
            "due_date": "2026-12-01",
            "assignee_id": teammate["id"],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["priority"] == "high"
    assert body["due_date"] == "2026-12-01"
    assert body["assignee_id"] == teammate["id"]

    # 6. Search + filter.
    client.post("/tasks", json={"title": "Write changelog", "project_id": project_id, "priority": "low"})
    search_result = client.get("/tasks?search=rate")
    assert search_result.status_code == 200
    assert [t["title"] for t in search_result.json()] == ["Add per-route rate limiting"]

    filter_result = client.get("/tasks?priority=high")
    assert filter_result.status_code == 200
    assert [t["id"] for t in filter_result.json()] == [task_id]

    # 7. Use the AI feature. No GEMINI_API_KEY in this test environment,
    #    so this exercises the fallback path — proving the feature stays
    #    usable, honestly labeled, exactly as designed.
    ai_result = client.post(f"/projects/{project_id}/ai/generate-tasks", json={"count": 3})
    assert ai_result.status_code == 200
    ai_body = ai_result.json()
    assert ai_body["source"] == "fallback"
    assert len(ai_body["tasks"]) == 3

    # 8. Logout.
    logout = client.post("/auth/logout")
    assert logout.status_code == 204

    # 9. Confirm protected routes now reject.
    assert client.get("/auth/me").status_code == 401
    assert client.get("/projects").status_code == 401
    assert client.post("/tasks", json={"title": "Should fail", "project_id": project_id}).status_code == 401
