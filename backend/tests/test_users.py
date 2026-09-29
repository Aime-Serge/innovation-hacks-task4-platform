NIL_UUID = "00000000-0000-0000-0000-000000000000"


def test_list_users_requires_auth(anon_client):
    r = anon_client.get("/users")
    assert r.status_code == 401


def test_list_users_returns_200(client, user):
    r = client.get("/users")
    assert r.status_code == 200
    assert any(u["id"] == user["id"] for u in r.json())


def test_get_user_returns_200(client, user):
    r = client.get(f"/users/{user['id']}")
    assert r.status_code == 200
    assert r.json()["email"] == user["email"]


def test_get_user_not_found_returns_404(client):
    r = client.get(f"/users/{NIL_UUID}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_update_own_user_returns_200(client, user):
    r = client.patch(f"/users/{user['id']}", json={"name": "Ada L."})
    assert r.status_code == 200
    assert r.json()["name"] == "Ada L."


def test_update_other_user_returns_403(client, other_client):
    other_id = other_client.get("/auth/me").json()["id"]
    r = client.patch(f"/users/{other_id}", json={"name": "Hacked"})
    assert r.status_code == 403


def test_update_user_email_conflict_returns_409(client, user, other_client):
    other = other_client.get("/auth/me").json()
    r = other_client.patch(f"/users/{other['id']}", json={"email": user["email"]})
    assert r.status_code == 409


def test_delete_own_user_returns_204_then_invalidates_session(client, user):
    r = client.delete(f"/users/{user['id']}")
    assert r.status_code == 204
    r2 = client.get("/auth/me")
    assert r2.status_code == 401


def test_delete_other_user_returns_403(client, other_client):
    other_id = other_client.get("/auth/me").json()["id"]
    r = client.delete(f"/users/{other_id}")
    assert r.status_code == 403
    # confirm the other account wasn't actually deleted
    r2 = other_client.get("/auth/me")
    assert r2.status_code == 200


def test_get_user_malformed_id_returns_422_not_404(client):
    r = client.get("/users/not-a-uuid")
    assert r.status_code == 422
