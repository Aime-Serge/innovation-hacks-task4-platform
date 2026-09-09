from uuid import UUID

from fastapi import APIRouter, status

from app.exceptions import NotFoundError
from app.models.project import ProjectCreate, ProjectInDB, ProjectOut
from app.repositories.project_repo import project_repository
from app.repositories.user_repo import user_repository

router = APIRouter(prefix="/projects", tags=["projects"], dependencies=[])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate) -> ProjectOut:
    if user_repository.get(payload.owner_id) is None:
        raise NotFoundError(f"Owner user '{payload.owner_id}' not found.")
    project = ProjectInDB(
        name=payload.name,
        description=payload.description,
        owner_id=payload.owner_id,
    )
    return project_repository.create(project).to_out()


@router.get("", response_model=list[ProjectOut])
def list_projects(owner_id: UUID | None = None) -> list[ProjectOut]:
    return [project.to_out() for project in project_repository.list(owner_id=owner_id)]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID) -> ProjectOut:
    project = project_repository.get(project_id)
    if project is None:
        raise NotFoundError(f"Project '{project_id}' not found.")
    return project.to_out()
