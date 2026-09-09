NIL_UUID = "00000000-0000-0000-0000-000000000000"


def test_create_project_requires_auth(anon_client):
    r = anon_client.post("/projects", json={"name": "Ghost"})
    assert r.status_code == 401


def test_create_project_returns_201_owned_by_caller(client, user):
    r = client.post("/projects", json={"name": "Analytical Engine", "description": "desc"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Analytical Engine"
    assert body["owner_id"] == user["id"]


def test_create_project_invalid_payload_returns_422(client):
    r = client.post("/projects", json={"name": ""})
    assert r.status_code == 422


def test_get_project_not_found_returns_404(client):
    r = client.get(f"/projects/{NIL_UUID}")
    assert r.status_code == 404


def test_get_other_users_project_returns_404(project, other_client):
    """404, not 403 — don't reveal that a project id exists to a user
    with no access to it."""
    r = other_client.get(f"/projects/{project['id']}")
    assert r.status_code == 404


def test_list_projects_returns_only_callers_own(client, project, other_client):
    r = client.get("/projects")
    assert r.status_code == 200
    assert len(r.json()) == 1

    other_client.post("/projects", json={"name": "Someone else's project"})
    r2 = client.get("/projects")
    assert len(r2.json()) == 1


def test_list_projects_search_filters_by_name(client, project):
    client.post("/projects", json={"name": "Unrelated"})
    r = client.get("/projects?search=Analytical")
    assert r.status_code == 200
    assert [p["name"] for p in r.json()] == ["Analytical Engine"]


def test_update_project_returns_200(client, project):
    r = client.patch(f"/projects/{project['id']}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_update_other_users_project_returns_404(project, other_client):
    r = other_client.patch(f"/projects/{project['id']}", json={"name": "Hijacked"})
    assert r.status_code == 404


def test_delete_project_returns_204_then_404(client, project):
    r = client.delete(f"/projects/{project['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/projects/{project['id']}")
    assert r2.status_code == 404


def test_delete_other_users_project_returns_404(client, project, other_client):
    r = other_client.delete(f"/projects/{project['id']}")
    assert r.status_code == 404
    r2 = client.get(f"/projects/{project['id']}")
    assert r2.status_code == 200


def test_create_project_empty_body_returns_422(client):
    r = client.post("/projects", json={})
    assert r.status_code == 422


def test_get_project_malformed_id_returns_422_not_404(client):
    r = client.get("/projects/not-a-uuid")
    assert r.status_code == 422
