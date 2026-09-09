from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, status

from app.exceptions import NotFoundError
from app.models.task import (
    TaskCreate,
    TaskInDB,
    TaskOut,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.repositories.project_repo import project_repository
from app.repositories.task_repo import task_repository

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[])


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> TaskOut:
    if project_repository.get(payload.project_id) is None:
        raise NotFoundError(f"Project '{payload.project_id}' not found.")
    task = TaskInDB(
        title=payload.title,
        description=payload.description,
        project_id=payload.project_id,
        status=payload.status,
    )
    return task_repository.create(task).to_out()


@router.get("", response_model=list[TaskOut])
def list_tasks(
    project_id: UUID | None = None, status: TaskStatus | None = None
) -> list[TaskOut]:
    return [
        task.to_out()
        for task in task_repository.list(project_id=project_id, status=status)
    ]


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID) -> TaskOut:
    task = task_repository.get(task_id)
    if task is None:
        raise NotFoundError(f"Task '{task_id}' not found.")
    return task.to_out()


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskUpdate) -> TaskOut:
    task = task_repository.get(task_id)
    if task is None:
        raise NotFoundError(f"Task '{task_id}' not found.")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    task.updated_at = datetime.now(timezone.utc)

    return task_repository.update(task).to_out()


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(task_id: UUID, payload: TaskStatusUpdate) -> TaskOut:
    task = task_repository.get(task_id)
    if task is None:
        raise NotFoundError(f"Task '{task_id}' not found.")

    task.status = payload.status
    task.updated_at = datetime.now(timezone.utc)

    return task_repository.update(task).to_out()


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID) -> None:
    task = task_repository.get(task_id)
    if task is None:
        raise NotFoundError(f"Task '{task_id}' not found.")
    task_repository.delete(task_id)
