from uuid import UUID

from app.db.models import TaskModel
from app.db.session import session_scope
from app.models.task import TaskInDB, TaskStatus


def _to_schema(row: TaskModel) -> TaskInDB:
    return TaskInDB(
        id=row.id,
        title=row.title,
        description=row.description,
        project_id=row.project_id,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class TaskRepository:
    """Postgres-backed store for Task 3, behind the same method
    signatures Task 2's in-memory store used."""

    def list(
        self, project_id: UUID | None = None, status: TaskStatus | None = None
    ) -> list[TaskInDB]:
        with session_scope() as session:
            query = session.query(TaskModel).order_by(TaskModel.created_at)
            if project_id is not None:
                query = query.filter(TaskModel.project_id == project_id)
            if status is not None:
                query = query.filter(TaskModel.status == status)
            return [_to_schema(row) for row in query.all()]

    def get(self, task_id: UUID) -> TaskInDB | None:
        with session_scope() as session:
            row = session.get(TaskModel, task_id)
            return _to_schema(row) if row is not None else None

    def create(self, task: TaskInDB) -> TaskInDB:
        with session_scope() as session:
            row = TaskModel(
                id=task.id,
                title=task.title,
                description=task.description,
                project_id=task.project_id,
                status=task.status,
            )
            session.add(row)
            session.flush()
            session.refresh(row)
            return _to_schema(row)

    def update(self, task: TaskInDB) -> TaskInDB:
        with session_scope() as session:
            row = session.get(TaskModel, task.id)
            row.title = task.title
            row.description = task.description
            row.status = task.status
            row.updated_at = task.updated_at
            session.flush()
            session.refresh(row)
            return _to_schema(row)

    def delete(self, task_id: UUID) -> None:
        with session_scope() as session:
            row = session.get(TaskModel, task_id)
            if row is not None:
                session.delete(row)


task_repository = TaskRepository()
