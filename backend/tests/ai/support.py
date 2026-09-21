"""Shared helpers for the AI tests: an environment with a chosen fake provider scenario."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.ai.fake_client import FakeLLMClient
from tests.conftest import DEV, Env, build_env, make_project, make_task


@dataclass
class AiEnv:
    env: Env
    llm: FakeLLMClient

    async def post(self, path: str, who: str = DEV, json: Any = None) -> Any:
        return await self.env.client.post(path, json=json, headers=self.env.auth(who))

    async def project(self, who: str = DEV, **body: Any) -> dict[str, Any]:
        return await make_project(self.env, who, **body)

    async def task(self, project_id: str, who: str = DEV, **body: Any) -> dict[str, Any]:
        return await make_task(self.env, project_id, who, **body)

    async def rows(self) -> list[Any]:
        """Every usage row, newest first."""
        async with self.env.container.uow() as uow:
            return await uow.ai_requests.list_recent(500)

    async def counts(self) -> dict[str, int]:
        async with self.env.container.uow() as uow:
            page_size = 500
            from app.domain.queries import ActivityQuery, ProjectQuery, TaskQuery, UserQuery

            return {
                "projects": (await uow.projects.list(ProjectQuery(page_size=page_size))).total,
                "tasks": (await uow.tasks.list(TaskQuery(page_size=page_size))).total,
                "users": (await uow.users.list(UserQuery(page_size=page_size))).total,
                "activity": (await uow.activity.list(ActivityQuery(page_size=page_size))).total,
            }


async def ai_env(scenario: str = "ok", **settings: Any) -> AsyncIterator[AiEnv]:
    llm = FakeLLMClient(scenario)
    async for env in build_env("empty", llm=llm, **settings):
        yield AiEnv(env, llm)


def uid(value: Any) -> UUID:
    return UUID(str(value))
