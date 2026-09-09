from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.deps import get_current_user
from app.exceptions import NotFoundError
from app.models.project import ProjectCreate, ProjectInDB, ProjectOut, ProjectUpdate
from app.models.user import UserInDB
from app.repositories.project_repo import project_repository

router = APIRouter(prefix="/projects", tags=["projects"], dependencies=[Depends(get_current_user)])


def _get_owned_project(project_id: UUID, current_user: UserInDB) -> ProjectInDB:
    project = project_repository.get(project_id)
    if project is None:
        raise NotFoundError(f"Project '{project_id}' not found.")
    if project.owner_id != current_user.id:
        # 404 rather than 403 — don't reveal that a project id exists to
        # a user who has no access to it.
        raise NotFoundError(f"Project '{project_id}' not found.")
    return project


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate, current_user: UserInDB = Depends(get_current_user)
) -> ProjectOut:
    project = ProjectInDB(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
    )
    return project_repository.create(project).to_out()


@router.get("", response_model=list[ProjectOut])
def list_projects(
    search: str | None = None, current_user: UserInDB = Depends(get_current_user)
) -> list[ProjectOut]:
    return [
        project.to_out()
        for project in project_repository.list(owner_id=current_user.id, search=search)
    ]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: UUID, current_user: UserInDB = Depends(get_current_user)
) -> ProjectOut:
    return _get_owned_project(project_id, current_user).to_out()


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectOut:
    project = _get_owned_project(project_id, current_user)

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description

    return project_repository.update(project).to_out()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID, current_user: UserInDB = Depends(get_current_user)
) -> None:
    _get_owned_project(project_id, current_user)
    project_repository.delete(project_id)
