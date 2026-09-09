from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.deps import get_current_user
from app.exceptions import NotFoundError
from app.models.task import (
    TaskCreate,
    TaskInDB,
    TaskOut,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.models.user import UserInDB
from app.repositories.project_repo import project_repository
from app.repositories.task_repo import task_repository

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(get_current_user)])


def _get_owned_project(project_id: UUID, current_user: UserInDB):
    project = project_repository.get(project_id)
    if project is None or project.owner_id != current_user.id:
        raise NotFoundError(f"Project '{project_id}' not found.")
    return project


def _get_owned_task(task_id: UUID, current_user: UserInDB) -> TaskInDB:
    task = task_repository.get(task_id)
    if task is None:
        raise NotFoundError(f"Task '{task_id}' not found.")
    # A task is only visible/editable through a project the caller owns.
    _get_owned_project(task.project_id, current_user)
    return task


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate, current_user: UserInDB = Depends(get_current_user)
) -> TaskOut:
    _get_owned_project(payload.project_id, current_user)

    task = TaskInDB(
        title=payload.title,
        description=payload.description,
        project_id=payload.project_id,
        status=payload.status,
    )
    return task_repository.create(task).to_out()


@router.get("", response_model=list[TaskOut])
def list_tasks(
    project_id: UUID | None = None,
    status: TaskStatus | None = None,
    current_user: UserInDB = Depends(get_current_user),
) -> list[TaskOut]:
    if project_id is not None:
        _get_owned_project(project_id, current_user)
        owned_project_ids = {project_id}
    else:
        owned_project_ids = {p.id for p in project_repository.list(owner_id=current_user.id)}

    tasks = task_repository.list(project_id=project_id, status=status)
    return [task.to_out() for task in tasks if task.project_id in owned_project_ids]


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID, current_user: UserInDB = Depends(get_current_user)) -> TaskOut:
    return _get_owned_task(task_id, current_user).to_out()


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID, payload: TaskUpdate, current_user: UserInDB = Depends(get_current_user)
) -> TaskOut:
    task = _get_owned_task(task_id, current_user)

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    task.updated_at = datetime.now(timezone.utc)

    return task_repository.update(task).to_out()


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: UUID, payload: TaskStatusUpdate, current_user: UserInDB = Depends(get_current_user)
) -> TaskOut:
    task = _get_owned_task(task_id, current_user)

    task.status = payload.status
    task.updated_at = datetime.now(timezone.utc)

    return task_repository.update(task).to_out()


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, current_user: UserInDB = Depends(get_current_user)) -> None:
    _get_owned_task(task_id, current_user)
    task_repository.delete(task_id)
