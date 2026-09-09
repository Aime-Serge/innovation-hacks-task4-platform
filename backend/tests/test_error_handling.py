from fastapi.testclient import TestClient

from app.main import app
from app.repositories.user_repo import user_repository


def test_unhandled_exception_returns_500_with_generic_body(monkeypatch):
    def boom(self):
        raise RuntimeError("simulated unexpected failure")

    monkeypatch.setattr(user_repository.__class__, "list", boom)

    # raise_server_exceptions=False: TestClient defaults to re-raising
    # exceptions for debugging; disabling that is what actually exercises
    # the global handler's HTTP response path instead of the exception
    # propagating up through the test.
    client = TestClient(app, raise_server_exceptions=False)
    r = client.get("/users")

    assert r.status_code == 500
    body = r.json()
    assert body == {
        "error": {
            "code": "internal_server_error",
            "message": "An unexpected error occurred.",
            "details": None,
        }
    }
    # no leaked internals: the RuntimeError text must not appear anywhere
    assert "simulated unexpected failure" not in r.text
