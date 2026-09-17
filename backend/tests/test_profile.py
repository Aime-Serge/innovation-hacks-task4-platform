import io
from urllib.parse import parse_qs, urlparse

NIL_UUID = "00000000-0000-0000-0000-000000000000"


def _extract_token(reset_url: str) -> str:
    return parse_qs(urlparse(reset_url).query)["token"][0]


# --- forgot-password / reset-password -------------------------------------


def test_forgot_password_existing_email_returns_dev_reset_url(anon_client, user):
    r = anon_client.post("/auth/forgot-password", json={"email": user["email"]})
    assert r.status_code == 200
    body = r.json()
    assert body["dev_reset_url"] is not None
    assert "/reset-password?token=" in body["dev_reset_url"]


def test_forgot_password_unknown_email_returns_200_with_no_url(anon_client):
    """Same status/message shape either way — only the (dev-mode-only)
    reset URL differs, which is the one documented, deliberate exception
    to the no-enumeration rule this build's forgot-password takes."""
    r = anon_client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    body = r.json()
    assert body["dev_reset_url"] is None


def test_reset_password_with_valid_token_lets_new_password_login(anon_client, user):
    forgot = anon_client.post("/auth/forgot-password", json={"email": user["email"]})
    token = _extract_token(forgot.json()["dev_reset_url"])

    reset = anon_client.post(
        "/auth/reset-password", json={"token": token, "new_password": "brandnewpassword"}
    )
    assert reset.status_code == 204

    login = anon_client.post(
        "/auth/login", json={"email": user["email"], "password": "brandnewpassword"}
    )
    assert login.status_code == 200

    old_login = anon_client.post(
        "/auth/login", json={"email": user["email"], "password": "supersecret"}
    )
    assert old_login.status_code == 401


def test_reset_password_token_is_single_use(anon_client, user):
    forgot = anon_client.post("/auth/forgot-password", json={"email": user["email"]})
    token = _extract_token(forgot.json()["dev_reset_url"])

    first = anon_client.post(
        "/auth/reset-password", json={"token": token, "new_password": "brandnewpassword"}
    )
    assert first.status_code == 204

    second = anon_client.post(
        "/auth/reset-password", json={"token": token, "new_password": "anotherpassword"}
    )
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "bad_request"


def test_reset_password_garbage_token_returns_400(anon_client):
    r = anon_client.post(
        "/auth/reset-password", json={"token": "not-a-real-token", "new_password": "whatever123"}
    )
    assert r.status_code == 400


def test_reset_password_expired_token_returns_400(anon_client, user, monkeypatch):
    import app.routers.auth as auth_module
    from datetime import datetime, timedelta, timezone

    # Force the token to already be expired at creation time.
    monkeypatch.setattr(
        auth_module,
        "timedelta",
        lambda **kwargs: timedelta(minutes=-1),
    )
    forgot = anon_client.post("/auth/forgot-password", json={"email": user["email"]})
    token = _extract_token(forgot.json()["dev_reset_url"])

    r = anon_client.post(
        "/auth/reset-password", json={"token": token, "new_password": "brandnewpassword"}
    )
    assert r.status_code == 400


# --- change-password --------------------------------------------------------


def test_change_password_with_correct_current_password(client, user):
    r = client.post(
        f"/users/{user['id']}/change-password",
        json={"current_password": "supersecret", "new_password": "newpassword123"},
    )
    assert r.status_code == 204

    login = client.post(
        "/auth/login", json={"email": user["email"], "password": "newpassword123"}
    )
    assert login.status_code == 200


def test_change_password_with_wrong_current_password_returns_401(client, user):
    r = client.post(
        f"/users/{user['id']}/change-password",
        json={"current_password": "totally-wrong", "new_password": "newpassword123"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_change_password_for_other_user_returns_403(client, other_client, user):
    other_id = other_client.get("/auth/me").json()["id"]
    r = client.post(
        f"/users/{other_id}/change-password",
        json={"current_password": "whatever", "new_password": "newpassword123"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_change_password_requires_auth(anon_client, user):
    r = anon_client.post(
        f"/users/{user['id']}/change-password",
        json={"current_password": "supersecret", "new_password": "newpassword123"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


# --- avatar ------------------------------------------------------------------

_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000100000005ac9c8d0000000049454e44ae426082"
)


def test_avatar_upload_get_and_delete_round_trip(client, user):
    upload = client.post(
        f"/users/{user['id']}/avatar",
        files={"file": ("avatar.png", io.BytesIO(_TINY_PNG), "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["has_avatar"] is True

    fetched = client.get(f"/users/{user['id']}/avatar")
    assert fetched.status_code == 200
    assert fetched.headers["content-type"] == "image/png"
    assert fetched.content == _TINY_PNG

    deleted = client.delete(f"/users/{user['id']}/avatar")
    assert deleted.status_code == 200
    assert deleted.json()["has_avatar"] is False

    gone = client.get(f"/users/{user['id']}/avatar")
    assert gone.status_code == 404


def test_avatar_rejects_disallowed_content_type(client, user):
    r = client.post(
        f"/users/{user['id']}/avatar",
        files={"file": ("shell.sh", io.BytesIO(b"#!/bin/sh\necho hi"), "application/x-sh")},
    )
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_media_type"


def test_avatar_rejects_oversized_file(client, user):
    oversized = b"\x00" * (600_000)
    r = client.post(
        f"/users/{user['id']}/avatar",
        files={"file": ("avatar.png", io.BytesIO(oversized), "image/png")},
    )
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "payload_too_large"


def test_avatar_rejects_empty_file(client, user):
    r = client.post(
        f"/users/{user['id']}/avatar",
        files={"file": ("avatar.png", io.BytesIO(b""), "image/png")},
    )
    assert r.status_code == 422


def test_avatar_upload_for_other_user_returns_403(client, other_client, user):
    other_id = other_client.get("/auth/me").json()["id"]
    r = client.post(
        f"/users/{other_id}/avatar",
        files={"file": ("avatar.png", io.BytesIO(_TINY_PNG), "image/png")},
    )
    assert r.status_code == 403


def test_avatar_get_for_nonexistent_user_returns_404(client):
    r = client.get(f"/users/{NIL_UUID}/avatar")
    assert r.status_code == 404


def test_get_user_without_avatar_reports_has_avatar_false(client, user):
    r = client.get(f"/users/{user['id']}")
    assert r.status_code == 200
    assert r.json()["has_avatar"] is False
