"""The in-memory unit of work: shared repositories, so it serves fast unit tests only (ADR-312).

There is nothing to roll back, so `commit` is a no-op and a failure part-way through an operation
leaves earlier writes in place. Atomicity (BR-305) is a property of the SQL backend.
"""

from types import TracebackType
from typing import Self

from app.repositories.memory.activity import MemoryActivityRepository
from app.repositories.memory.projects import MemoryProjectRepository
from app.repositories.memory.tasks import MemoryTaskRepository
from app.repositories.memory.users import MemoryUserRepository


class MemoryUnitOfWork:
    def __init__(
        self,
        users: MemoryUserRepository,
        projects: MemoryProjectRepository,
        tasks: MemoryTaskRepository,
        activity: MemoryActivityRepository,
    ) -> None:
        self.users = users
        self.projects = projects
        self.tasks = tasks
        self.activity = activity

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        return None

    async def commit(self) -> None:
        return None
