"""Who may read which project (BR-401, BR-402): the one place that decides.

A `ReadScope` is built once per request by `services.visibility.read_scope` and handed to every
query. A lead sees everything; anyone else sees the projects they own or hold a task in.
Repositories only apply the scope; nothing else decides visibility (section 6).
"""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ReadScope:
    is_lead: bool
    project_ids: frozenset[UUID] = frozenset()

    def allows(self, project_id: UUID) -> bool:
        return self.is_lead or project_id in self.project_ids
