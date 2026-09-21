"""What the model may return, as strict schemas (BR-408, FR-428).

Every string is stripped of control characters before its length is checked, so a model cannot
smuggle terminal escapes or NULs into the interface or the database (TH-403).
"""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from pydantic.alias_generators import to_camel

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]")


def clean(value: object) -> object:
    """Tabs and newlines become spaces; every other control character is removed."""
    if isinstance(value, str):
        return _CONTROL.sub("", value.replace("\t", " ").replace("\n", " ")).strip()
    return value


Text = Annotated[str, BeforeValidator(clean)]
ShortText = Annotated[str, BeforeValidator(clean), Field(min_length=1, max_length=200)]
Priority = Literal["low", "medium", "high", "urgent"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class SuggestedTask(Strict):
    title: Text = Field(min_length=1, max_length=120)
    description: Text = Field(default="", max_length=500)
    priority: Priority
    due_in_days: int | None = Field(default=None, ge=0, le=90)


class TaskSuggestions(Strict):
    suggestions: list[SuggestedTask] = Field(max_length=10)


class PriorityItem(Strict):
    task: Text = Field(pattern=r"^T[0-9]{1,3}$", description="The alias: T1, T2 and so on.")
    rank: int = Field(ge=1, le=50)
    suggested_priority: Priority
    reason: Text = Field(max_length=200)


class Prioritization(Strict):
    items: list[PriorityItem] = Field(max_length=50)


class ProjectSummary(Strict):
    summary: Text = Field(min_length=1, max_length=800)
    risks: list[ShortText] = Field(max_length=5)
    next_steps: list[ShortText] = Field(max_length=5)
