from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.deps import ContainerDep, CurrentActor, CurrentUser, ProjectId
from app.api.docs import errors
from app.api.v1.tasks import to_task_query
from app.domain.queries import ProjectQuery
from app.domain.unset import UNSET
from app.schemas.common import PageOut
from app.schemas.projects import ProjectCreate, ProjectListQuery, ProjectOut, ProjectUpdate
from app.schemas.tasks import TaskListQuery, TaskOut
from app.services.projects import ProjectChanges

router = APIRouter(prefix="/projects", tags=["Projects"])
_WRITE = ("PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "MALFORMED_REQUEST", "INTERNAL_ERROR")


@router.post(
    "",
    status_code=201,
    response_model=ProjectOut,
    summary="Create a project",
    description=(
        "The caller becomes the owner. Status defaults to `planned`. "
        "Returns `201` with a `Location` header."
    ),
    responses=errors("UNAUTHENTICATED", "VALIDATION_ERROR", *_WRITE),
)
async def create_project(
    payload: ProjectCreate, response: Response, actor: CurrentActor, container: ContainerDep
) -> ProjectOut:
    view = await container.projects.create(
        actor, payload.name, payload.description, payload.status, payload.due_date
    )
    response.headers["Location"] = f"/api/v1/projects/{view.project.id}"
    return ProjectOut.of(view.project, view.progress)


@router.get(
    "",
    response_model=PageOut[ProjectOut],
    summary="List projects",
    description=(
        "Paginated, sorted by `dueDate`, `name` or `createdAt`. `status` may repeat (OR); "
        "different filters combine with AND. Every item carries its `progress`."
    ),
    responses=errors("UNAUTHENTICATED", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def list_projects(
    query: Annotated[ProjectListQuery, Query()], _: CurrentUser, container: ContainerDep
) -> PageOut[ProjectOut]:
    page = await container.projects.list(
        ProjectQuery(
            q=query.q,
            statuses=query.status,
            owner_id=query.owner_id,
            sort=query.sort_field,
            descending=query.descending,
            page=query.page,
            page_size=query.page_size,
        )
    )
    return PageOut(
        items=[ProjectOut.of(view.project, view.progress) for view in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
    )


@router.get(
    "/{projectId}",
    response_model=ProjectOut,
    summary="Get a project",
    description="Return one project with its calculated progress (done tasks over total, BR-03).",
    responses=errors("UNAUTHENTICATED", "NOT_FOUND", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def get_project(project_id: ProjectId, _: CurrentUser, container: ContainerDep) -> ProjectOut:
    view = await container.projects.get(project_id)
    return ProjectOut.of(view.project, view.progress)


@router.patch(
    "/{projectId}",
    response_model=ProjectOut,
    summary="Update a project",
    description="Partial update by the owner or a lead.",
    responses=errors("UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", *_WRITE),
)
async def update_project(
    project_id: ProjectId, payload: ProjectUpdate, actor: CurrentActor, container: ContainerDep
) -> ProjectOut:
    given = payload.model_fields_set
    changes = ProjectChanges(
        name=payload.name if "name" in given and payload.name is not None else UNSET,
        description=payload.description if payload.description is not None else UNSET,
        status=payload.status if payload.status is not None else UNSET,
        due_date=payload.due_date if "due_date" in given else UNSET,
    )
    view = await container.projects.update(actor, project_id, changes)
    return ProjectOut.of(view.project, view.progress)


@router.delete(
    "/{projectId}",
    status_code=204,
    summary="Delete a project",
    description="By the owner or a lead. A project that still has tasks cannot be deleted.",
    responses=errors(
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "PROJECT_NOT_EMPTY",
        "VALIDATION_ERROR",
        "INTERNAL_ERROR",
    ),
)
async def delete_project(
    project_id: ProjectId, actor: CurrentActor, container: ContainerDep
) -> Response:
    await container.projects.delete(actor, project_id)
    return Response(status_code=204)


@router.get(
    "/{projectId}/tasks",
    response_model=PageOut[TaskOut],
    summary="List a project's tasks",
    description="The same filters as `GET /tasks`; the project is fixed by the path.",
    responses=errors("UNAUTHENTICATED", "NOT_FOUND", "VALIDATION_ERROR", "INTERNAL_ERROR"),
)
async def list_project_tasks(
    project_id: ProjectId,
    query: Annotated[TaskListQuery, Query()],
    _: CurrentUser,
    container: ContainerDep,
) -> PageOut[TaskOut]:
    page = await container.tasks.list_for_project(
        project_id, to_task_query(query, container.clock.today())
    )
    return PageOut(
        items=[TaskOut.of(task) for task in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
    )
