"""Helpers shared by the in-memory repositories."""

import asyncio
from collections.abc import Callable
from datetime import date
from typing import Any
from uuid import UUID


class Store:
    """A lock so concurrent requests cannot interleave writes (section 8)."""

    def __init__(self) -> None:
        self.lock = asyncio.Lock()


def matches_text(fields: list[str], q: str | None) -> bool:
    """BR-05: case-insensitive, ignoring leading and trailing spaces."""
    needle = (q or "").strip().lower()
    return needle == "" or any(needle in text.lower() for text in fields)


def order[T](
    items: list[T],
    key: Callable[[T], Any],
    identity: Callable[[T], UUID],
    descending: bool,
) -> list[T]:
    """Sort, breaking ties by id so the order is stable (FR-229)."""
    by_id = sorted(items, key=lambda item: str(identity(item)))
    return sorted(by_id, key=key, reverse=descending)


def order_optional_date[T](
    items: list[T],
    value: Callable[[T], date | None],
    identity: Callable[[T], UUID],
    descending: bool,
) -> list[T]:
    """Undated items always sort last, whatever the direction."""
    dated = [item for item in items if value(item) is not None]
    undated = [item for item in items if value(item) is None]
    sorted_dated = order(dated, lambda item: value(item) or date.min, identity, descending)
    return sorted_dated + sorted(undated, key=lambda item: str(identity(item)))


def slice_page[T](items: list[T], page: int, page_size: int) -> list[T]:
    start = (page - 1) * page_size
    return items[start : start + page_size]
