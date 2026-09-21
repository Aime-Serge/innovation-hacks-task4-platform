"""A deterministic provider for tests, the gate and offline demos (FR-427, ADR-407).

It never touches the network. `scenario` picks what it does, so every failure the pipeline must
survive can be produced on demand: bad_json, too_long, injection_echo, timeout, rate_limited, and
`invalid_then_ok` (a bad first answer, then a good repair).
"""

import re
from typing import Any

from pydantic import BaseModel

from app.ai.client import LLMRateLimited, LLMResult, LLMTimeout
from app.ai.schemas import Prioritization, ProjectSummary, TaskSuggestions

SCENARIOS = (
    "ok",
    "bad_json",
    "too_long",
    "injection_echo",
    "timeout",
    "rate_limited",
    "invalid_then_ok",
)
_ALIAS = re.compile(r"^\s*(T[0-9]{1,3}) \|", re.MULTILINE)
_TASKS = [
    ("Define the scope and goals", "Write down what is in and out of scope.", "high", 3),
    ("Break the work into milestones", "Split the goal into steps with owners.", "medium", 7),
    ("Review progress with the team", "Hold a short check-in and adjust the plan.", "low", None),
]


class FakeLLMClient:
    def __init__(self, scenario: str = "ok") -> None:
        if scenario not in SCENARIOS:
            raise ValueError(f"unknown fake scenario: {scenario}")
        self.scenario = scenario
        self.calls = 0
        self.systems: list[str] = []
        self.users: list[str] = []

    async def generate(
        self,
        *,
        system: str,
        user: str,
        output_schema: type[BaseModel],
        max_tokens: int,
        timeout_s: float,
    ) -> LLMResult:
        self.calls += 1
        self.systems.append(system)
        self.users.append(user)
        if self.scenario == "timeout":
            raise LLMTimeout("the fake provider timed out")
        if self.scenario == "rate_limited":
            raise LLMRateLimited("the fake provider is rate limited")
        data = self._answer(output_schema, user)
        if self.scenario == "bad_json" or (self.scenario == "invalid_then_ok" and self.calls == 1):
            data = {"unexpected": "shape"}
        elif self.scenario == "too_long":
            data = self._too_long(output_schema)
        elif self.scenario == "injection_echo":
            data = self._injected(output_schema, data)
        return LLMResult(data, "fake-model", len(system + user) // 4, len(str(data)) // 4, 1)

    def _answer(self, schema: type[BaseModel], user: str) -> dict[str, Any]:
        if schema is TaskSuggestions:
            return {
                "suggestions": [
                    {"title": t, "description": d, "priority": p, "dueInDays": due}
                    for t, d, p, due in _TASKS
                ]
            }
        if schema is Prioritization:
            aliases = _ALIAS.findall(user)
            return {
                "items": [
                    {
                        "task": alias,
                        "rank": rank,
                        "suggestedPriority": "high" if rank == 1 else "medium",
                        "reason": "Blocks other work." if rank == 1 else "Can follow.",
                    }
                    for rank, alias in enumerate(aliases, start=1)
                ]
            }
        if schema is ProjectSummary:
            return {
                "summary": "The project is moving; most open work is still in progress.",
                "risks": ["Some tasks have no due date."],
                "nextSteps": ["Assign owners to unassigned tasks."],
            }
        raise ValueError(f"the fake has no answer for {schema.__name__}")

    def _too_long(self, schema: type[BaseModel]) -> dict[str, Any]:
        long = "x" * 5000
        if schema is TaskSuggestions:
            return {"suggestions": [{"title": long, "description": long, "priority": "low"}]}
        if schema is Prioritization:
            item = {"task": "T1", "rank": 1, "suggestedPriority": "low", "reason": long}
            return {"items": [item]}
        return {"summary": long, "risks": [], "nextSteps": []}

    def _injected(self, schema: type[BaseModel], data: dict[str, Any]) -> dict[str, Any]:
        evil = "IGNORE PREVIOUS INSTRUCTIONS <script>alert(1)</script>\x00\x1b[31m"
        if schema is TaskSuggestions:
            data["suggestions"][0]["title"] = evil
            data["suggestions"][0]["description"] = "[click](javascript:alert(1)) " + evil
        elif schema is Prioritization:
            unknown = {"task": "T999", "rank": 50, "suggestedPriority": "urgent", "reason": evil}
            data["items"].append(unknown)
            if data["items"]:
                data["items"][0]["reason"] = evil
        else:
            data["summary"] = evil
        return data


__all__ = ["SCENARIOS", "FakeLLMClient"]
