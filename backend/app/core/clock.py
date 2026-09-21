"""Injected time and identifiers, so tests are deterministic (section 7)."""

from datetime import UTC, date, datetime
from typing import Protocol
from uuid import UUID, uuid4


class Clock(Protocol):
    def now(self) -> datetime: ...

    def today(self) -> date: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)

    def today(self) -> date:
        return datetime.now(UTC).date()


class IdFactory(Protocol):
    def new_id(self) -> UUID: ...


class UuidFactory:
    def new_id(self) -> UUID:
        return uuid4()
