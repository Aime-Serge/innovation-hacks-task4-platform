"""TC-240 to TC-262, TC-304, TC-312 to TC-315: errors, headers, limits, logs, health, feeds."""

import json
import logging
from collections.abc import AsyncIterator
from datetime import date

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, load_settings
from app.core.logging import LOGGER_NAME, JsonFormatter
from tests.conftest import (
    DEV,
    LEAD,
    Env,
    build_env,
    error_code,
    make_project,
    make_settings,
    make_task,
)


class Capture(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(self.format(record))


async def test_tc240_every_error_uses_the_envelope_with_request_id(env: Env) -> None:
    cases = [
        await env.client.get("/api/v1/nope", headers=env.auth(DEV)),
        await env.client.get("/api/v1/projects"),
        await env.client.post("/api/v1/auth/login", json={}),
        await env.client.delete("/api/v1/auth/me", headers=env.auth(DEV)),
    ]
    for response in cases:
        assert response.status_code >= 400
        error = response.json()["error"]
        assert {"code", "message", "requestId"} <= error.keys()
        assert error["requestId"] == response.headers["x-request-id"]


async def test_tc241_unexpected_exception_is_a_generic_500_without_a_trace(env: Env) -> None:
    async def boom() -> None:
        raise RuntimeError("secret internals /srv/app/secret.py")

    env.app.add_api_route("/boom", boom)
    response = await env.client.get("/boom")
    assert response.status_code == 500
    assert error_code(response) == "INTERNAL_ERROR"
    assert "secret" not in response.text
    assert "Traceback" not in response.text


async def test_tc242_wrong_method_is_405_in_the_envelope(env: Env) -> None:
    response = await env.client.put("/api/v1/projects", headers=env.auth(DEV))
    assert response.status_code == 405
    assert "error" in response.json()


async def test_tc250_malformed_json_is_400_and_bad_fields_are_422(env: Env) -> None:
    broken = await env.client.post(
        "/api/v1/projects",
        content=b"{not json",
        headers={**env.auth(DEV), "content-type": "application/json"},
    )
    assert broken.status_code == 400
    assert error_code(broken) == "MALFORMED_REQUEST"
    wrong_type = await env.client.post("/api/v1/projects", json={"name": 5}, headers=env.auth(DEV))
    assert wrong_type.status_code == 422
    assert wrong_type.json()["error"]["details"][0]["field"] == "name"


async def test_tc251_unknown_fields_and_query_params_are_rejected(env: Env) -> None:
    body = await env.client.post(
        "/api/v1/projects", json={"name": "X", "surprise": 1}, headers=env.auth(DEV)
    )
    assert body.status_code == 422
    query = await env.client.get("/api/v1/projects?foo=1", headers=env.auth(DEV))
    assert query.status_code == 422


async def test_tc252_pagination_bounds_and_unknown_sort_are_422(env: Env) -> None:
    for query in ("pageSize=101", "pageSize=0", "page=0", "sort=password", "page=abc"):
        response = await env.client.get(f"/api/v1/tasks?{query}", headers=env.auth(DEV))
        assert response.status_code == 422, query


async def test_tc253_strings_are_trimmed_and_blank_names_rejected(env: Env) -> None:
    blank = await env.client.post("/api/v1/projects", json={"name": "   "}, headers=env.auth(DEV))
    assert blank.status_code == 422
    long_name = await env.client.post(
        "/api/v1/projects", json={"name": "x" * 500}, headers=env.auth(DEV)
    )
    assert long_name.status_code == 422


async def test_tc260_status_codes_follow_the_table(env: Env) -> None:
    project = await make_project(env, DEV)
    created = await env.client.get(f"/api/v1/projects/{project['id']}", headers=env.auth(DEV))
    assert created.status_code == 200
    deleted = await env.client.delete(f"/api/v1/projects/{project['id']}", headers=env.auth(DEV))
    assert deleted.status_code == 204
    assert deleted.content == b""


async def test_tc261_wrong_content_type_is_415_and_oversized_body_is_413(env: Env) -> None:
    wrong = await env.client.post(
        "/api/v1/projects",
        content="name=x",
        headers={**env.auth(DEV), "content-type": "text/plain"},
    )
    assert wrong.status_code == 415
    assert error_code(wrong) == "UNSUPPORTED_MEDIA_TYPE"
    big = await env.client.post(
        "/api/v1/projects",
        content=b'{"name":"' + b"a" * 1_100_000 + b'"}',
        headers={**env.auth(DEV), "content-type": "application/json"},
    )
    assert big.status_code == 413
    assert error_code(big) == "PAYLOAD_TOO_LARGE"


async def test_tc262_streamed_body_over_the_limit_is_413(env: Env) -> None:
    async def stream() -> AsyncIterator[bytes]:
        for _ in range(12):
            yield b"a" * 100_000

    response = await env.client.post(
        "/api/v1/projects",
        content=stream(),
        headers={**env.auth(DEV), "content-type": "application/json"},
    )
    assert response.status_code == 413


async def test_tc304_security_headers_on_every_response(env: Env) -> None:
    for response in (
        await env.client.get("/healthz"),
        await env.client.get("/api/v1/projects", headers=env.auth(DEV)),
        await env.client.get("/api/v1/projects"),
    ):
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert "default-src 'none'" in response.headers["content-security-policy"]
    login = await env.login(LEAD)
    assert login.headers["cache-control"] == "no-store"


async def test_tc312_cors_allows_only_listed_origins() -> None:
    async for app_env in build_env("empty", cors_origins=["https://app.example.com"]):
        allowed = await app_env.client.get(
            "/healthz", headers={"Origin": "https://app.example.com"}
        )
        assert allowed.headers["access-control-allow-origin"] == "https://app.example.com"
        denied = await app_env.client.get("/healthz", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in denied.headers
        preflight = await app_env.client.options(
            "/api/v1/projects",
            headers={
                "Origin": "https://app.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert preflight.status_code == 200


async def test_tc313_request_id_is_echoed_or_generated(env: Env) -> None:
    supplied = await env.client.get("/healthz", headers={"X-Request-ID": "trace-123"})
    assert supplied.headers["x-request-id"] == "trace-123"
    generated = await env.client.get("/healthz", headers={"X-Request-ID": "bad id with spaces!"})
    assert generated.headers["x-request-id"] != "bad id with spaces!"
    assert len(generated.headers["x-request-id"]) >= 32


async def test_tc314_logs_are_json_and_never_hold_secrets(env: Env) -> None:
    capture = Capture()
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    capture.setFormatter(JsonFormatter())
    logger.addHandler(capture)
    try:
        secret_body = {"email": LEAD, "password": "hunter2-hunter2-hunter2"}
        await env.client.post("/api/v1/auth/login", json=secret_body)
        await env.client.get("/api/v1/auth/me", headers=env.auth(LEAD))
    finally:
        logger.removeHandler(capture)
    assert capture.lines
    text = "\n".join(capture.lines)
    assert "hunter2" not in text
    assert env.tokens[LEAD] not in text
    assert "Bearer" not in text
    record = json.loads(capture.lines[-1])
    assert {"requestId", "method", "path", "status", "durationMs"} <= record.keys()


async def test_tc315_timestamps_are_server_utc_and_dates_are_iso(env: Env) -> None:
    project = await make_project(env, DEV, dueDate="2026-12-01")
    assert project["createdAt"] == "2026-09-20T12:00:00Z"
    assert project["updatedAt"] == "2026-09-20T12:00:00Z"
    assert project["dueDate"] == "2026-12-01"
    env.clock.advance(minutes=10)  # inside the 15 minute token life
    changed = await env.client.patch(
        f"/api/v1/projects/{project['id']}", json={"name": "New"}, headers=env.auth(DEV)
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["updatedAt"] == "2026-09-20T12:10:00Z"
    assert changed.json()["createdAt"] == "2026-09-20T12:00:00Z"


async def test_tc316_health_and_readiness(env: Env) -> None:
    assert (await env.client.get("/healthz")).json() == {"status": "ok"}
    assert (await env.client.get("/readyz")).status_code == 200

    async def not_ready() -> bool:
        return False

    env.container.is_ready = not_ready  # type: ignore[method-assign]  # a stub for the 503 path
    down = await env.client.get("/readyz")
    assert down.status_code == 503
    assert error_code(down) == "SERVICE_UNAVAILABLE"


async def test_tc317_docs_are_on_in_development_and_off_in_production() -> None:
    async for dev in build_env("empty", app_env="development", docs_enabled=None):
        assert (await dev.client.get("/docs")).status_code == 200
        assert (await dev.client.get("/openapi.json")).status_code == 200
    async for prod in build_env(None, app_env="production", docs_enabled=None):
        assert (await prod.client.get("/docs")).status_code == 404
        assert (await prod.client.get("/openapi.json")).status_code == 404
        hsts = await prod.client.get("/healthz")
        assert "strict-transport-security" in hsts.headers


async def test_tc318_activity_feed_records_and_limits(env: Env) -> None:
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    for step in ("in_progress", "in_review", "done"):
        await env.client.patch(
            f"/api/v1/tasks/{task['id']}/status", json={"status": step}, headers=env.auth(DEV)
        )
        env.clock.advance(seconds=1)  # the feed is newest first, so events need distinct times
    feed = (await env.client.get("/api/v1/activity?limit=2", headers=env.auth(DEV))).json()
    assert len(feed["items"]) == 2
    assert feed["items"][0]["type"] == "completed"  # ADR-217
    assert feed["items"][0]["at"] >= feed["items"][1]["at"]
    assert (
        await env.client.get("/api/v1/activity?limit=51", headers=env.auth(DEV))
    ).status_code == 422


async def test_tc319_dashboard_summary_counts(seeded: Env) -> None:
    body = (await seeded.client.get("/api/v1/dashboard/summary", headers=seeded.auth(DEV))).json()
    assert body["activeProjects"] == 5
    assert body["openTasks"] == 41
    assert body["completionRate"] == 32
    today = date(2026, 9, 20)
    for task in body["upcomingDeadlines"]:
        assert today <= date.fromisoformat(task["dueDate"]) <= date(2026, 9, 27)
        assert task["status"] != "done"


def test_tc320_settings_reject_a_short_secret() -> None:
    with pytest.raises(ValidationError, match="32 bytes"):
        Settings(_env_file=None, secret_key=SecretStr("short"))


def test_tc321_settings_reject_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="wildcard"):
        make_settings(cors_origins=["*"])


def test_tc322_missing_secret_stops_startup_and_names_the_variable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.chdir("/")  # so no .env file is picked up
    with pytest.raises(SystemExit, match="SECRET_KEY"):
        load_settings()


async def test_tc323_welcome_page_is_public_static_html_with_its_own_csp(env: Env) -> None:
    import base64
    import hashlib
    import re

    response = await env.client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "<script" not in response.text.lower()
    assert "DevDash API" in response.text
    csp = response.headers["content-security-policy"]
    assert csp.count("default-src") == 1  # the middleware did not add a second policy
    style = re.search(r"<style>(.*?)</style>", response.text, re.S)
    assert style is not None
    digest = base64.b64encode(hashlib.sha256(style.group(1).encode()).digest()).decode()
    assert f"'sha256-{digest}'" in csp
    assert response.headers["x-content-type-options"] == "nosniff"


async def test_tc323_welcome_page_links_docs_only_when_they_exist() -> None:
    async for dev in build_env(None, docs_enabled=True):
        assert 'href="/docs"' in (await dev.client.get("/")).text
    async for prod in build_env(None, app_env="production", docs_enabled=None):
        page = (await prod.client.get("/")).text
        assert 'href="/docs"' not in page
        assert "off in this environment" in page
        assert (await prod.client.post("/")).status_code == 405


async def test_tc324_text_the_database_cannot_store_is_a_422_not_a_500(env: Env) -> None:
    """ADR-327: a NUL character and an unpaired surrogate are refused at the edge."""
    for name in ("Ada\x00Lovelace", "Ada\ud800"):
        response = await env.client.post(
            "/api/v1/projects",
            content=json.dumps({"name": name}),
            headers={**env.auth(DEV), "content-type": "application/json"},
        )
        assert response.status_code == 422, name
    login = await env.login("a\x00@example.com", "whatever-password-1")
    assert login.status_code == 422  # the schema excludes a NUL from every text field
    query = await env.client.get("/api/v1/tasks?q=%00", headers=env.auth(DEV))
    assert query.status_code == 422
