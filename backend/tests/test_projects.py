NIL_UUID = "00000000-0000-0000-0000-000000000000"


def test_create_project_returns_201(client, user):
    r = client.post(
        "/projects",
        json={"name": "Analytical Engine", "description": "desc", "owner_id": user["id"]},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Analytical Engine"
    assert body["owner_id"] == user["id"]


def test_create_project_missing_owner_returns_404(client):
    r = client.post("/projects", json={"name": "Ghost", "owner_id": NIL_UUID})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_create_project_invalid_payload_returns_422(client, user):
    r = client.post("/projects", json={"name": "", "owner_id": user["id"]})
    assert r.status_code == 422


def test_get_project_not_found_returns_404(client):
    r = client.get(f"/projects/{NIL_UUID}")
    assert r.status_code == 404


def test_list_projects_returns_200(client, project):
    r = client.get("/projects")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_list_projects_filtered_by_owner(client, project, user):
    r = client.get(f"/projects?owner_id={user['id']}")
    assert r.status_code == 200
    assert len(r.json()) == 1

    other_owner = client.post(
        "/users",
        json={"name": "Other", "email": "other@example.com", "password": "supersecret"},
    ).json()
    r2 = client.get(f"/projects?owner_id={other_owner['id']}")
    assert r2.status_code == 200
    assert len(r2.json()) == 0


def test_create_project_empty_body_returns_422(client):
    r = client.post("/projects", json={})
    assert r.status_code == 422


def test_create_project_wrong_type_owner_id_returns_422(client):
    r = client.post("/projects", json={"name": "X", "owner_id": 12345})
    assert r.status_code == 422


def test_get_project_malformed_id_returns_422_not_404(client):
    r = client.get("/projects/not-a-uuid")
    assert r.status_code == 422
