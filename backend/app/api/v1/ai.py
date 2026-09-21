from typing import Annotated

from fastapi import APIRouter, Body

from app.ai.service import Meta
from app.api.deps import ContainerDep, CurrentActor, ProjectId
from app.api.docs import errors
from app.schemas.ai import (
    AiStatusOut,
    AiSummaryOut,
    MetaOut,
    PrioritizationOut,
    QuotaOut,
    RankedTaskOut,
    SuggestionOut,
    SuggestionsOut,
    TaskSuggestionRequest,
)

router = APIRouter(prefix="/ai", tags=["AI"])
_AI_ERRORS = ("AI_DISABLED", "AI_UNAVAILABLE", "AI_BAD_RESPONSE", "AI_QUOTA_EXCEEDED")


def _meta(meta: Meta) -> MetaOut:
    return MetaOut(model=meta.model, prompt_version=meta.prompt_version, request_id=meta.request_id)


@router.get(
    "/status",
    response_model=AiStatusOut,
    summary="AI status",
    description=(
        "Whether AI is switched on, which features exist, and how many calls the caller has left "
        "today (UTC). The interface shows AI actions only when `enabled` is true."
    ),
    responses=errors("UNAUTHENTICATED", "INTERNAL_ERROR"),
)
async def ai_status(actor: CurrentActor, container: ContainerDep) -> AiStatusOut:
    status = await container.ai.status(actor)
    return AiStatusOut(
        enabled=status.enabled,
        features=status.features,
        quota=QuotaOut(
            daily_limit=status.daily_limit,
            remaining_today=status.remaining_today,
            resets_at=status.resets_at,
        ),
    )


@router.post(
    "/projects/{projectId}/task-suggestions",
    response_model=SuggestionsOut,
    summary="Suggest tasks",
    description=(
        "Suggests tasks for a project. Nothing is saved: the person reviews the suggestions and "
        "adds them through `POST /tasks`. Needs the right to create tasks in the project."
    ),
    responses=errors(
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "VALIDATION_ERROR",
        *_AI_ERRORS,
        "INTERNAL_ERROR",
    ),
)
async def suggest_tasks(
    project_id: ProjectId,
    actor: CurrentActor,
    container: ContainerDep,
    payload: Annotated[TaskSuggestionRequest | None, Body()] = None,
) -> SuggestionsOut:
    body = payload or TaskSuggestionRequest()
    result = await container.ai.suggest_tasks(actor, project_id, body.brief, body.count)
    return SuggestionsOut(
        suggestions=[
            SuggestionOut(
                title=s.title,
                description=s.description,
                priority=s.priority,
                due_in_days=s.due_in_days,
            )
            for s in result.suggestions
        ],
        meta=_meta(result.meta),
    )


@router.post(
    "/projects/{projectId}/prioritization",
    response_model=PrioritizationOut,
    summary="Suggest priorities",
    description=(
        "Ranks the project's open tasks (up to 50) and suggests a priority and a reason for each. "
        "Nothing is changed: accepting a suggestion uses the normal task update."
    ),
    responses=errors(
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "VALIDATION_ERROR",
        *_AI_ERRORS,
        "INTERNAL_ERROR",
    ),
)
async def prioritize(
    project_id: ProjectId, actor: CurrentActor, container: ContainerDep
) -> PrioritizationOut:
    result = await container.ai.prioritize(actor, project_id)
    return PrioritizationOut(
        items=[
            RankedTaskOut(
                task_id=i.task_id,
                rank=i.rank,
                suggested_priority=i.suggested_priority,  # type: ignore[arg-type]  # reason: validated Literal
                reason=i.reason,
            )
            for i in result.items
        ],
        meta=_meta(result.meta),
    )


@router.post(
    "/projects/{projectId}/summary",
    response_model=AiSummaryOut,
    summary="Summarise a project",
    description=(
        "A short progress summary with up to five risks and five next steps, built from the "
        "project's counts and task titles. Anyone who can read the project may ask."
    ),
    responses=errors(
        "UNAUTHENTICATED", "NOT_FOUND", "VALIDATION_ERROR", *_AI_ERRORS, "INTERNAL_ERROR"
    ),
)
async def summarize(
    project_id: ProjectId, actor: CurrentActor, container: ContainerDep
) -> AiSummaryOut:
    result = await container.ai.summarize(actor, project_id)
    return AiSummaryOut(
        summary=result.summary,
        risks=result.risks,
        next_steps=result.next_steps,
        meta=_meta(result.meta),
    )
