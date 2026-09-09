from fastapi.testclient import TestClient

from app.main import app


def test_register_returns_201_with_token_and_sets_cookie(anon_client):
    r = anon_client.post(
        "/auth/register",
        json={"name": "Grace Hopper", "email": "grace@example.com", "password": "supersecret"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "grace@example.com"
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]
    assert body["access_token"]
    assert "access_token" in r.cookies


def test_register_duplicate_email_returns_409(anon_client):
    anon_client.post(
        "/auth/register",
        json={"name": "Grace", "email": "grace@example.com", "password": "supersecret"},
    )
    r = anon_client.post(
        "/auth/register",
        json={"name": "Other", "email": "grace@example.com", "password": "supersecret"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


def test_register_invalid_payload_returns_422(anon_client):
    r = anon_client.post(
        "/auth/register",
        json={"name": "", "email": "not-an-email", "password": "short"},
    )
    assert r.status_code == 422


def test_login_valid_credentials_returns_200_and_sets_cookie(anon_client):
    anon_client.post(
        "/auth/register",
        json={"name": "Grace", "email": "grace@example.com", "password": "supersecret"},
    )
    r = anon_client.post(
        "/auth/login", json={"email": "grace@example.com", "password": "supersecret"}
    )
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "grace@example.com"
    assert "access_token" in r.cookies


def test_login_wrong_password_returns_401(anon_client):
    anon_client.post(
        "/auth/register",
        json={"name": "Grace", "email": "grace@example.com", "password": "supersecret"},
    )
    r = anon_client.post(
        "/auth/login", json={"email": "grace@example.com", "password": "wrong-password"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Invalid email or password."


def test_login_nonexistent_email_returns_401(anon_client):
    r = anon_client.post(
        "/auth/login", json={"email": "nobody@example.com", "password": "whatever"}
    )
    assert r.status_code == 401


def test_me_without_session_returns_401(anon_client):
    r = anon_client.get("/auth/me")
    assert r.status_code == 401


def test_me_with_session_returns_current_user(client, user):
    r = client.get("/auth/me")
    assert r.status_code == 200
    assert r.json()["id"] == user["id"]
    assert r.json()["email"] == user["email"]


def test_logout_clears_session(client):
    r = client.post("/auth/logout")
    assert r.status_code == 204
    r2 = client.get("/auth/me")
    assert r2.status_code == 401


def test_bearer_token_authenticates_without_a_cookie(anon_client):
    r = anon_client.post(
        "/auth/register",
        json={"name": "Grace", "email": "grace@example.com", "password": "supersecret"},
    )
    token = r.json()["access_token"]

    # A brand-new client with no cookie jar — the path an API client
    # (Postman, curl, the demo script) would use instead of a browser session.
    fresh = TestClient(app)
    r2 = fresh.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == "grace@example.com"


def test_invalid_bearer_token_returns_401(anon_client):
    r = anon_client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401
