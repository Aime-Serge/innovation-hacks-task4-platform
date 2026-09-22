"""TC-300: the authorization matrix covers every operation and is enforced on each (FR-223)."""

from uuid import uuid4

import pytest

from tests.conftest import DEV, LEAD, OTHER, Env, error_code, make_project, make_task

PUBLIC = {
    ("get", "/"),
    ("post", "/api/v1/auth/login"),
    ("post", "/api/v1/auth/logout"),
    ("post", "/api/v1/auth/refresh"),
    ("post", "/api/v1/users"),
    ("post", "/api/v1/users/validate"),
    ("get", "/healthz"),
    ("get", "/readyz"),
}

# Who may call each protected operation. "any" is every authenticated user; the rest name the
# extra rule the service layer applies (tested in test_auth_users.py and test_projects_tasks.py).
MATRIX: dict[tuple[str, str], str] = {
    ("get", "/api/v1/auth/me"): "any",
    ("get", "/api/v1/me"): "any (own account)",
    ("patch", "/api/v1/me/profile"): "any (own profile)",
    ("put", "/api/v1/me/skills"): "any (own profile)",
    ("put", "/api/v1/me/preferences"): "any (own profile)",
    ("put", "/api/v1/me/privacy"): "any (own profile)",
    ("post", "/api/v1/me/password"): "any; needs the current password",
    ("delete", "/api/v1/me/sessions"): "any (own sessions)",
    ("post", "/api/v1/me/delete"): "any; needs the password",
    ("get", "/api/v1/users"): "any",
    ("get", "/api/v1/users/{userId}"): "any",
    ("patch", "/api/v1/users/{userId}"): "self or lead; role change lead only",
    ("delete", "/api/v1/users/{userId}"): "lead",
    ("get", "/api/v1/projects"): "any, scoped to readable projects",
    ("post", "/api/v1/projects"): "any",
    ("get", "/api/v1/projects/{projectId}"): "owner, assignee or lead; else 404",
    ("patch", "/api/v1/projects/{projectId}"): "owner or lead",
    ("delete", "/api/v1/projects/{projectId}"): "owner or lead",
    ("get", "/api/v1/projects/{projectId}/tasks"): "owner, assignee or lead; else 404",
    ("get", "/api/v1/tasks"): "any, scoped to readable projects",
    ("post", "/api/v1/tasks"): "project owner or lead",
    ("get", "/api/v1/tasks/{taskId}"): "owner, assignee or lead; else 404",
    ("patch", "/api/v1/tasks/{taskId}"): "owner, assignee or lead",
    ("delete", "/api/v1/tasks/{taskId}"): "owner or lead",
    ("patch", "/api/v1/tasks/{taskId}/status"): "owner, assignee or lead",
    ("get", "/api/v1/ai/status"): "any",
    ("post", "/api/v1/ai/projects/{projectId}/task-suggestions"): "owner or lead",
    ("post", "/api/v1/ai/projects/{projectId}/prioritization"): "owner, assignee or lead; else 404",
    ("post", "/api/v1/ai/projects/{projectId}/summary"): "owner, assignee or lead; else 404",
    ("get", "/api/v1/activity"): "any, scoped to readable projects",
    ("get", "/api/v1/dashboard/summary"): "any, scoped to readable projects",
}


def operations(env: Env) -> set[tuple[str, str]]:
    spec = env.app.openapi()
    return {(m, p) for p, methods in spec["paths"].items() for m in methods}


async def test_tc300_matrix_covers_every_operation(env: Env) -> None:
    assert operations(env) == set(MATRIX) | PUBLIC


@pytest.mark.parametrize(("method", "template"), sorted(MATRIX))
async def test_tc300_protected_operations_reject_a_missing_token(
    env: Env, method: str, template: str
) -> None:
    path = template.replace("{userId}", str(uuid4()))
    path = path.replace("{projectId}", str(uuid4())).replace("{taskId}", str(uuid4()))
    response = await env.client.request(method.upper(), path, json={} if method != "get" else None)
    assert response.status_code == 401
    assert error_code(response) == "UNAUTHENTICATED"


async def test_tc300_reads_follow_the_visibility_matrix(env: Env) -> None:
    """S6: reads are open to any signed-in user only for lists and the directory (section 6)."""
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    for path in (
        "/api/v1/users",
        f"/api/v1/users/{other['id']}",
        "/api/v1/projects",
        "/api/v1/tasks",
        "/api/v1/activity",
        "/api/v1/dashboard/summary",
    ):
        for who in (LEAD, DEV, OTHER):
            response = await env.client.get(path, headers=env.auth(who))
            assert response.status_code == 200, (path, who)
    for path in (
        f"/api/v1/projects/{project['id']}",
        f"/api/v1/projects/{project['id']}/tasks",
        f"/api/v1/tasks/{task['id']}",
    ):
        for who, expected in ((LEAD, 200), (DEV, 200), (OTHER, 404)):
            response = await env.client.get(path, headers=env.auth(who))
            assert response.status_code == expected, (path, who)


async def test_tc300_unknown_ids_are_404_for_reads(env: Env) -> None:
    for path in (f"/api/v1/users/{uuid4()}", f"/api/v1/tasks/{uuid4()}"):
        response = await env.client.get(path, headers=env.auth(DEV))
        assert response.status_code == 404
    missing_list = await env.client.get(f"/api/v1/projects/{uuid4()}/tasks", headers=env.auth(DEV))
    assert missing_list.status_code == 404


async def test_tc300_bad_list_query_is_422(env: Env) -> None:
    for path in ("/api/v1/users?pageSize=0", "/api/v1/users?sort=passwordHash"):
        assert (await env.client.get(path, headers=env.auth(DEV))).status_code == 422


async def test_tc300_summary_needs_no_admin_rights_but_delete_user_does(env: Env) -> None:
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    denied = await env.client.delete(f"/api/v1/users/{other['id']}", headers=env.auth(DEV))
    assert denied.status_code == 403
    assert error_code(denied) == "FORBIDDEN"
