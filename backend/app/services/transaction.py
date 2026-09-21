"""One place that opens a unit of work, commits it, and retries a transient failure (BR-305)."""

from collections.abc import Awaitable, Callable
from typing import Final

from app.core.errors import ServiceUnavailable
from app.repositories.base import TransientStoreError, UnitOfWork

# `read_only=True` asks for a unit of work that will only read (the SQL one then skips the
# transaction); a factory that has no such distinction ignores it.
UowFactory = Callable[..., UnitOfWork]

RETRIES: Final = 2  # a deadlock or lock timeout is retried at most twice, then it is a 503


async def read[T](factory: UowFactory, work: Callable[[UnitOfWork], Awaitable[T]]) -> T:
    """Run read-only work in its own short transaction; nothing is committed."""
    return await _run(factory, work, commit=False)


async def write[T](factory: UowFactory, work: Callable[[UnitOfWork], Awaitable[T]]) -> T:
    """Run work that changes data: it commits together or rolls back together."""
    return await _run(factory, work, commit=True)


async def _run[T](
    factory: UowFactory, work: Callable[[UnitOfWork], Awaitable[T]], *, commit: bool
) -> T:
    attempt = 0
    while True:
        try:
            async with factory(read_only=not commit) if not commit else factory() as uow:
                result = await work(uow)
                if commit:
                    await uow.commit()
                return result
        except TransientStoreError:
            attempt += 1
            if attempt > RETRIES:
                raise ServiceUnavailable("The service is busy. Try again shortly.") from None
