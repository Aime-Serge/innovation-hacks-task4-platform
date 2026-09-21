"""TC-210 to TC-233: projects, tasks and the status workflow."""

from typing import Any
from uuid import uuid4

from tests.conftest import DEV, LEAD, OTHER, Env, error_code, make_project, make_task


async def status_to(env: Env, task_id: str, status: str, who: str = DEV) -> Any:
    return await env.client.patch(
        f"/api/v1/tasks/{task_id}/status", json={"status": status}, headers=env.auth(who)
    )


async def test_tc210_create_project_returns_201_location_and_owner(env: Env) -> None:
    response = await env.client.post(
        "/api/v1/projects", json={"name": "  Atlas  "}, headers=env.auth(DEV)
    )
    body = response.json()
    assert response.status_code == 201
    assert response.headers["location"] == f"/api/v1/projects/{body['id']}"
    assert body["name"] == "Atlas"  # trimmed
    assert body["status"] == "planned"
    assert body["dueDate"] is None
    assert body["progress"] == {"totalTasks": 0, "doneTasks": 0, "percent": 0}
    me = (await env.client.get("/api/v1/auth/me", headers=env.auth(DEV))).json()
    assert body["ownerId"] == me["id"]


async def test_tc211_client_cannot_set_owner_or_progress(env: Env) -> None:
    forbidden: list[dict[str, Any]] = [
        {"ownerId": str(uuid4())},
        {"progress": {}},
        {"id": str(uuid4())},
    ]
    for extra in forbidden:
        r = await env.client.post(
            "/api/v1/projects", json={"name": "X", **extra}, headers=env.auth(DEV)
        )
        assert r.status_code == 422, extra


async def test_tc212_project_list_filters_sorts_and_pages(env: Env) -> None:
    for name in ("Beta", "Alpha", "Gamma"):
        await make_project(env, DEV, name=name)
    await make_project(env, OTHER, name="Delta", status="active")
    url = "/api/v1/projects?sort=name&pageSize=2&page=2"
    body = (await env.client.get(url, headers=env.auth(DEV))).json()
    assert [p["name"] for p in body["items"]] == ["Delta", "Gamma"]
    assert (body["page"], body["pageSize"], body["total"]) == (2, 2, 4)
    active = (await env.client.get("/api/v1/projects?status=active", headers=env.auth(DEV))).json()
    assert [p["name"] for p in active["items"]] == ["Delta"]
    found = (await env.client.get("/api/v1/projects?q=alph", headers=env.auth(DEV))).json()
    assert found["total"] == 1


async def test_tc213_only_owner_or_lead_edits_and_deletes_project(env: Env) -> None:
    project = await make_project(env, DEV)
    url = f"/api/v1/projects/{project['id']}"
    denied = await env.client.patch(url, json={"name": "Hi"}, headers=env.auth(OTHER))
    assert denied.status_code == 403
    assert (await env.client.delete(url, headers=env.auth(OTHER))).status_code == 403
    by_lead = await env.client.patch(url, json={"name": "Renamed"}, headers=env.auth(LEAD))
    assert by_lead.status_code == 200
    assert by_lead.json()["name"] == "Renamed"
    assert (await env.client.delete(url, headers=env.auth(DEV))).status_code == 204
    assert (await env.client.get(url, headers=env.auth(DEV))).status_code == 404


async def test_tc214_project_with_tasks_cannot_be_deleted(env: Env) -> None:
    project = await make_project(env, DEV)
    await make_task(env, project["id"])
    r = await env.client.delete(f"/api/v1/projects/{project['id']}", headers=env.auth(DEV))
    assert r.status_code == 409
    assert error_code(r) == "PROJECT_NOT_EMPTY"


async def test_tc215_malformed_id_is_422_unknown_is_404(env: Env) -> None:
    bad = await env.client.get("/api/v1/projects/not-a-uuid", headers=env.auth(DEV))
    assert bad.status_code == 422
    missing = await env.client.get(f"/api/v1/projects/{uuid4()}", headers=env.auth(DEV))
    assert missing.status_code == 404
    assert error_code(missing) == "NOT_FOUND"


async def test_tc220_create_task_defaults(env: Env) -> None:
    project = await make_project(env, DEV)
    r = await env.client.post(
        "/api/v1/tasks",
        json={"projectId": project["id"], "title": "Ship it"},
        headers=env.auth(DEV),
    )
    body = r.json()
    assert r.status_code == 201
    assert r.headers["location"] == f"/api/v1/tasks/{body['id']}"
    assert (body["status"], body["priority"]) == ("todo", "medium")
    assert body["completedAt"] is None
    assert body["assigneeId"] is None


async def test_tc221_unknown_project_is_422_and_status_is_not_settable(env: Env) -> None:
    unknown = await env.client.post(
        "/api/v1/tasks", json={"projectId": str(uuid4()), "title": "X"}, headers=env.auth(DEV)
    )
    assert unknown.status_code == 422
    assert error_code(unknown) == "VALIDATION_ERROR"
    project = await make_project(env, DEV)
    forced = await env.client.post(
        "/api/v1/tasks",
        json={"projectId": project["id"], "title": "X", "status": "done"},
        headers=env.auth(DEV),
    )
    assert forced.status_code == 422


async def test_tc222_completed_project_accepts_no_new_tasks(env: Env) -> None:
    project = await make_project(env, DEV, status="completed")
    r = await env.client.post(
        "/api/v1/tasks", json={"projectId": project["id"], "title": "Late"}, headers=env.auth(DEV)
    )
    assert r.status_code == 409
    assert error_code(r) == "PROJECT_CLOSED"


async def test_tc223_task_create_and_delete_need_owner_or_lead(env: Env) -> None:
    project = await make_project(env, DEV)
    denied = await env.client.post(
        "/api/v1/tasks", json={"projectId": project["id"], "title": "X"}, headers=env.auth(OTHER)
    )
    assert denied.status_code == 403
    task = await make_task(env, project["id"], DEV)
    url = f"/api/v1/tasks/{task['id']}"
    assert (await env.client.delete(url, headers=env.auth(OTHER))).status_code == 403
    assert (await env.client.delete(url, headers=env.auth(LEAD))).status_code == 204


async def test_tc224_patch_task_edits_fields_and_rejects_status(env: Env) -> None:
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    url = f"/api/v1/tasks/{task['id']}"
    ok = await env.client.patch(
        url,
        json={"title": "New", "priority": "urgent", "dueDate": "2026-12-01"},
        headers=env.auth(DEV),
    )
    assert ok.status_code == 200
    assert (ok.json()["title"], ok.json()["priority"], ok.json()["dueDate"]) == (
        "New",
        "urgent",
        "2026-12-01",
    )
    cleared = await env.client.patch(url, json={"dueDate": None}, headers=env.auth(DEV))
    assert cleared.json()["dueDate"] is None
    assert (
        await env.client.patch(url, json={"status": "done"}, headers=env.auth(DEV))
    ).status_code == 422


async def test_tc225_assignee_edits_task_but_stranger_cannot(env: Env) -> None:
    project = await make_project(env, DEV)
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    task = await make_task(env, project["id"], assigneeId=other["id"])
    url = f"/api/v1/tasks/{task['id']}"
    assert (
        await env.client.patch(url, json={"title": "Mine"}, headers=env.auth(OTHER))
    ).status_code == 200
    third = await env.client.post(
        "/api/v1/users",
        json={"name": "Third", "email": "third@example.com", "password": "third-password-1"},
    )
    assert third.status_code == 201
    token = (await env.login("third@example.com", "third-password-1")).json()["accessToken"]
    r = await env.client.patch(
        url, json={"title": "Nope"}, headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403


async def test_tc226_unknown_assignee_is_422(env: Env) -> None:
    project = await make_project(env, DEV)
    r = await env.client.post(
        "/api/v1/tasks",
        json={"projectId": project["id"], "title": "X", "assigneeId": str(uuid4())},
        headers=env.auth(DEV),
    )
    assert r.status_code == 422


async def test_tc230_full_workflow_and_completed_at(env: Env) -> None:
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    for step in ("in_progress", "in_review", "done"):
        r = await status_to(env, task["id"], step)
        assert r.status_code == 200
        assert r.json()["status"] == step
    assert r.json()["completedAt"] == "2026-09-20T12:00:00Z"
    reopened = await status_to(env, task["id"], "in_progress")
    assert reopened.json()["completedAt"] is None


async def test_tc231_invalid_transition_lists_allowed_statuses(env: Env) -> None:
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    r = await status_to(env, task["id"], "done")
    assert r.status_code == 409
    assert error_code(r) == "INVALID_STATUS_TRANSITION"
    assert {"field": "allowedStatuses", "message": "in_progress"} in r.json()["error"]["details"]


async def test_tc232_same_status_is_a_noop_without_activity(env: Env) -> None:
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    before = (await env.client.get("/api/v1/activity", headers=env.auth(DEV))).json()["total"]
    r = await status_to(env, task["id"], "todo")
    after = (await env.client.get("/api/v1/activity", headers=env.auth(DEV))).json()["total"]
    assert r.status_code == 200
    assert before == after


async def test_tc233_status_change_permissions_and_unknown_value(env: Env) -> None:
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"])
    assert (await status_to(env, task["id"], "in_progress", OTHER)).status_code == 403
    assert (await status_to(env, task["id"], "in_progress", LEAD)).status_code == 200
    assert (await status_to(env, task["id"], "archived")).status_code == 422


async def test_tc234_project_progress_follows_done_tasks(env: Env) -> None:
    project = await make_project(env, DEV)
    first = await make_task(env, project["id"])
    await make_task(env, project["id"], title="Second")
    for step in ("in_progress", "in_review", "done"):
        await status_to(env, first["id"], step)
    body = (await env.client.get(f"/api/v1/projects/{project['id']}", headers=env.auth(DEV))).json()
    assert body["progress"] == {"totalTasks": 2, "doneTasks": 1, "percent": 50}


async def test_tc235_task_filters_overdue_and_sort(env: Env) -> None:
    project = await make_project(env, DEV)
    await make_task(env, project["id"], title="Late", dueDate="2026-09-01", priority="urgent")
    await make_task(env, project["id"], title="Soon", dueDate="2026-10-01", priority="low")
    await make_task(env, project["id"], title="Undated")
    headers = env.auth(DEV)
    overdue = (await env.client.get("/api/v1/tasks?overdue=true", headers=headers)).json()
    assert [t["title"] for t in overdue["items"]] == ["Late"]
    by_due = (await env.client.get("/api/v1/tasks?sort=dueDate", headers=headers)).json()
    assert [t["title"] for t in by_due["items"]] == ["Late", "Soon", "Undated"]
    by_pri = (await env.client.get("/api/v1/tasks?sort=-priority", headers=headers)).json()
    assert by_pri["items"][0]["title"] == "Late"
    multi = (
        await env.client.get("/api/v1/tasks?priority=low&priority=urgent", headers=headers)
    ).json()
    assert multi["total"] == 2
    scoped = (
        await env.client.get(f"/api/v1/projects/{project['id']}/tasks", headers=headers)
    ).json()
    assert scoped["total"] == 3


async def test_tc236_deleting_a_user_unassigns_their_tasks(env: Env) -> None:
    project = await make_project(env, DEV)
    other = (await env.client.get("/api/v1/auth/me", headers=env.auth(OTHER))).json()
    task = await make_task(env, project["id"], assigneeId=other["id"])
    assert (
        await env.client.delete(f"/api/v1/users/{other['id']}", headers=env.auth(LEAD))
    ).status_code == 204
    after = (await env.client.get(f"/api/v1/tasks/{task['id']}", headers=env.auth(DEV))).json()
    assert after["assigneeId"] is None
