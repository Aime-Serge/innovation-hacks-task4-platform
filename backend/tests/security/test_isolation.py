"""Two-user isolation, generated from the section 6 matrix (TC-410 to TC-413; BR-401 to BR-403).

Each case names an operation and the status every kind of caller must get: O owner, S assignee
of a task in the project, L lead, X stranger. A project-scoped operation added to the API without a
row here fails `test_tc410_every_project_scoped_operation_has_a_row`.
"""

from typing import Any

import pytest

from tests.conftest import DEV, LEAD, OTHER, Env, make_project, make_task, signup

ASSIGNEE = "assignee@example.com"
PASSWORD = "assignee-password-1"
KINDS = ("O", "S", "L", "X")

# (method, path template, body, {kind: expected status}). {p} project id, {t} task id.
CASES: list[tuple[str, str, dict[str, Any] | None, dict[str, int]]] = [
    ("get", "/api/v1/projects/{p}", None, {"O": 200, "S": 200, "L": 200, "X": 404}),
    ("get", "/api/v1/projects/{p}/tasks", None, {"O": 200, "S": 200, "L": 200, "X": 404}),
    ("get", "/api/v1/tasks/{t}", None, {"O": 200, "S": 200, "L": 200, "X": 404}),
    ("patch", "/api/v1/projects/{p}", {"name": "New"}, {"O": 200, "S": 403, "L": 200, "X": 404}),
    # The project still has a task, so an authorised delete is a 409, not a 204; both are "allowed".
    ("delete", "/api/v1/projects/{p}", None, {"O": 409, "S": 403, "L": 409, "X": 404}),
    (
        "post",
        "/api/v1/tasks",
        {"projectId": "{p}", "title": "N"},
        {"O": 201, "S": 403, "L": 201, "X": 422},
    ),
    ("patch", "/api/v1/tasks/{t}", {"title": "New"}, {"O": 200, "S": 200, "L": 200, "X": 404}),
    (
        "patch",
        "/api/v1/tasks/{t}/status",
        {"status": "in_progress"},
        {"O": 200, "S": 200, "L": 200, "X": 404},
    ),
    ("delete", "/api/v1/tasks/{t}", None, {"O": 204, "S": 403, "L": 204, "X": 404}),
    # AI: suggesting tasks needs the right to create them; the other two need read access.
    (
        "post",
        "/api/v1/ai/projects/{p}/task-suggestions",
        None,
        {"O": 200, "S": 403, "L": 200, "X": 404},
    ),
    (
        "post",
        "/api/v1/ai/projects/{p}/prioritization",
        None,
        {"O": 200, "S": 200, "L": 200, "X": 404},
    ),
    ("post", "/api/v1/ai/projects/{p}/summary", None, {"O": 200, "S": 200, "L": 200, "X": 404}),
]


async def world(env: Env) -> dict[str, Any]:
    """A project owned by DEV with one task assigned to ASSIGNEE; OTHER is the stranger."""
    created = await env.client.post(
        "/api/v1/users",
        json=signup(name="Assignee Person", email=ASSIGNEE, password=PASSWORD),
    )
    assert created.status_code == 201
    env.tokens[ASSIGNEE] = (await env.login(ASSIGNEE, PASSWORD)).json()["accessToken"]
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"], DEV, assigneeId=created.json()["id"])
    return {
        "p": project["id"],
        "t": task["id"],
        "who": {"O": DEV, "S": ASSIGNEE, "L": LEAD, "X": OTHER},
    }


def fill(value: Any, ids: dict[str, str]) -> Any:
    if isinstance(value, str):
        return value.format(**ids)
    if isinstance(value, dict):
        return {k: fill(v, ids) for k, v in value.items()}
    return value


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize(
    ("method", "template", "body", "expected"),
    CASES,
    ids=[f"{m.upper()} {t}" for m, t, _, _ in CASES],
)
async def test_tc410_two_user_matrix(
    env: Env,
    method: str,
    template: str,
    body: dict[str, Any] | None,
    expected: dict[str, int],
    kind: str,
) -> None:
    w = await world(env)
    ids = {"p": w["p"], "t": w["t"]}
    response = await env.client.request(
        method.upper(),
        template.format(**ids),
        json=fill(body, ids) if body is not None else None,
        headers=env.auth(w["who"][kind]),
    )
    assert response.status_code == expected[kind], (method, template, kind, response.text)


async def test_tc410_every_project_scoped_operation_has_a_row(env: Env) -> None:
    spec = env.app.openapi()["paths"]
    scoped = {
        (m, p)
        for p, methods in spec.items()
        for m in methods
        if p.startswith("/api/v1/") and any(k in p for k in ("{projectId}", "{taskId}"))
    } | {("post", "/api/v1/tasks")}
    covered = {
        (m, t.replace("{p}", "{projectId}").replace("{t}", "{taskId}")) for m, t, _, _ in CASES
    }
    assert scoped == covered


async def test_tc411_lists_never_include_what_the_caller_may_not_read(env: Env) -> None:
    w = await world(env)
    stranger = env.auth(OTHER)
    for path, key in (("/api/v1/projects", "id"), ("/api/v1/tasks", "id")):
        items = (await env.client.get(path, headers=stranger)).json()["items"]
        assert w["p"] not in {i[key] for i in items} | {i.get("projectId") for i in items}
        assert w["t"] not in {i[key] for i in items}
    assert (await env.client.get("/api/v1/activity", headers=stranger)).json()["total"] == 0
    summary = (await env.client.get("/api/v1/dashboard/summary", headers=stranger)).json()
    assert (summary["activeProjects"], summary["openTasks"], summary["overdueTasks"]) == (0, 0, 0)


async def test_tc411_totals_never_count_unreadable_projects(env: Env) -> None:
    await world(env)
    as_owner = (await env.client.get("/api/v1/projects", headers=env.auth(DEV))).json()
    as_stranger = (await env.client.get("/api/v1/projects", headers=env.auth(OTHER))).json()
    assert (as_owner["total"], as_stranger["total"]) == (1, 0)
    as_lead = (await env.client.get("/api/v1/projects", headers=env.auth(LEAD))).json()
    assert as_lead["total"] == 1  # TC-413: a lead reads everything


async def test_tc410_assigning_a_task_grants_that_one_project_and_unassigning_removes_it(
    env: Env,
) -> None:
    w = await world(env)
    other_project = await make_project(env, DEV, name="Other project")
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    url = f"/api/v1/projects/{w['p']}"
    assert (await env.client.get(url, headers=env.auth(OTHER))).status_code == 404
    task = await make_task(env, w["p"], DEV, title="For the stranger", assigneeId=me["id"])
    assert (await env.client.get(url, headers=env.auth(OTHER))).status_code == 200
    hidden = f"/api/v1/projects/{other_project['id']}"
    assert (
        await env.client.get(hidden, headers=env.auth(OTHER))
    ).status_code == 404  # nothing else
    unassigned = await env.client.patch(
        f"/api/v1/tasks/{task['id']}", json={"assigneeId": None}, headers=env.auth(DEV)
    )
    assert unassigned.status_code == 200
    assert (await env.client.get(url, headers=env.auth(OTHER))).status_code == 404


async def test_tc412_email_is_shown_only_to_the_user_and_to_leads(env: Env) -> None:
    dev = (await env.client.get("/api/v1/auth/me", headers=env.auth(DEV))).json()
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    url = f"/api/v1/users/{dev['id']}"
    assert (await env.client.get(url, headers=env.auth(DEV))).json()["email"] == DEV
    assert (await env.client.get(url, headers=env.auth(LEAD))).json()["email"] == DEV
    assert (await env.client.get(url, headers=env.auth(OTHER))).json()["email"] is None
    listing = (await env.client.get("/api/v1/users", headers=env.auth(OTHER))).json()["items"]
    emails = {u["id"]: u["email"] for u in listing}
    assert emails[other["id"]] == OTHER  # their own
    assert all(v is None for k, v in emails.items() if k != other["id"])
