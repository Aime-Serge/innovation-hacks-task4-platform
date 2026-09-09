NIL_UUID = "00000000-0000-0000-0000-000000000000"


def test_create_user_returns_201_and_excludes_password(client):
    r = client.post(
        "/users",
        json={"name": "Grace Hopper", "email": "grace@example.com", "password": "supersecret"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "grace@example.com"
    assert "password" not in body
    assert "password_hash" not in body


def test_create_user_duplicate_email_returns_409(client, user):
    r = client.post(
        "/users",
        json={"name": "Other", "email": user["email"], "password": "supersecret"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


def test_create_user_invalid_payload_returns_422(client):
    r = client.post("/users", json={"name": "", "email": "not-an-email", "password": "short"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_get_user_not_found_returns_404(client):
    r = client.get(f"/users/{NIL_UUID}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_list_users_returns_200(client, user):
    r = client.get("/users")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_update_user_returns_200(client, user):
    r = client.patch(f"/users/{user['id']}", json={"name": "Ada L."})
    assert r.status_code == 200
    assert r.json()["name"] == "Ada L."


def test_update_user_not_found_returns_404(client):
    r = client.patch(f"/users/{NIL_UUID}", json={"name": "Nobody"})
    assert r.status_code == 404


def test_update_user_email_conflict_returns_409(client, user):
    other = client.post(
        "/users",
        json={"name": "Bob", "email": "bob@example.com", "password": "supersecret"},
    ).json()
    r = client.patch(f"/users/{other['id']}", json={"email": user["email"]})
    assert r.status_code == 409


def test_delete_user_returns_204_then_404(client, user):
    r = client.delete(f"/users/{user['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/users/{user['id']}")
    assert r2.status_code == 404


def test_create_user_empty_body_returns_422(client):
    r = client.post("/users", json={})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_create_user_wrong_type_returns_422(client):
    r = client.post("/users", json={"name": 123, "email": "grace@example.com", "password": True})
    assert r.status_code == 422


def test_get_user_malformed_id_returns_422_not_404(client):
    r = client.get("/users/not-a-uuid")
    assert r.status_code == 422


def test_create_user_malformed_json_body_returns_422_not_400(client):
    r = client.post(
        "/users", content="not-json-at-all", headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
