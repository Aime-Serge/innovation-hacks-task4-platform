from uuid import UUID

from app.db.models import ProjectModel
from app.db.session import session_scope
from app.models.project import ProjectInDB


def _to_schema(row: ProjectModel) -> ProjectInDB:
    return ProjectInDB(
        id=row.id,
        name=row.name,
        description=row.description,
        owner_id=row.owner_id,
        created_at=row.created_at,
    )


class ProjectRepository:
    """Postgres-backed store for Task 3, behind the same method
    signatures Task 2's in-memory store used."""

    def list(self, owner_id: UUID | None = None) -> list[ProjectInDB]:
        with session_scope() as session:
            query = session.query(ProjectModel).order_by(ProjectModel.created_at)
            if owner_id is not None:
                query = query.filter(ProjectModel.owner_id == owner_id)
            return [_to_schema(row) for row in query.all()]

    def get(self, project_id: UUID) -> ProjectInDB | None:
        with session_scope() as session:
            row = session.get(ProjectModel, project_id)
            return _to_schema(row) if row is not None else None

    def create(self, project: ProjectInDB) -> ProjectInDB:
        with session_scope() as session:
            row = ProjectModel(
                id=project.id,
                name=project.name,
                description=project.description,
                owner_id=project.owner_id,
            )
            session.add(row)
            session.flush()
            session.refresh(row)
            return _to_schema(row)


project_repository = ProjectRepository()
