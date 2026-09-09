NIL_UUID = "00000000-0000-0000-0000-000000000000"


def test_create_task_returns_201_with_default_status(client, project):
    r = client.post("/tasks", json={"title": "Write scheduler", "project_id": project["id"]})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "todo"
    assert body["project_id"] == project["id"]


def test_create_task_missing_project_returns_404(client):
    r = client.post("/tasks", json={"title": "Ghost task", "project_id": NIL_UUID})
    assert r.status_code == 404


def test_create_task_invalid_payload_returns_422(client, project):
    r = client.post("/tasks", json={"title": "", "project_id": project["id"]})
    assert r.status_code == 422


def test_get_task_not_found_returns_404(client):
    r = client.get(f"/tasks/{NIL_UUID}")
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


def test_update_task_title_returns_200(client, project):
    task = client.post("/tasks", json={"title": "Old", "project_id": project["id"]}).json()
    r = client.patch(f"/tasks/{task['id']}", json={"title": "New"})
    assert r.status_code == 200
    assert r.json()["title"] == "New"


def test_update_task_not_found_returns_404(client):
    r = client.patch(f"/tasks/{NIL_UUID}", json={"title": "New"})
    assert r.status_code == 404


def test_update_task_status_valid_value_returns_200(client, project):
    task = client.post("/tasks", json={"title": "T", "project_id": project["id"]}).json()
    r = client.patch(f"/tasks/{task['id']}/status", json={"status": "in-progress"})
    assert r.status_code == 200
    assert r.json()["status"] == "in-progress"


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


def test_delete_task_not_found_returns_404(client):
    r = client.delete(f"/tasks/{NIL_UUID}")
    assert r.status_code == 404


def test_create_task_empty_body_returns_422(client):
    r = client.post("/tasks", json={})
    assert r.status_code == 422


def test_create_task_wrong_type_project_id_returns_422(client):
    r = client.post("/tasks", json={"title": "T", "project_id": 12345})
    assert r.status_code == 422


def test_get_task_malformed_id_returns_422_not_404(client):
    r = client.get("/tasks/not-a-uuid")
    assert r.status_code == 422
