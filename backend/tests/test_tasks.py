NIL_UUID = "00000000-0000-0000-0000-000000000000"


def test_create_task_requires_auth(anon_client, project):
    r = anon_client.post("/tasks", json={"title": "Ghost", "project_id": project["id"]})
    assert r.status_code == 401


def test_create_task_returns_201_with_defaults(client, project):
    r = client.post("/tasks", json={"title": "Write scheduler", "project_id": project["id"]})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "todo"
    assert body["priority"] == "medium"
    assert body["due_date"] is None
    assert body["assignee_id"] is None
    assert body["project_id"] == project["id"]


def test_create_task_with_priority_due_date_and_assignee(client, project, user):
    r = client.post(
        "/tasks",
        json={
            "title": "Ship it",
            "project_id": project["id"],
            "priority": "high",
            "due_date": "2026-12-01",
            "assignee_id": user["id"],
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["priority"] == "high"
    assert body["due_date"] == "2026-12-01"
    assert body["assignee_id"] == user["id"]


def test_create_task_unknown_assignee_returns_404(client, project):
    r = client.post(
        "/tasks", json={"title": "T", "project_id": project["id"], "assignee_id": NIL_UUID}
    )
    assert r.status_code == 404


def test_create_task_on_other_users_project_returns_404(other_client, project):
    r = other_client.post("/tasks", json={"title": "Sneaky", "project_id": project["id"]})
    assert r.status_code == 404


def test_create_task_missing_project_returns_404(client):
    r = client.post("/tasks", json={"title": "Ghost task", "project_id": NIL_UUID})
    assert r.status_code == 404


def test_create_task_invalid_payload_returns_422(client, project):
    r = client.post("/tasks", json={"title": "", "project_id": project["id"]})
    assert r.status_code == 422


def test_get_task_not_found_returns_404(client):
    r = client.get(f"/tasks/{NIL_UUID}")
    assert r.status_code == 404


def test_get_task_on_other_users_project_returns_404(client, project, other_client):
    task = client.post("/tasks", json={"title": "Mine", "project_id": project["id"]}).json()
    r = other_client.get(f"/tasks/{task['id']}")
    assert r.status_code == 404


def test_list_tasks_filtered_by_project_and_status(client, project):
    client.post("/tasks", json={"title": "A", "project_id": project["id"]})
    t2 = client.post(
        "/tasks", json={"title": "B", "project_id": project["id"], "status": "done"}
    ).json()

    r = client.get(f"/tasks?project_id={project['id']}")
    assert r.status_code == 200
    assert len(r.json()) == 2

    r2 = client.get(f"/tasks?project_id={project['id']}&status=done")
    assert r2.status_code == 200
    assert [t["id"] for t in r2.json()] == [t2["id"]]


def test_list_tasks_filtered_by_priority(client, project):
    client.post("/tasks", json={"title": "Low one", "project_id": project["id"], "priority": "low"})
    high = client.post(
        "/tasks", json={"title": "High one", "project_id": project["id"], "priority": "high"}
    ).json()

    r = client.get("/tasks?priority=high")
    assert r.status_code == 200
    assert [t["id"] for t in r.json()] == [high["id"]]


def test_list_tasks_search_filters_by_title(client, project):
    client.post("/tasks", json={"title": "Write scheduler", "project_id": project["id"]})
    client.post("/tasks", json={"title": "Fix bug", "project_id": project["id"]})

    r = client.get("/tasks?search=sched")
    assert r.status_code == 200
    assert [t["title"] for t in r.json()] == ["Write scheduler"]


def test_list_tasks_without_project_filter_scopes_to_callers_projects(
    client, project, other_client
):
    client.post("/tasks", json={"title": "Mine", "project_id": project["id"]})
    other_project = other_client.post("/projects", json={"name": "Other"}).json()
    other_client.post("/tasks", json={"title": "Theirs", "project_id": other_project["id"]})

    r = client.get("/tasks")
    assert r.status_code == 200
    assert {t["title"] for t in r.json()} == {"Mine"}


def test_list_tasks_on_other_users_project_returns_404(client, project, other_client):
    r = other_client.get(f"/tasks?project_id={project['id']}")
    assert r.status_code == 404


def test_update_task_fields_returns_200(client, project, user):
    task = client.post("/tasks", json={"title": "Old", "project_id": project["id"]}).json()
    r = client.patch(
        f"/tasks/{task['id']}",
        json={
            "title": "New",
            "priority": "high",
            "due_date": "2026-11-01",
            "assignee_id": user["id"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "New"
    assert body["priority"] == "high"
    assert body["due_date"] == "2026-11-01"
    assert body["assignee_id"] == user["id"]


def test_update_task_clear_due_date_and_assignee(client, project, user):
    task = client.post(
        "/tasks",
        json={
            "title": "T",
            "project_id": project["id"],
            "due_date": "2026-11-01",
            "assignee_id": user["id"],
        },
    ).json()
    r = client.patch(
        f"/tasks/{task['id']}", json={"clear_due_date": True, "clear_assignee": True}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["due_date"] is None
    assert body["assignee_id"] is None


def test_update_task_not_found_returns_404(client):
    r = client.patch(f"/tasks/{NIL_UUID}", json={"title": "New"})
    assert r.status_code == 404


def test_update_task_on_other_users_project_returns_404(client, project, other_client):
    task = client.post("/tasks", json={"title": "Mine", "project_id": project["id"]}).json()
    r = other_client.patch(f"/tasks/{task['id']}", json={"title": "Hijacked"})
    assert r.status_code == 404


def test_update_task_status_valid_value_returns_200(client, project):
    task = client.post("/tasks", json={"title": "T", "project_id": project["id"]}).json()
    r = client.patch(f"/tasks/{task['id']}/status", json={"status": "in-progress"})
    assert r.status_code == 200
    assert r.json()["status"] == "in-progress"


def test_update_task_status_blocked_returns_200(client, project):
    task = client.post("/tasks", json={"title": "T", "project_id": project["id"]}).json()
    r = client.patch(f"/tasks/{task['id']}/status", json={"status": "blocked"})
    assert r.status_code == 200
    assert r.json()["status"] == "blocked"


def test_update_task_status_invalid_value_returns_422(client, project):
    task = client.post("/tasks", json={"title": "T", "project_id": project["id"]}).json()
    r = client.patch(f"/tasks/{task['id']}/status", json={"status": "archived"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_update_task_status_not_found_returns_404(client):
    r = client.patch(f"/tasks/{NIL_UUID}/status", json={"status": "done"})
    assert r.status_code == 404


def test_delete_task_returns_204_then_404(client, project):
    task = client.post("/tasks", json={"title": "T", "project_id": project["id"]}).json()
    r = client.delete(f"/tasks/{task['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/tasks/{task['id']}")
    assert r2.status_code == 404


def test_delete_task_on_other_users_project_returns_404(client, project, other_client):
    task = client.post("/tasks", json={"title": "T", "project_id": project["id"]}).json()
    r = other_client.delete(f"/tasks/{task['id']}")
    assert r.status_code == 404


def test_delete_task_not_found_returns_404(client):
    r = client.delete(f"/tasks/{NIL_UUID}")
    assert r.status_code == 404


def test_create_task_empty_body_returns_422(client):
    r = client.post("/tasks", json={})
    assert r.status_code == 422


def test_get_task_malformed_id_returns_422_not_404(client):
    r = client.get("/tasks/not-a-uuid")
    assert r.status_code == 422
