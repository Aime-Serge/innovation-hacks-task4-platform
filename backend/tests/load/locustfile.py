"""NFR-201, NFR-202: p95 list under 150 ms, p95 single read and write under 100 ms, no errors.

Run through `make load`, which starts the "large" seed profile (500 tasks).
"""

import os
import random
from typing import Any

from locust import HttpUser, between, events, task

LIST_P95_MS = 150
SINGLE_P95_MS = 100
LIST_NAMES = {"GET /tasks", "GET /projects", "GET /users", "GET /activity"}
SINGLE_NAMES = {
    "GET /tasks/{id}",
    "GET /projects/{id}",
    "POST /tasks",
    "PATCH /tasks/{id}",
    "GET /dashboard/summary",
}


class Developer(HttpUser):
    wait_time = between(0.05, 0.2)
    token_headers: dict[str, str]
    task_ids: list[str]
    project_ids: list[str]

    def on_start(self) -> None:
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "amara.diallo@example.com",
                "password": os.environ["LOAD_PASSWORD"],
            },
            name="POST /auth/login",
        )
        self.token_headers = {"Authorization": f"Bearer {response.json()['accessToken']}"}
        tasks = self.client.get(
            "/api/v1/tasks?pageSize=100", headers=self.token_headers, name="GET /tasks"
        ).json()["items"]
        projects = self.client.get(
            "/api/v1/projects?pageSize=100", headers=self.token_headers, name="GET /projects"
        ).json()["items"]
        self.task_ids = [t["id"] for t in tasks]
        self.project_ids = [p["id"] for p in projects if p["status"] != "completed"]

    @task(6)
    def list_tasks(self) -> None:
        query = random.choice(
            ["", "?status=todo", "?sort=-dueDate&pageSize=50", "?overdue=true", "?q=fix"]
        )
        self.client.get(f"/api/v1/tasks{query}", headers=self.token_headers, name="GET /tasks")

    @task(3)
    def list_projects(self) -> None:
        self.client.get("/api/v1/projects", headers=self.token_headers, name="GET /projects")

    @task(2)
    def list_other(self) -> None:
        self.client.get("/api/v1/users", headers=self.token_headers, name="GET /users")
        self.client.get("/api/v1/activity", headers=self.token_headers, name="GET /activity")

    @task(5)
    def read_one(self) -> None:
        task_id = random.choice(self.task_ids)
        self.client.get(
            f"/api/v1/tasks/{task_id}", headers=self.token_headers, name="GET /tasks/{id}"
        )
        project_id = random.choice(self.project_ids)
        self.client.get(
            f"/api/v1/projects/{project_id}", headers=self.token_headers, name="GET /projects/{id}"
        )

    @task(2)
    def summary(self) -> None:
        self.client.get(
            "/api/v1/dashboard/summary", headers=self.token_headers, name="GET /dashboard/summary"
        )

    @task(2)
    def write(self) -> None:
        created = self.client.post(
            "/api/v1/tasks",
            json={"projectId": random.choice(self.project_ids), "title": "Load test task"},
            headers=self.token_headers,
            name="POST /tasks",
        )
        if created.status_code == 201:
            self.client.patch(
                f"/api/v1/tasks/{created.json()['id']}",
                json={"priority": "high"},
                headers=self.token_headers,
                name="PATCH /tasks/{id}",
            )


def enforce_thresholds(environment: Any, **_: Any) -> None:
    stats = environment.stats
    failed = False
    if stats.total.num_failures:
        print(f"LOAD GATE: {stats.total.num_failures} failed requests")
        failed = True
    for name, entry in stats.entries.items():
        label = name[0] if isinstance(name, tuple) else str(name)
        limit = LIST_P95_MS if label in LIST_NAMES else SINGLE_P95_MS
        if label in LIST_NAMES | SINGLE_NAMES:
            p95 = entry.get_response_time_percentile(0.95)
            print(f"LOAD GATE: {label} p95 {p95:.0f} ms (limit {limit} ms, n={entry.num_requests})")
            failed = failed or p95 > limit
    environment.process_exit_code = 1 if failed else 0


events.quitting.add_listener(enforce_thresholds)  # type: ignore[no-untyped-call]  # locust ships no type hints
