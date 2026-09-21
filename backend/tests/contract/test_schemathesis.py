"""TC-250 to TC-253: property-based contract testing of every operation with Schemathesis.

The API runs for real (uvicorn in a thread, on either backend), seeded, so ids exist and generated
calls reach real code paths. Every response must match the documented schema, status code and
content type, and none may be a 5xx. `--backend sql` runs the same checks against PostgreSQL.
"""

import socket
import threading
import time
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
import schemathesis
import uvicorn
from pydantic import SecretStr

from app.main import create_app
from scripts.export_openapi import generate
from tests import conftest, sql_support
from tests.conftest import LEAD, PASSWORD, make_settings

pytestmark = pytest.mark.contract

STATE: dict[str, str] = {}

schema = schemathesis.openapi.from_dict(generate())
schema.config.generation.update(max_examples=25, database=None)


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="module")
def live_api(request: pytest.FixtureRequest) -> Iterator[str]:
    """The seeded API on a real port. With --backend sql it talks to the disposable PostgreSQL."""
    # The server seeds itself at startup (memory or an empty database), through its own lifespan.
    overrides: dict[str, Any] = {
        "rate_limit_attempts": 1_000_000,
        "seed_profile": "default",
        "seed_password": SecretStr(PASSWORD),
    }
    if conftest.BACKEND == "sql":
        server = request.getfixturevalue("postgres")
        name = request.getfixturevalue("worker_db")
        sql_support.run_coro(sql_support.empty_tables(server, name))
        overrides |= {"storage_backend": "sql", "database_url": SecretStr(server.url("app", name))}
    settings = make_settings(**overrides)

    port = free_port()
    config = uvicorn.Config(create_app(settings), host="127.0.0.1", port=port, log_level="error")
    server_thread = uvicorn.Server(config)
    thread = threading.Thread(target=server_thread.run, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 30
    while True:
        try:
            if httpx.get(f"{base}/readyz").status_code == 200:
                break
        except httpx.HTTPError:
            pass
        assert time.monotonic() < deadline, "the API did not start"
        time.sleep(0.2)
    login = httpx.post(f"{base}/api/v1/auth/login", json={"email": LEAD, "password": PASSWORD})
    STATE["token"] = login.json()["accessToken"]
    headers = {"Authorization": f"Bearer {STATE['token']}"}
    first = httpx.get(f"{base}/api/v1/projects?pageSize=1", headers=headers).json()["items"][0]
    STATE["project"] = first["id"]
    try:
        yield base
    finally:
        server_thread.should_exit = True
        thread.join(timeout=10)


@schema.auth()
class BearerAuth:
    """Schemathesis' auth provider: it can still send no token or a bad one to prove the 401."""

    def get(self, case: Any, context: Any) -> str:
        return "resolved-when-the-request-is-made"  # the live token exists only once the API is up

    def set(self, case: Any, data: str, context: Any) -> None:
        case.headers = case.headers or {}
        case.headers["Authorization"] = f"Bearer {STATE.get('token', data)}"


def is_positive(case: Any) -> bool:
    generation = getattr(case.meta, "generation", None)
    return generation is None or "positive" in str(generation.mode).lower()


@schema.parametrize()
def test_tc250_every_operation_conforms_to_its_documented_contract(
    case: Any, live_api: str
) -> None:
    body = case.body if isinstance(case.body, dict) else {}
    if is_positive(case) and case.path == "/api/v1/tasks" and case.method == "POST":
        # A random projectId never exists, and "unknown reference" is a documented 422 (FR-214).
        # Point it at a real one so the schema-valid case is exercised end to end.
        body["projectId"] = STATE["project"]
    if is_positive(case) and "assigneeId" in body:
        body["assigneeId"] = None
    case.call_and_validate(base_url=live_api)
