import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import get_settings
from app.deps import get_current_user
from app.exceptions import NotFoundError
from app.models.task import TaskPriority
from app.models.user import UserInDB
from app.repositories.project_repo import project_repository

logger = logging.getLogger("app.ai")

router = APIRouter(prefix="/projects/{project_id}/ai", tags=["ai"], dependencies=[Depends(get_current_user)])

_MAX_TASKS = 8
_REQUEST_TIMEOUT_MS = 30_000

# Gemini's structured-output mode (response_mime_type="application/json" +
# response_schema) is the equivalent of Anthropic's forced tool-use: the
# model is constrained to emit exactly this shape, not prose to regex out.
_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short, actionable task title (max ~80 chars)."},
                    "description": {"type": "string", "description": "1-2 sentence description of what the task involves."},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": ["title", "description", "priority"],
            },
        }
    },
    "required": ["tasks"],
}


class GenerateTasksRequest(BaseModel):
    instructions: str | None = Field(default=None, max_length=1000)
    count: int = Field(default=5, ge=1, le=_MAX_TASKS)


class GeneratedTask(BaseModel):
    title: str
    description: str
    priority: TaskPriority


class GenerateTasksResponse(BaseModel):
    source: str  # "ai" | "fallback"
    tasks: list[GeneratedTask]


def _fallback_tasks(project_name: str, count: int) -> list[GeneratedTask]:
    """Deterministic, no-network task breakdown used whenever the AI call
    can't run — no API key configured, the provider is unreachable, or the
    response can't be parsed. This is what "real fallback" means here: the
    feature keeps working, honestly labeled as non-AI output."""
    templates = [
        ("Define requirements", f"Write down concrete requirements and success criteria for {project_name}.", TaskPriority.high),
        ("Design the approach", f"Sketch the architecture or approach for {project_name} before building.", TaskPriority.high),
        ("Build the core functionality", f"Implement the primary feature(s) of {project_name}.", TaskPriority.medium),
        ("Write tests", f"Add automated tests covering {project_name}'s core behavior.", TaskPriority.medium),
        ("Document the result", f"Write a README or summary explaining {project_name} and how to use it.", TaskPriority.low),
        ("Review and polish", f"Do a self-review pass on {project_name} and fix rough edges.", TaskPriority.low),
        ("Gather feedback", f"Share {project_name} with someone else and collect feedback.", TaskPriority.medium),
        ("Plan next steps", f"Decide what comes after this iteration of {project_name}.", TaskPriority.low),
    ]
    return [
        GeneratedTask(title=title, description=description, priority=priority)
        for title, description, priority in templates[:count]
    ]


def _call_gemini(project_name: str, project_description: str | None, instructions: str | None, count: int) -> list[GeneratedTask] | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    # Imported here rather than at module level: the SDK costs about 1.3s of
    # CPU to import (roughly a third of this app's whole startup), and the
    # fallback path above never needs it. On a free tier that throttles CPU
    # and sleeps when idle, that is a large share of every cold start.
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types as genai_types

    prompt = (
        f"Project name: {project_name}\n"
        f"Project description: {project_description or '(none provided)'}\n"
        f"Additional instructions from the user: {instructions or '(none)'}\n\n"
        f"Propose exactly {count} concrete, actionable tasks that would move this project forward. "
        "Keep titles short and descriptions to 1-2 sentences."
    )

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                http_options=genai_types.HttpOptions(timeout=_REQUEST_TIMEOUT_MS),
            ),
        )
    except genai_errors.APIError as exc:
        # Covers both ClientError (4xx, including rate limiting) and
        # ServerError (5xx) — both subclass APIError.
        logger.warning("Gemini API call failed, falling back to templated tasks: %s", exc)
        return None
    except Exception:
        # Timeouts and network failures surface as plain httpx/transport
        # exceptions, not APIError — caught here instead.
        logger.exception("Unexpected error calling Gemini API, falling back to templated tasks")
        return None

    try:
        parsed = json.loads(response.text)
        raw_tasks = parsed["tasks"]
        return [GeneratedTask(**task) for task in raw_tasks[:count]]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        logger.warning("Gemini response had an unexpected shape, falling back to templated tasks")
        return None


@router.post("/generate-tasks", response_model=GenerateTasksResponse)
def generate_tasks(
    project_id: UUID,
    payload: GenerateTasksRequest,
    current_user: UserInDB = Depends(get_current_user),
) -> GenerateTasksResponse:
    project = project_repository.get(project_id)
    if project is None or project.owner_id != current_user.id:
        raise NotFoundError(f"Project '{project_id}' not found.")

    ai_tasks = _call_gemini(project.name, project.description, payload.instructions, payload.count)
    if ai_tasks is not None:
        return GenerateTasksResponse(source="ai", tasks=ai_tasks)

    return GenerateTasksResponse(source="fallback", tasks=_fallback_tasks(project.name, payload.count))
