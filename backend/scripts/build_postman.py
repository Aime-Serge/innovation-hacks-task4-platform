"""Generate the Postman collection and environment from docs/openapi.json (NFR-222, TC-283).

The collection is a happy-path journey that Newman can run against a seeded server:
login as the lead, create a user, a project and a task, walk the status workflow, then
clean up. Each request carries assertions. Nothing here holds a real credential: the
password comes from the environment file, which ships with an obvious placeholder.
"""

import json
from pathlib import Path
from typing import Any

Item = dict[str, Any]

BASE = "{{baseUrl}}"


def check(*lines: str) -> Item:
    return {"listen": "test", "script": {"type": "text/javascript", "exec": list(lines)}}


def error_code(code: str) -> str:
    return (
        f"pm.test('error code {code}', () => "
        f"pm.expect(pm.response.json().error.code).to.eql('{code}'));"
    )


PAGE_SHAPE = (
    "pm.test('page shape', () => pm.expect(pm.response.json())"
    ".to.have.keys('items', 'page', 'pageSize', 'total'));"
)


def request(
    name: str,
    method: str,
    path: str,
    status: int,
    body: dict[str, Any] | None = None,
    auth: bool = True,
    tests: tuple[str, ...] = (),
) -> Item:
    headers = [{"key": "Content-Type", "value": "application/json"}]
    if auth:
        headers.append({"key": "Authorization", "value": "Bearer {{accessToken}}"})
    req: Item = {
        "method": method,
        "header": headers,
        "url": {"raw": f"{BASE}{path}", "host": [BASE], "path": path.strip("/").split("/")},
    }
    if body is not None:
        req["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2)}
    lines = (
        f"pm.test('{method} {path.split('?')[0]} returns {status}', "
        f"() => pm.response.to.have.status({status}));",
        *tests,
    )
    return {"name": name, "request": req, "event": [check(*lines)]}


def collection() -> Item:
    journey: list[Item] = [
        request("Liveness", "GET", "/healthz", 200, auth=False),
        request(
            "Login as lead",
            "POST",
            "/api/v1/auth/login",
            200,
            {"email": "{{leadEmail}}", "password": "{{leadPassword}}"},
            auth=False,
            tests=("pm.collectionVariables.set('accessToken', pm.response.json().accessToken);",),
        ),
        request("Current user", "GET", "/api/v1/auth/me", 200),
        request(
            "Wrong password is a 401",
            "POST",
            "/api/v1/auth/login",
            401,
            {"email": "{{leadEmail}}", "password": "definitely-not-the-password"},
            auth=False,
            tests=(error_code("INVALID_CREDENTIALS"),),
        ),
        request(
            "Create project",
            "POST",
            "/api/v1/projects",
            201,
            {"name": "Newman demo project", "description": "Created by the Postman run"},
            tests=(
                "pm.test('Location header', () => pm.response.to.have.header('Location'));",
                "pm.collectionVariables.set('projectId', pm.response.json().id);",
            ),
        ),
        request(
            "Create task",
            "POST",
            "/api/v1/tasks",
            201,
            {"title": "Newman demo task", "projectId": "{{projectId}}", "priority": "high"},
            tests=("pm.collectionVariables.set('taskId', pm.response.json().id);",),
        ),
        request(
            "Skipping a status is a 409",
            "PATCH",
            "/api/v1/tasks/{{taskId}}/status",
            409,
            {"status": "done"},
            tests=(error_code("INVALID_STATUS_TRANSITION"),),
        ),
        request(
            "Start the task",
            "PATCH",
            "/api/v1/tasks/{{taskId}}/status",
            200,
            {"status": "in_progress"},
        ),
        request(
            "List tasks",
            "GET",
            "/api/v1/tasks?status=in_progress&pageSize=5",
            200,
            tests=(PAGE_SHAPE,),
        ),
        request("Dashboard summary", "GET", "/api/v1/dashboard/summary", 200),
        request("Delete task", "DELETE", "/api/v1/tasks/{{taskId}}", 204),
        request("Delete project", "DELETE", "/api/v1/projects/{{projectId}}", 204),
        request("Deleted task is gone", "GET", "/api/v1/tasks/{{taskId}}", 404),
        request("No token is a 401", "GET", "/api/v1/projects", 401, auth=False),
    ]
    return {
        "info": {
            "name": "DevDash API",
            "description": "Happy-path and failure journey generated from docs/openapi.json.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": journey,
        "variable": [
            {"key": "accessToken", "value": ""},
            {"key": "projectId", "value": ""},
            {"key": "taskId", "value": ""},
        ],
    }


def environment() -> Item:
    values = {
        "baseUrl": "http://127.0.0.1:8000",
        "leadEmail": "amara.diallo@example.com",
        "leadPassword": "CHANGE-ME-to-your-SEED_PASSWORD",
    }
    return {
        "name": "DevDash local",
        "values": [
            {
                "key": key,
                "value": value,
                "type": "secret" if key == "leadPassword" else "default",
                "enabled": True,
            }
            for key, value in values.items()
        ],
    }


def main() -> None:
    out = Path("postman")
    out.mkdir(exist_ok=True)
    (out / "devdash.postman_collection.json").write_text(json.dumps(collection(), indent=2) + "\n")
    (out / "devdash.postman_environment.json").write_text(
        json.dumps(environment(), indent=2) + "\n"
    )
    print("Wrote postman/devdash.postman_collection.json and devdash.postman_environment.json")


if __name__ == "__main__":
    main()
