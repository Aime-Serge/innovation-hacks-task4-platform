"""TC-201 to TC-208, TC-301 to TC-303: registration, login, users and roles."""

from datetime import timedelta

import jwt
import pytest

from tests.conftest import DEV, LEAD, NOW, OTHER, PASSWORD, SECRET, Env, error_code, make_settings

NEW = {"name": "Ada Lovelace", "email": "ada@example.com", "password": "correct-horse-battery"}


async def test_tc201_register_returns_201_location_and_no_secrets(env: Env) -> None:
    response = await env.client.post("/api/v1/users", json=NEW)
    assert response.status_code == 201
    body = response.json()
    assert response.headers["location"] == f"/api/v1/users/{body['id']}"
    assert body["role"] == "developer"
    assert "password" not in body
    assert "passwordHash" not in body
    assert "password_hash" not in body


async def test_tc202_duplicate_email_is_409_case_insensitive(env: Env) -> None:
    await env.client.post("/api/v1/users", json=NEW)
    again = await env.client.post("/api/v1/users", json={**NEW, "email": "ADA@Example.com"})
    assert again.status_code == 409
    assert error_code(again) == "EMAIL_ALREADY_EXISTS"


async def test_tc203_client_cannot_set_role_id_or_timestamps(env: Env) -> None:
    for extra in ({"role": "lead"}, {"id": "x"}, {"createdAt": "2020-01-01T00:00:00Z"}):
        response = await env.client.post("/api/v1/users", json={**NEW, **extra})
        assert response.status_code == 422, extra
        assert error_code(response) == "VALIDATION_ERROR"


async def test_tc204_weak_password_and_bad_email_are_422_with_field_details(env: Env) -> None:
    response = await env.client.post(
        "/api/v1/users", json={"name": "A", "email": "nope", "password": "short"}
    )
    assert response.status_code == 422
    fields = {d["field"] for d in response.json()["error"]["details"]}
    assert {"email", "password"} <= fields


async def test_tc205_login_success_returns_bearer_token(env: Env) -> None:
    response = await env.login(LEAD)
    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] == 900
    claims = jwt.decode(
        body["accessToken"],
        SECRET,
        algorithms=["HS256"],
        audience="devdash-clients",
        issuer="devdash-api",
        options={"verify_iat": False, "verify_exp": False},  # the fake clock is not wall time
    )
    assert claims["sub"]


async def test_tc206_unknown_email_and_wrong_password_are_identical_401(env: Env) -> None:
    unknown = await env.login("ghost@example.com", "whatever-password-1")
    wrong = await env.login(LEAD, "wrong-password-123")
    assert unknown.status_code == wrong.status_code == 401
    assert error_code(unknown) == error_code(wrong) == "INVALID_CREDENTIALS"
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]


async def test_tc207_me_returns_current_user(env: Env) -> None:
    response = await env.client.get("/api/v1/auth/me", headers=env.auth(LEAD))
    assert response.status_code == 200
    assert response.json()["email"] == LEAD


async def test_tc208_missing_malformed_and_expired_tokens_are_401(env: Env) -> None:
    for headers in ({}, {"Authorization": "Bearer nonsense"}, {"Authorization": "Basic abc"}):
        response = await env.client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401, headers
        assert error_code(response) == "UNAUTHENTICATED"
    env.clock.advance(seconds=901)
    expired = await env.client.get("/api/v1/auth/me", headers=env.auth(LEAD))
    assert expired.status_code == 401


@pytest.mark.filterwarnings("ignore::jwt.warnings.InsecureKeyLengthWarning")
async def test_tc301_token_with_wrong_algorithm_or_audience_is_rejected(env: Env) -> None:
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(LEAD))).json()
    base = {
        "sub": me["id"],
        "iss": "devdash-api",
        "aud": "devdash-clients",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(minutes=5)).timestamp()),
    }
    forged = {
        "none": jwt.encode(base, None, algorithm="none"),
        "wrong-secret": jwt.encode(base, "x" * 40, algorithm="HS256"),
        "wrong-aud": jwt.encode({**base, "aud": "other"}, SECRET, algorithm="HS256"),
        "wrong-iss": jwt.encode({**base, "iss": "other"}, SECRET, algorithm="HS256"),
        "hs512": jwt.encode(base, SECRET, algorithm="HS512"),
    }
    for name, token in forged.items():
        response = await env.client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401, name


async def test_tc302_token_for_deleted_user_is_401(env: Env) -> None:
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    deleted = await env.client.delete(f"/api/v1/users/{me['id']}", headers=env.auth(LEAD))
    assert deleted.status_code == 204
    after = await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))
    assert after.status_code == 401


async def test_tc303_login_is_rate_limited_with_retry_after() -> None:
    from tests.conftest import build_env

    async for limited in build_env("empty", rate_limit_attempts=3):
        limited.clock.advance(seconds=61)  # setup logins already used part of the window
        codes = [(await limited.login(LEAD, "bad-password-123")).status_code for _ in range(5)]
        assert codes[:3] == [401, 401, 401]
        assert codes[3:] == [429, 429]
        blocked = await limited.login(LEAD, "bad-password-123")
        assert blocked.headers["retry-after"].isdigit()
        assert error_code(blocked) == "RATE_LIMITED"
        limited.clock.advance(seconds=61)
        assert (await limited.login(LEAD, PASSWORD)).status_code == 200


async def test_tc305_registration_is_rate_limited() -> None:
    from tests.conftest import build_env

    async for limited in build_env("empty", rate_limit_attempts=2):
        codes = []
        for i in range(4):
            r = await limited.client.post(
                "/api/v1/users", json={**NEW, "email": f"u{i}@example.com"}
            )
            codes.append(r.status_code)
        assert codes == [201, 201, 429, 429]


async def test_tc306_user_list_is_paged_searchable_and_hides_hashes(env: Env) -> None:
    response = await env.client.get("/api/v1/users?q=amara&pageSize=1", headers=env.auth(DEV))
    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 1
    assert body["items"][0]["email"] == LEAD
    assert "passwordHash" not in response.text


async def test_tc307_lead_changes_role_member_cannot(env: Env) -> None:
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    url = f"/api/v1/users/{other['id']}"
    denied = await env.client.patch(url, json={"role": "lead"}, headers=env.auth(OTHER))
    assert denied.status_code == 403
    assert error_code(denied) == "FORBIDDEN"
    allowed = await env.client.patch(url, json={"role": "lead"}, headers=env.auth(LEAD))
    assert allowed.status_code == 200
    assert allowed.json()["role"] == "lead"


async def test_tc308_member_edits_self_not_others(env: Env) -> None:
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(DEV))).json()
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    ok = await env.client.patch(
        f"/api/v1/users/{me['id']}", json={"name": "Renamed"}, headers=env.auth(DEV)
    )
    assert ok.status_code == 200
    assert ok.json()["name"] == "Renamed"
    no = await env.client.patch(
        f"/api/v1/users/{other['id']}", json={"name": "Nope"}, headers=env.auth(DEV)
    )
    assert no.status_code == 403


async def test_tc309_last_lead_cannot_be_deleted_or_demoted(env: Env) -> None:
    lead = (await env.client.get("/api/v1/auth/me", headers=env.auth(LEAD))).json()
    url = f"/api/v1/users/{lead['id']}"
    deleted = await env.client.delete(url, headers=env.auth(LEAD))
    assert deleted.status_code == 409
    assert error_code(deleted) == "LAST_LEAD"
    demoted = await env.client.patch(url, json={"role": "developer"}, headers=env.auth(LEAD))
    assert demoted.status_code == 409
    assert error_code(demoted) == "LAST_LEAD"


async def test_tc310_user_who_owns_projects_cannot_be_deleted(env: Env) -> None:
    from tests.conftest import make_project

    await make_project(env, DEV)
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(DEV))).json()
    response = await env.client.delete(f"/api/v1/users/{me['id']}", headers=env.auth(LEAD))
    assert response.status_code == 409
    assert error_code(response) == "USER_OWNS_PROJECTS"


async def test_tc311_empty_and_null_patches_are_rejected(env: Env) -> None:
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(DEV))).json()
    url = f"/api/v1/users/{me['id']}"
    assert (await env.client.patch(url, json={}, headers=env.auth(DEV))).status_code == 422
    assert (
        await env.client.patch(url, json={"name": None}, headers=env.auth(DEV))
    ).status_code == 422


def test_settings_fixture_uses_short_argon2() -> None:
    assert make_settings().argon2_memory_kib == 8
    assert PASSWORD
