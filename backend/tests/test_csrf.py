from fastapi.testclient import TestClient

from app.main import app


def test_mutating_request_without_fetch_header_returns_403():
    """No X-Requested-With header — the shape of a plain HTML form
    submission, which a malicious cross-site page can trigger but can
    never attach a custom header to."""
    plain_client = TestClient(app)
    r = plain_client.post(
        "/auth/register",
        json={"name": "Eve", "email": "eve@example.com", "password": "supersecret"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "csrf_check_failed"


def test_mutating_request_with_fetch_header_passes_csrf_check(anon_client):
    """anon_client (see conftest) sends the header on every request, same
    as the real frontend — this should get past the CSRF check and reach
    normal application logic (proven by getting a real application
    response, not a 403)."""
    r = anon_client.post(
        "/auth/register",
        json={"name": "Eve", "email": "eve@example.com", "password": "supersecret"},
    )
    assert r.status_code != 403


def test_get_request_does_not_require_fetch_header():
    """Only state-changing methods are gated — a GET (e.g. a browser
    following a plain link) is never blocked."""
    plain_client = TestClient(app)
    r = plain_client.get("/health")
    assert r.status_code == 200
