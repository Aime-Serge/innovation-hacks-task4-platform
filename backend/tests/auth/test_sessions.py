"""Sessions: login pair, rotation, reuse detection, logout, expiry, registration switch.

TC-402, TC-403, TC-406, TC-407, TC-408, TC-468 (FR-403, FR-406, FR-407, BR-404, BR-413, BR-414).
"""

import asyncio
from typing import Any

import pytest

from app.services.session_service import hash_token
from tests.conftest import DEV, Env, build_env, error_code, signup

REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"


async def login(env: Env) -> dict[str, Any]:
    response = await env.login(DEV)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def refresh(env: Env, token: str) -> Any:
    return await env.client.post(REFRESH, json={"refreshToken": token})


async def test_tc402_login_returns_an_access_and_a_refresh_token(env: Env) -> None:
    body = await login(env)
    assert (body["tokenType"], body["expiresIn"], body["refreshExpiresIn"]) == (
        "bearer",
        900,
        604800,
    )
    assert len(body["refreshToken"]) >= 40
    me = await env.client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {body['accessToken']}"}
    )
    assert me.status_code == 200


async def test_tc406_refresh_rotates_and_the_old_token_stops_working(env: Env) -> None:
    first = await login(env)
    second = await refresh(env, first["refreshToken"])
    assert second.status_code == 200, second.text
    pair = second.json()
    assert pair["refreshToken"] != first["refreshToken"]
    me = await env.client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {pair['accessToken']}"}
    )
    assert me.status_code == 200
    again = await refresh(env, first["refreshToken"])
    assert again.status_code == 401
    assert error_code(again) == "REFRESH_TOKEN_INVALID"


async def test_tc406_only_a_hash_of_the_token_is_stored(env: Env) -> None:
    raw = (await login(env))["refreshToken"]
    async with env.container.uow() as uow:
        row = await uow.refresh_tokens.get_by_hash(hash_token(raw))
        assert row is not None
        assert row.token_hash != raw
        assert len(row.token_hash) == 64
        assert await uow.refresh_tokens.get_by_hash(raw) is None  # the token itself is not a key


async def test_tc407_reusing_a_used_token_revokes_the_whole_session(env: Env) -> None:
    first = await login(env)
    second = (await refresh(env, first["refreshToken"])).json()
    reused = await refresh(env, first["refreshToken"])  # a copy of the first token turns up
    assert reused.status_code == 401
    assert error_code(reused) == "REFRESH_TOKEN_INVALID"
    # The newest token in the family was revoked too, so a thief and the person are both out.
    assert (await refresh(env, second["refreshToken"])).status_code == 401


async def test_tc403_logout_revokes_the_session_and_is_idempotent(env: Env) -> None:
    token = (await login(env))["refreshToken"]
    assert (await env.client.post(LOGOUT, json={"refreshToken": token})).status_code == 204
    assert (await refresh(env, token)).status_code == 401
    assert (await env.client.post(LOGOUT, json={"refreshToken": token})).status_code == 204
    unknown = await env.client.post(LOGOUT, json={"refreshToken": "x" * 48})
    assert unknown.status_code == 204  # never says whether a token was known


async def test_tc403_logout_of_one_session_leaves_another_alone(env: Env) -> None:
    one, two = await login(env), await login(env)
    await env.client.post(LOGOUT, json={"refreshToken": one["refreshToken"]})
    assert (await refresh(env, two["refreshToken"])).status_code == 200


async def test_tc406_an_expired_refresh_token_is_refused(env: Env) -> None:
    token = (await login(env))["refreshToken"]
    env.clock.advance(days=8)
    response = await refresh(env, token)
    assert response.status_code == 401
    assert error_code(response) == "REFRESH_TOKEN_INVALID"


async def test_tc406_a_malformed_refresh_body_is_422(env: Env) -> None:
    for body in ({}, {"refreshToken": "short"}, {"refreshToken": "x" * 48, "extra": 1}):
        assert (await env.client.post(REFRESH, json=body)).status_code == 422
        assert (await env.client.post(LOGOUT, json=body)).status_code == 422


async def test_tc406_refreshing_too_often_is_rate_limited(env: Env) -> None:
    codes = [(await refresh(env, "z" * 48)).status_code for _ in range(1200)]
    assert 429 in codes


async def test_tc408_registration_can_be_switched_off() -> None:
    async for env in build_env("empty", registration_enabled=False):
        payload = signup(name="New Person", email="new@example.com", password="a-long-password-1")
        response = await env.client.post("/api/v1/users", json=payload)
        assert response.status_code == 403
        assert error_code(response) == "REGISTRATION_DISABLED"
        assert (await env.login(DEV)).status_code == 200  # signing in is unaffected


async def test_tc468_expired_refresh_tokens_are_purged_after_30_days(env: Env) -> None:
    await login(env)
    env.clock.advance(days=7 + 29)
    assert await env.container.sessions.purge() == 0  # expired for 29 days: kept
    env.clock.advance(days=2)
    assert await env.container.sessions.purge() >= 1  # expired for more than 30 days: deleted


@pytest.mark.sql
async def test_tc407_two_parallel_refreshes_of_one_token_do_not_both_succeed(env: Env) -> None:
    token = (await login(env))["refreshToken"]
    results = await asyncio.gather(refresh(env, token), refresh(env, token))
    assert sorted(r.status_code for r in results) == [200, 401]
