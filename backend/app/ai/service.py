"""The ten-step AI pipeline (section 7). It only ever suggests: the one thing it writes is a usage
row (BR-405). Authorization and visibility come from the same code as every other read."""

import asyncio
import math
import time
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ValidationError

from app.ai.builders import (
    BuiltPrompt,
    build_prioritization,
    build_summary,
    build_task_generation,
    load_prompt,
)
from app.ai.client import LLMClient, LLMError, LLMProviderError, LLMRateLimited, LLMResult
from app.ai.schemas import Prioritization, ProjectSummary, SuggestedTask, TaskSuggestions
from app.core.clock import Clock, IdFactory
from app.core.config import Settings
from app.core.errors import AiBadResponse, AiDisabled, AiQuotaExceeded, AiUnavailable
from app.domain.models import AiRequest, Project, Task
from app.domain.queries import TaskQuery
from app.repositories.base import UnitOfWork
from app.services import transaction
from app.services.authz import Actor, require_project_manager
from app.services.projects import require_project
from app.services.transaction import UowFactory
from app.services.visibility import read_scope

FEATURES = ("task_generation", "prioritization", "project_summary")
BUDGET_S = 25.0  # the whole call, including one repair attempt
REPAIR_NEEDS_S = 8.0  # a repair is only tried when this much of the budget is left
MAX_PROMPT_TASKS = 500  # how many titles the duplicate check reads


@dataclass(frozen=True)
class Meta:
    model: str | None
    prompt_version: str
    request_id: UUID


@dataclass(frozen=True)
class Suggestions:
    suggestions: list[SuggestedTask]
    meta: Meta


@dataclass(frozen=True)
class RankedTask:
    task_id: UUID
    rank: int
    suggested_priority: str
    reason: str


@dataclass(frozen=True)
class Ranking:
    items: list[RankedTask]
    meta: Meta


@dataclass(frozen=True)
class Summary:
    summary: str
    risks: list[str]
    next_steps: list[str]
    meta: Meta


@dataclass(frozen=True)
class AiStatus:
    enabled: bool
    features: list[str]
    daily_limit: int
    remaining_today: int
    resets_at: datetime


@dataclass(frozen=True)
class _Loaded:
    project: Project
    tasks: list[Task]


class _Failed(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _day_start(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


class AiService:
    def __init__(
        self,
        uow: UowFactory,
        llm: LLMClient,
        settings: Settings,
        clock: Clock,
        ids: IdFactory,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._uow = uow
        self._llm = llm
        self._s = settings
        self._clock = clock
        self._ids = ids
        self._monotonic = monotonic

    # ---- public operations ---------------------------------------------------------------

    async def status(self, actor: Actor) -> AiStatus:
        now = self._clock.now()
        start = _day_start(now)

        async def work(uow: UnitOfWork) -> int:
            return await uow.ai_requests.count(since=start, user_id=actor.id)

        used = await transaction.read(self._uow, work)
        enabled = self._s.ai_enabled
        return AiStatus(
            enabled=enabled,
            features=list(FEATURES) if enabled else [],
            daily_limit=self._s.ai_daily_limit_per_user,
            remaining_today=max(0, self._s.ai_daily_limit_per_user - used),
            resets_at=start + timedelta(days=1),
        )

    async def suggest_tasks(
        self, actor: Actor, project_id: UUID, brief: str | None, count: int
    ) -> Suggestions:
        today = self._clock.today()
        data, meta, loaded = await self._run(
            "task_generation",
            "task_generation_v1",
            actor,
            project_id,
            lambda ctx: build_task_generation(ctx.project, ctx.tasks, brief, count, today),
            TaskSuggestions,
        )
        existing = {t.title.strip().lower() for t in loaded.tasks}
        kept: list[SuggestedTask] = []
        for item in TaskSuggestions.model_validate(data).suggestions:
            key = item.title.strip().lower()
            if key in existing:  # BR-410: a title the project already has is dropped
                continue
            existing.add(key)
            kept.append(item)
        return Suggestions(kept[:count], meta)

    async def prioritize(self, actor: Actor, project_id: UUID) -> Ranking:
        today = self._clock.today()
        holder: dict[str, dict[str, UUID]] = {}

        def build(ctx: _Loaded) -> BuiltPrompt:
            built = build_prioritization(ctx.project, ctx.tasks, today)
            holder["aliases"] = built.aliases
            return built

        data, meta, _ = await self._run(
            "prioritization", "prioritization_v1", actor, project_id, build, Prioritization
        )
        aliases = holder["aliases"]
        seen: set[str] = set()
        items: list[RankedTask] = []
        for item in Prioritization.model_validate(data).items:
            # An alias that was not in the input is dropped, and each task appears once (FR-424).
            if item.task not in aliases or item.task in seen:
                continue
            seen.add(item.task)
            items.append(
                RankedTask(aliases[item.task], item.rank, item.suggested_priority, item.reason)
            )
        return Ranking(sorted(items, key=lambda i: i.rank), meta)

    async def summarize(self, actor: Actor, project_id: UUID) -> Summary:
        today = self._clock.today()
        data, meta, _ = await self._run(
            "project_summary",
            "project_summary_v1",
            actor,
            project_id,
            lambda ctx: build_summary(ctx.project, ctx.tasks, today),
            ProjectSummary,
        )
        out = ProjectSummary.model_validate(data)
        return Summary(out.summary, out.risks, out.next_steps, meta)

    async def purge(self) -> int:
        """BR-413: usage rows older than 90 days are deleted."""
        cutoff = self._clock.now() - timedelta(days=90)

        async def work(uow: UnitOfWork) -> int:
            return await uow.ai_requests.delete_older_than(cutoff)

        return await transaction.write(self._uow, work)

    # ---- the pipeline ---------------------------------------------------------------------

    async def _run(
        self,
        feature: str,
        prompt_name: str,
        actor: Actor,
        project_id: UUID,
        build: Callable[[_Loaded], BuiltPrompt],
        schema: type[BaseModel],
    ) -> tuple[dict[str, Any], Meta, _Loaded]:
        version = load_prompt(prompt_name).version
        if not self._s.ai_enabled:  # step 1, part two: the kill switch (BR-412)
            await self._record_only(actor, feature, version, "disabled", "ai_disabled")
            raise AiDisabled("AI features are switched off.")
        loaded = await self._authorize(actor, project_id, feature)  # step 1
        request = await self._reserve(actor, feature, version)  # steps 2 and 3
        started = self._monotonic()
        status, code = "provider_error", "internal"
        result: LLMResult | None = None
        tokens = (0, 0)
        try:
            built = build(loaded)  # steps 4 and 5
            result, tokens = await self._generate(built, schema, started)  # steps 6 and 7
            status, code = "success", ""
            meta = Meta(result.model, built.version, request.id)
            return result.data, meta, loaded
        except _Failed as failure:
            code = failure.code
            status = "invalid_output" if code == "invalid_output" else "provider_error"
            if status == "invalid_output":
                raise AiBadResponse(
                    "The suggestions could not be read. Try a shorter brief."
                ) from None
            raise AiUnavailable("AI is unavailable right now.") from None
        finally:
            elapsed = int((self._monotonic() - started) * 1000)
            done = replace(
                request,
                status=status,
                model=result.model if result else None,
                input_tokens=tokens[0],
                output_tokens=tokens[1],
                latency_ms=elapsed,
                error_code=code or None,
            )
            await asyncio.shield(self._finish(done))  # step 9

    async def _authorize(self, actor: Actor, project_id: UUID, feature: str) -> _Loaded:
        async def work(uow: UnitOfWork) -> _Loaded:
            scope = await read_scope(uow, actor)
            project = await require_project(uow, project_id, scope=scope)  # 404 when unreadable
            if feature == "task_generation":
                require_project_manager(actor, project)  # the right to create tasks (BR-203)
            page = await uow.tasks.list(
                TaskQuery(
                    project_ids=[project_id],
                    scope=scope,
                    sort="createdAt",
                    page_size=MAX_PROMPT_TASKS,
                    with_total=False,
                )
            )
            return _Loaded(project, page.items)

        return await transaction.read(self._uow, work)

    def _row(
        self, actor: Actor, feature: str, version: str, status: str, now: datetime
    ) -> AiRequest:
        return AiRequest(
            id=self._ids.new_id(),
            user_id=actor.id,
            feature=feature,
            status=status,
            provider=self._s.llm_provider,
            model=None,
            prompt_version=version,
            input_tokens=None,
            output_tokens=None,
            latency_ms=None,
            error_code=None,
            created_at=now,
        )

    async def _record_only(
        self, actor: Actor, feature: str, version: str, status: str, code: str
    ) -> None:
        row = replace(
            self._row(actor, feature, version, status, self._clock.now()), error_code=code
        )

        async def work(uow: UnitOfWork) -> None:
            await uow.ai_requests.add(row)

        await transaction.write(self._uow, work)

    async def _reserve(self, actor: Actor, feature: str, version: str) -> AiRequest:
        """Steps 2 and 3: commit a `pending` row first, then count including it, so a burst of
        concurrent calls sees each other and cannot all slip under the limit (BR-409)."""
        now = self._clock.now()
        start = _day_start(now)
        minute = now - timedelta(seconds=60)
        row = self._row(actor, feature, version, "pending", now)
        midnight = math.ceil((start + timedelta(days=1) - now).total_seconds())

        async def work(uow: UnitOfWork) -> int | None:
            repo = uow.ai_requests
            await repo.lock_quota()
            await repo.add(row)
            retry: int | None = None
            if await repo.count(since=minute, user_id=actor.id) > self._s.ai_per_minute_limit:
                oldest = await repo.oldest_at(since=minute, user_id=actor.id) or now
                retry = max(1, math.ceil(60 - (now - oldest).total_seconds()))
            elif (
                await repo.count(since=start, user_id=actor.id) > self._s.ai_daily_limit_per_user
                or await repo.count(since=start) > self._s.ai_global_daily_limit
            ):
                retry = midnight
            if retry is not None:
                await repo.update(replace(row, status="quota_blocked", error_code="quota"))
            return retry

        retry = await transaction.write(self._uow, work)
        if retry is not None:
            raise AiQuotaExceeded("The AI limit was reached. Try again later.", retry)
        return row

    async def _finish(self, request: AiRequest) -> None:
        async def work(uow: UnitOfWork) -> None:
            await uow.ai_requests.update(request)

        await transaction.write(self._uow, work)

    async def _call(self, system: str, user: str, schema: type[BaseModel]) -> LLMResult:
        """Step 6: at most one retry, and only for a provider 429 or 5xx."""
        for attempt in (1, 2):
            try:
                return await self._llm.generate(
                    system=system,
                    user=user,
                    output_schema=schema,
                    max_tokens=self._s.llm_max_output_tokens,
                    timeout_s=self._s.llm_timeout_s,
                )
            except LLMRateLimited:
                if attempt == 2:
                    raise _Failed("llm_rate_limited") from None
            except LLMProviderError as error:
                if not (error.retryable and attempt == 1):
                    raise _Failed("llm_provider_error") from None
            except LLMError:
                raise _Failed("llm_timeout") from None
        raise _Failed("llm_provider_error")

    async def _generate(
        self, built: BuiltPrompt, schema: type[BaseModel], started: float
    ) -> tuple[LLMResult, tuple[int, int]]:
        """Steps 6 and 7: call, validate, and repair once if the budget allows."""
        result = await self._call(built.system, built.user, schema)
        tokens = (result.input_tokens, result.output_tokens)
        try:
            schema.model_validate(result.data)
            return result, tokens
        except ValidationError as error:
            problems = "; ".join(
                f"{'.'.join(str(p) for p in e['loc']) or 'answer'}: {e['msg']}"
                for e in error.errors()[:10]
            )
        if BUDGET_S - (self._monotonic() - started) < REPAIR_NEEDS_S:
            raise _Failed("invalid_output")
        # The repair adds the validation message only, never any user data.
        system = f"{built.system}\n\nYour previous answer was rejected: {problems}. Answer again."
        second = await self._call(system, built.user, schema)
        tokens = (tokens[0] + second.input_tokens, tokens[1] + second.output_tokens)
        try:
            schema.model_validate(second.data)
        except ValidationError:
            raise _Failed("invalid_output") from None
        return second, tokens
