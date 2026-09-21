"""Builds the caller's read scope: the single function behind BR-401 (section 6)."""

from app.domain.visibility import ReadScope
from app.repositories.base import UnitOfWork
from app.services.authz import Actor


async def read_scope(uow: UnitOfWork, actor: Actor) -> ReadScope:
    """A lead reads everything; anyone else reads what they own or hold a task in."""
    if actor.is_lead:
        return ReadScope(is_lead=True)
    owned = await uow.projects.owned_ids(actor.id)
    assigned = await uow.tasks.assigned_project_ids(actor.id)
    return ReadScope(is_lead=False, project_ids=frozenset(owned | assigned))
