"""AI endpoints and pipeline: TC-430 to TC-441, 446, 468 (FR-421 to FR-432, BR-405 to BR-412)."""

import asyncio
from collections.abc import AsyncIterator
from datetime import timedelta
from uuid import uuid4

import pytest

from app.ai.builders import load_prompt
from tests.ai.support import AiEnv, ai_env
from tests.conftest import DEV, LEAD, OTHER, error_code

SUGGEST = "/api/v1/ai/projects/{p}/task-suggestions"
PRIORITIZE = "/api/v1/ai/projects/{p}/prioritization"
SUMMARY = "/api/v1/ai/projects/{p}/summary"


@pytest.fixture
async def ai() -> AsyncIterator[AiEnv]:
    async for value in ai_env("ok"):
        yield value


async def test_tc430_status_reports_features_and_remaining_quota(ai: AiEnv) -> None:
    body = (await ai.env.client.get("/api/v1/ai/status", headers=ai.env.auth(DEV))).json()
    assert body["enabled"] is True
    assert body["features"] == ["task_generation", "prioritization", "project_summary"]
    assert body["quota"]["dailyLimit"] == 20
    assert body["quota"]["remainingToday"] == 20
    assert body["quota"]["resetsAt"].startswith("2026-09-21T00:00:00")
    project = await ai.project()
    await ai.post(SUGGEST.format(p=project["id"]), json={"brief": "x"})
    after = (await ai.env.client.get("/api/v1/ai/status", headers=ai.env.auth(DEV))).json()
    assert after["quota"]["remainingToday"] == 19


async def test_tc430_the_kill_switch_disables_every_endpoint_and_is_recorded() -> None:
    async for ai in ai_env("ok", ai_enabled=False):
        project = await ai.project()
        status = (await ai.env.client.get("/api/v1/ai/status", headers=ai.env.auth(DEV))).json()
        assert (status["enabled"], status["features"]) == (False, [])
        for path in (SUGGEST, PRIORITIZE, SUMMARY):
            response = await ai.post(path.format(p=project["id"]))
            assert response.status_code == 503
            assert error_code(response) == "AI_DISABLED"
        assert ai.llm.calls == 0  # the provider is never contacted
        assert {r.status for r in await ai.rows()} == {"disabled"}


async def test_tc431_task_suggestions_are_returned_and_nothing_is_saved(ai: AiEnv) -> None:
    project = await ai.project()
    before = await ai.counts()
    response = await ai.post(SUGGEST.format(p=project["id"]), json={"brief": "Launch", "count": 2})
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["suggestions"]) == 2
    first = body["suggestions"][0]
    assert set(first) == {"title", "description", "priority", "dueInDays"}
    assert body["meta"]["promptVersion"] == "task-generation-v1"
    assert body["meta"]["model"] == "fake-model"
    assert await ai.counts() == before  # TC-441: no project, task, user or activity written


async def test_tc431_the_brief_is_optional_and_validated(ai: AiEnv) -> None:
    project = await ai.project()
    url = SUGGEST.format(p=project["id"])
    assert (await ai.post(url)).status_code == 200
    for body in ({"count": 0}, {"count": 11}, {"brief": "x" * 1001}, {"extra": 1}):
        response = await ai.post(url, json=body)
        assert response.status_code == 422, body
        assert error_code(response) == "VALIDATION_ERROR"


async def test_tc431_only_someone_who_may_create_tasks_can_ask(ai: AiEnv) -> None:
    project = await ai.project()
    other = (await ai.env.client.get("/api/v1/auth/me", headers=ai.env.auth(OTHER))).json()
    url = SUGGEST.format(p=project["id"])
    assert (await ai.post(url, OTHER)).status_code == 404  # a stranger cannot see the project
    await ai.task(project["id"], assigneeId=other["id"])
    denied = await ai.post(url, OTHER)  # a reader who is not the owner may not create tasks
    assert (denied.status_code, error_code(denied)) == (403, "FORBIDDEN")
    assert (await ai.post(url, LEAD)).status_code == 200
    assert (await ai.post(SUGGEST.format(p=uuid4()))).status_code == 404


async def test_tc432_a_suggested_title_the_project_already_has_is_dropped(ai: AiEnv) -> None:
    project = await ai.project()
    await ai.task(project["id"], title="  DEFINE the scope and GOALS ")
    body = (await ai.post(SUGGEST.format(p=project["id"]), json={"count": 5})).json()
    titles = [s["title"] for s in body["suggestions"]]
    assert "Define the scope and goals" not in titles  # BR-410: case and outer spaces ignored
    assert len(titles) == 2


async def test_tc433_prioritisation_maps_aliases_back_and_ranks(ai: AiEnv) -> None:
    project = await ai.project()
    tasks = [await ai.task(project["id"], title=f"Task {n}") for n in range(3)]
    response = await ai.post(PRIORITIZE.format(p=project["id"]))
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [i["rank"] for i in items] == [1, 2, 3]
    assert {i["taskId"] for i in items} == {t["id"] for t in tasks}
    assert items[0]["suggestedPriority"] == "high"


async def test_tc433_an_alias_that_was_not_in_the_input_is_dropped() -> None:
    async for ai in ai_env("injection_echo"):
        project = await ai.project()
        task = await ai.task(project["id"])
        items = (await ai.post(PRIORITIZE.format(p=project["id"]))).json()["items"]
        assert [i["taskId"] for i in items] == [task["id"]]  # T999 never comes back


async def test_tc434_only_open_tasks_are_ranked_and_an_empty_project_is_fine(ai: AiEnv) -> None:
    project = await ai.project()
    empty = await ai.post(PRIORITIZE.format(p=project["id"]))
    assert (empty.status_code, empty.json()["items"]) == (200, [])
    done = await ai.task(project["id"], title="Finished")
    for step in ("in_progress", "in_review", "done"):
        await ai.env.client.patch(
            f"/api/v1/tasks/{done['id']}/status", json={"status": step}, headers=ai.env.auth(DEV)
        )
    open_task = await ai.task(project["id"], title="Open")
    items = (await ai.post(PRIORITIZE.format(p=project["id"]))).json()["items"]
    assert [i["taskId"] for i in items] == [open_task["id"]]


async def test_tc434_prioritisation_needs_read_access_only(ai: AiEnv) -> None:
    project = await ai.project()
    other = (await ai.env.client.get("/api/v1/auth/me", headers=ai.env.auth(OTHER))).json()
    await ai.task(project["id"], assigneeId=other["id"])
    assert (await ai.post(PRIORITIZE.format(p=project["id"]), OTHER)).status_code == 200
    assert (await ai.post(PRIORITIZE.format(p=uuid4()), OTHER)).status_code == 404


async def test_tc435_summary_has_risks_and_next_steps(ai: AiEnv) -> None:
    project = await ai.project()
    await ai.task(project["id"])
    body = (await ai.post(SUMMARY.format(p=project["id"]))).json()
    assert body["summary"]
    assert len(body["risks"]) <= 5
    assert len(body["nextSteps"]) <= 5
    assert body["meta"]["promptVersion"] == "project-summary-v1"
    assert (await ai.post(SUMMARY.format(p=uuid4()))).status_code == 404


async def test_tc435_every_ai_endpoint_needs_a_token(ai: AiEnv) -> None:
    project = await ai.project()
    for method, path in (
        ("get", "/api/v1/ai/status"),
        ("post", SUGGEST.format(p=project["id"])),
        ("post", PRIORITIZE.format(p=project["id"])),
        ("post", SUMMARY.format(p=project["id"])),
    ):
        response = await ai.env.client.request(method.upper(), path)
        assert (response.status_code, error_code(response)) == (401, "UNAUTHENTICATED")


async def test_tc436_an_invalid_answer_is_repaired_once_with_the_message_only() -> None:
    async for ai in ai_env("invalid_then_ok"):
        project = await ai.project(description="a private description")
        response = await ai.post(SUGGEST.format(p=project["id"]))
        assert response.status_code == 200
        assert ai.llm.calls == 2
        repair = ai.llm.systems[1]
        assert repair.startswith(ai.llm.systems[0])
        added = repair.removeprefix(ai.llm.systems[0])
        assert "rejected" in added
        assert "private description" not in added  # no user data added
        assert (await ai.rows())[0].status == "success"


@pytest.mark.parametrize("scenario", ["bad_json", "too_long"])
async def test_tc437_an_answer_that_stays_invalid_gives_502_and_is_recorded(scenario: str) -> None:
    async for ai in ai_env(scenario):
        project = await ai.project()
        response = await ai.post(SUGGEST.format(p=project["id"]))
        assert (response.status_code, error_code(response)) == (502, "AI_BAD_RESPONSE")
        assert ai.llm.calls == 2  # the first answer and one repair, never more
        row = (await ai.rows())[0]
        assert (row.status, row.error_code) == ("invalid_output", "invalid_output")


async def test_tc436_no_repair_is_tried_when_less_than_8_seconds_remain() -> None:
    ticks = iter(range(0, 1000, 20))  # every reading of the clock jumps 20 s

    async for ai in ai_env("invalid_then_ok"):
        ai.env.container.ai._monotonic = lambda: float(next(ticks))
        project = await ai.project()
        response = await ai.post(SUGGEST.format(p=project["id"]))
        assert (response.status_code, error_code(response)) == (502, "AI_BAD_RESPONSE")
        assert ai.llm.calls == 1


async def test_tc438_a_timeout_is_a_503_and_is_not_retried() -> None:
    async for ai in ai_env("timeout"):
        project = await ai.project()
        response = await ai.post(SUGGEST.format(p=project["id"]))
        assert (response.status_code, error_code(response)) == (503, "AI_UNAVAILABLE")
        assert ai.llm.calls == 1
        assert (await ai.rows())[0].status == "provider_error"
        # Everything that is not AI still works (TC-448).
        assert (
            await ai.env.client.get("/api/v1/projects", headers=ai.env.auth(DEV))
        ).status_code == 200


async def test_tc438_a_provider_rate_limit_is_retried_once() -> None:
    async for ai in ai_env("rate_limited"):
        project = await ai.project()
        response = await ai.post(PRIORITIZE.format(p=project["id"]))
        assert (response.status_code, error_code(response)) == (503, "AI_UNAVAILABLE")
        assert ai.llm.calls == 2


async def test_tc439_the_per_minute_limit_gives_429_with_retry_after_and_is_recorded(
    ai: AiEnv,
) -> None:
    project = await ai.project()
    url = SUGGEST.format(p=project["id"])
    codes = [(await ai.post(url)).status_code for _ in range(5)]
    assert codes == [200] * 5
    ai.env.clock.advance(seconds=20)
    blocked = await ai.post(url)
    assert (blocked.status_code, error_code(blocked)) == (429, "AI_QUOTA_EXCEEDED")
    assert blocked.headers["Retry-After"] == "40"  # the oldest call leaves the minute in 40 s
    assert ai.llm.calls == 5  # a blocked call never reaches the provider
    assert (await ai.rows())[0].status == "quota_blocked"
    ai.env.clock.advance(seconds=41)
    assert (await ai.post(url)).status_code == 200


async def test_tc439_the_daily_limit_and_its_reset_time() -> None:
    async for ai in ai_env("ok", ai_daily_limit_per_user=3, ai_per_minute_limit=100):
        project = await ai.project()
        url = SUMMARY.format(p=project["id"])
        for _ in range(3):
            assert (await ai.post(url)).status_code == 200
        blocked = await ai.post(url)
        assert (blocked.status_code, error_code(blocked)) == (429, "AI_QUOTA_EXCEEDED")
        assert blocked.headers["Retry-After"] == str(12 * 3600)  # noon to the next UTC midnight
        ai.env.clock.advance(hours=12)
        ai.env.tokens[DEV] = (await ai.env.login(DEV)).json()["accessToken"]  # the old one expired
        assert (await ai.post(url)).status_code == 200  # a new UTC day


async def test_tc439_the_global_limit_covers_all_users() -> None:
    async for ai in ai_env("ok", ai_global_daily_limit=2, ai_per_minute_limit=100):
        project = await ai.project()
        url = SUMMARY.format(p=project["id"])
        assert (await ai.post(url, DEV)).status_code == 200
        assert (await ai.post(url, LEAD)).status_code == 200
        assert (await ai.post(url, DEV)).status_code == 429


@pytest.mark.sql
async def test_tc439_a_burst_cannot_slip_under_the_limit() -> None:
    async for ai in ai_env("ok", ai_per_minute_limit=5, ai_daily_limit_per_user=100):
        project = await ai.project()
        url = SUMMARY.format(p=project["id"])
        results = await asyncio.gather(*(ai.post(url) for _ in range(12)))
        assert sorted(r.status_code for r in results).count(200) == 5


async def test_tc440_every_call_writes_one_row_and_no_text(ai: AiEnv) -> None:
    project = await ai.project(description="the secret plan")
    await ai.post(SUGGEST.format(p=project["id"]), json={"brief": "a private brief"})
    rows = await ai.rows()
    assert len(rows) == 1
    row = rows[0]
    assert (row.feature, row.status, row.provider, row.model) == (
        "task_generation",
        "success",
        "fake",
        "fake-model",
    )
    assert row.prompt_version == load_prompt("task_generation_v1").version  # TC-446
    assert row.input_tokens > 0
    assert row.output_tokens > 0
    assert row.latency_ms >= 0
    assert "private" not in str(row)
    assert "secret" not in str(row)  # metadata only (ADR-411)


async def test_tc441_no_ai_endpoint_changes_any_data(ai: AiEnv) -> None:
    project = await ai.project()
    await ai.task(project["id"])
    before = await ai.counts()
    for path in (SUGGEST, PRIORITIZE, SUMMARY):
        assert (await ai.post(path.format(p=project["id"]))).status_code == 200
    assert await ai.counts() == before


async def test_tc468_usage_rows_older_than_90_days_are_purged(ai: AiEnv) -> None:
    project = await ai.project()
    await ai.post(SUMMARY.format(p=project["id"]))
    ai.env.clock.advance(days=89)
    assert await ai.env.container.ai.purge() == 0
    ai.env.clock.advance(days=2)
    assert await ai.env.container.ai.purge() == 1
    assert await ai.rows() == []
    assert timedelta(days=90) > timedelta(0)
