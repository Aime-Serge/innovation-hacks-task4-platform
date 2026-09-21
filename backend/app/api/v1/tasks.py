from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.deps import ContainerDep, CurrentActor, CurrentUser, TaskId
from app.api.docs import errors
from app.domain.queries import TaskQuery
from app.domain.unset import UNSET
from app.schemas.common import PageOut
from app.schemas.tasks import StatusChange, TaskCreate, TaskListQuery, TaskOut, TaskUpdate
from app.services.tasks import NewTask, TaskChanges

router = APIRouter(prefix="/tasks", tags=["Tasks"])
_WRITE = ("PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "MALFORMED_REQUEST", "INTERNAL_ERROR")


def to_task_query(query: TaskListQuery, today: date) -> TaskQuery:
    return TaskQuery(
        q=query.q,
        statuses=query.status,
        priorities=query.priority,
        project_ids=query.project_id,
        assignee_ids=query.assignee_id,
        overdue=query.overdue,
        today=today,
        due_before=query.due_before,
        due_after=query.due_after,
        sort=query.sort_field,
        descending=query.descending,
        page=query.page,
        page_size=query.page_size,
    )


@router.post(
    "",
    status_code=201,
    response_model=TaskOut,
    summary="Create a task",
    description=(
        "By the project owner or a lead. Status starts as `todo`. An unknown `projectId` is a "
        "`422` on that field; a completed project rejects new tasks with `409 PROJECT_CLOSED`. "
        "Returns `201` with a `Location` header."
    ),
    responses=errors("UNAUTHENTICATED", "FORBIDDEN", "PROJECT_CLOSED", "VALIDATION_ERROR", *_WRITE),
)
async def create_task(
    payload: TaskCreate, response: Response, actor: CurrentActor, container: ContainerDep
) -> TaskOut:
    task = await container.tasks.create(
        actor,
        NewTask(
            payload.project_id,
            payload.title,
            payload.description,
            payload.priority,
            payload.due_date,
            payload.assignee_id,
        ),
    )
    response.headers["Location"] = f"/api/v1/tasks/{task.id}"
    return TaskOut.of(task)


@router.get(
    "",
    response_model=PageOut[TaskOut],
    summary="List tasks",
    description=(
        "Search `q` matches title and description. `status`, `priority`, `projectId` and "
        "`assigneeId` may repeat (OR inside one filter); different filters combine with AND. "
        "`overdue=true` means due before today and not done. Sort by `dueDate`, `priority`, "
        "`title` or `createdAt`."
    ),
    responses=errors("UNAUTHENTICATED", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def list_tasks(
    query: Annotated[TaskListQuery, Query()], _: CurrentUser, container: ContainerDep
) -> PageOut[TaskOut]:
    page = await container.tasks.list(to_task_query(query, container.clock.today()))
    return PageOut(
        items=[TaskOut.of(task) for task in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
    )


@router.get(
    "/{taskId}",
    response_model=TaskOut,
    summary="Get a task",
    description="Return one task, or `404 NOT_FOUND`.",
    responses=errors("UNAUTHENTICATED", "NOT_FOUND", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def get_task(task_id: TaskId, _: CurrentUser, container: ContainerDep) -> TaskOut:
    return TaskOut.of(await container.tasks.get(task_id))


@router.patch(
    "/{taskId}",
    response_model=TaskOut,
    summary="Update a task",
    description=(
        "Partial update of title, description, priority, due date and assignee, by the project "
        "owner, the assignee or a lead. `status` is not accepted here: use the status endpoint."
    ),
    responses=errors("UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", *_WRITE),
)
async def update_task(
    task_id: TaskId, payload: TaskUpdate, actor: CurrentActor, container: ContainerDep
) -> TaskOut:
    given = payload.model_fields_set
    changes = TaskChanges(
        title=payload.title if payload.title is not None else UNSET,
        description=payload.description if payload.description is not None else UNSET,
        priority=payload.priority if payload.priority is not None else UNSET,
        due_date=payload.due_date if "due_date" in given else UNSET,
        assignee_id=payload.assignee_id if "assignee_id" in given else UNSET,
    )
    return TaskOut.of(await container.tasks.update(actor, task_id, changes))


@router.patch(
    "/{taskId}/status",
    response_model=TaskOut,
    summary="Change a task's status",
    description=(
        "Follows the workflow: todo to in_progress; in_progress to in_review; in_review to "
        "in_progress or done; done to in_progress. Anything else is "
        "`409 INVALID_STATUS_TRANSITION` and lists the allowed statuses. Requesting the current "
        "status succeeds and changes nothing. `completedAt` is set on done and cleared on "
        "leaving it."
    ),
    responses=errors(
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "INVALID_STATUS_TRANSITION",
        "VALIDATION_ERROR",
        *_WRITE,
    ),
)
async def change_status(
    task_id: TaskId, payload: StatusChange, actor: CurrentActor, container: ContainerDep
) -> TaskOut:
    return TaskOut.of(await container.tasks.change_status(actor, task_id, payload.status))


@router.delete(
    "/{taskId}",
    status_code=204,
    summary="Delete a task",
    description="By the project owner or a lead. Deleting again gives `404`.",
    responses=errors(
        "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", "INTERNAL_ERROR"
    ),
)
async def delete_task(task_id: TaskId, actor: CurrentActor, container: ContainerDep) -> Response:
    await container.tasks.delete(actor, task_id)
    return Response(status_code=204)
