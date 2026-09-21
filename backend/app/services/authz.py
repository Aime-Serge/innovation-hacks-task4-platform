"""The single authorization layer: BR-202, BR-203 and BR-209 live here and nowhere else (FR-223)."""

from dataclasses import dataclass
from uuid import UUID

from app.core.errors import Forbidden
from app.domain.enums import Role
from app.domain.models import Project, Task


@dataclass(frozen=True)
class Actor:
    id: UUID
    role: Role

    @property
    def is_lead(self) -> bool:
        return self.role is Role.LEAD


def require_lead(actor: Actor) -> None:
    if not actor.is_lead:
        raise Forbidden("Only a lead may do this.")


def require_self_or_lead(actor: Actor, user_id: UUID) -> None:
    if not actor.is_lead and actor.id != user_id:
        raise Forbidden("You may only change your own profile.")


def require_project_manager(actor: Actor, project: Project) -> None:
    """BR-202 and the task create and delete rule of BR-203: the owner or a lead."""
    if not (actor.is_lead or project.owner_id == actor.id):
        raise Forbidden("Only the project owner or a lead may do this.")


def require_task_editor(actor: Actor, task: Task, project: Project) -> None:
    """BR-203: edit and status changes by the owner, the assignee or a lead."""
    allowed = actor.is_lead or project.owner_id == actor.id or task.assignee_id == actor.id
    if not allowed:
        raise Forbidden("Only the project owner, the assignee or a lead may change this task.")
