"""Builds prompts from the least data the feature needs (BR-406, BR-407, FR-433).

Tasks are named T1, T2 and so on, never by id; no name, email, token or identifier is sent; due
dates are relative to today; and everything a person wrote is escaped, length limited and placed
inside labelled delimiters so it reads as data, not as instructions.
"""

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from uuid import UUID

from app.domain.enums import TaskStatus
from app.domain.models import Project, Task

MAX_TASKS = 50
_PROMPTS = Path(__file__).parent / "prompts"


@dataclass(frozen=True)
class Prompt:
    version: str
    text: str


@dataclass(frozen=True)
class BuiltPrompt:
    system: str
    user: str
    version: str
    aliases: dict[str, UUID]  # T1 -> real id, kept server side and never sent


def load_prompt(name: str) -> Prompt:
    first, _, body = (_PROMPTS / f"{name}.md").read_text().partition("\n")
    return Prompt(first.removeprefix("version:").strip(), body.strip())


def neutralise(text: str, limit: int) -> str:
    """Escape markup that could close a delimiter, drop control characters, and cap the length."""
    kept = "".join(ch if ch in "\n\t" or (ch >= " " and ord(ch) != 0x7F) else " " for ch in text)
    return kept.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")[:limit].strip()


def due_phrase(due: date | None, today: date) -> str:
    if due is None:
        return "no due date"
    days = (due - today).days
    if days == 0:
        return "due today"
    return f"due in {days} days" if days > 0 else f"overdue by {-days} days"


def _task_lines(tasks: list[Task], today: date) -> tuple[list[str], dict[str, UUID]]:
    aliases: dict[str, UUID] = {}
    lines: list[str] = []
    for number, task in enumerate(tasks[:MAX_TASKS], start=1):
        alias = f"T{number}"
        aliases[alias] = task.id
        title = neutralise(task.title, 120)
        due = due_phrase(task.due_date, today)
        lines.append(f"  {alias} | {task.status.value} | {task.priority.value} | {due} | {title}")
    return lines, aliases


def _project_block(project: Project, lines: list[str]) -> str:
    listing = "\n".join(lines) if lines else "  (no tasks yet)"
    return (
        "<project_data>\n"
        f"name: {neutralise(project.name, 80)}\n"
        f"description: {neutralise(project.description, 1000)}\n"
        f"existing_tasks:\n{listing}\n"
        "</project_data>"
    )


def build_task_generation(
    project: Project, tasks: list[Task], brief: str | None, count: int, today: date
) -> BuiltPrompt:
    prompt = load_prompt("task_generation_v1")
    lines, aliases = _task_lines(tasks, today)
    wanted = neutralise(brief or "", 1000)
    user = f"{_project_block(project, lines)}\n<user_brief>{wanted}</user_brief>"
    return BuiltPrompt(prompt.text.replace("{count}", str(count)), user, prompt.version, aliases)


def build_prioritization(project: Project, tasks: list[Task], today: date) -> BuiltPrompt:
    prompt = load_prompt("prioritization_v1")
    open_tasks = [t for t in tasks if t.status is not TaskStatus.DONE]
    lines, aliases = _task_lines(open_tasks, today)
    return BuiltPrompt(prompt.text, _project_block(project, lines), prompt.version, aliases)


def build_summary(project: Project, tasks: list[Task], today: date) -> BuiltPrompt:
    prompt = load_prompt("project_summary_v1")
    done = sum(1 for t in tasks if t.status is TaskStatus.DONE)
    overdue = sum(
        1 for t in tasks if t.status is not TaskStatus.DONE and t.due_date and t.due_date < today
    )
    lines, aliases = _task_lines(tasks, today)
    counts = f"counts: total {len(tasks)}, done {done}, open {len(tasks) - done}, overdue {overdue}"
    user = _project_block(project, lines).replace("</project_data>", f"{counts}\n</project_data>")
    return BuiltPrompt(prompt.text, user, prompt.version, aliases)
