"""Helpers shared by the SQL repositories: escaping, ordering, pagination, guarded execution."""

import asyncio
from collections.abc import Callable, Sequence
from typing import Any, cast

from sqlalchemy import (
    CursorResult,
    Executable,
    Insert,
    Select,
    SQLColumnExpression,
    collate,
    func,
    select,
    text,
)
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ServiceUnavailable
from app.domain.queries import Page
from app.repositories.sql.errors import Operation, translate

TOTAL = "_total"


def like_pattern(term: str | None) -> str | None:
    """BR-308: `%`, `_` and `\\` in a search term match themselves; blank means no filter."""
    needle = (term or "").strip()
    if needle == "":
        return None
    escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def codepoint_order(expression: SQLColumnExpression[str]) -> SQLColumnExpression[str]:
    """Order text by code point, as the in-memory backend does, whatever the database locale."""
    return cast("SQLColumnExpression[str]", collate(expression, "C"))


async def run(
    session: AsyncSession, statement: Executable, operation: Operation
) -> CursorResult[Any]:
    """Execute a statement; a database failure becomes the API error for that operation."""
    try:
        async with asyncio.timeout(session.info.get("timeout")):
            return cast("CursorResult[Any]", await session.execute(statement))
    except TimeoutError:
        # The server stopped answering: drop the connection instead of waiting on it again, so a
        # dead database is reported within seconds and never holds a request open (NFR-312).
        await session.invalidate()
        raise ServiceUnavailable("A dependency is not ready.") from None
    except DBAPIError as error:
        mapped = translate(error, operation)
        if mapped is None:
            raise
        raise mapped from None


async def run_many(
    session: AsyncSession, statement: Insert, rows: Sequence[dict[str, Any]]
) -> None:
    """Bulk load with COPY, for seeding (FR-321).

    A row per round trip took over a minute for the xl profile, and compiling a statement with tens
    of thousands of bind parameters is nearly as slow. COPY streams the rows and takes seconds.
    """
    if not rows:
        return
    table = statement.table
    columns = list(rows[0])
    records = [tuple(row[column] for column in columns) for row in rows]
    try:
        connection = await session.connection()
        # A bulk load is allowed longer than a request is; the setting lasts one transaction.
        await connection.execute(text("SET LOCAL statement_timeout = '300s'"))
        raw = await connection.get_raw_connection()
        driver = raw.driver_connection
        if driver is None:
            raise RuntimeError("the pool returned a connection without a driver")
        await driver.copy_records_to_table(
            table.name,
            records=records,
            columns=columns,
            schema_name=table.schema or "public",
            timeout=300,  # the driver's own limit, kept longer than a request's
        )
    except DBAPIError as error:
        mapped = translate(error, "insert")
        if mapped is None:
            raise
        raise mapped from None


async def page_of[T](
    session: AsyncSession,
    statement: Select[Any],
    count_source: Select[Any],
    page: int,
    page_size: int,
    build: Callable[[Any], T],
    *,
    window: bool = False,
    with_total: bool = True,
) -> Page[T]:
    """One page of rows and the total.

    Small tables use a window count (`window=True`): the rows carry the total, so a list is one
    query (ADR-324). On a table of tens of thousands of rows that count forces the database to
    materialise and sort every match, which cost 130 ms per request at 20,000 tasks, so there the
    page is fetched alone and the total is counted separately, and only when the page is full:
    a short page already tells the total (ADR-328).
    """
    offset = (page - 1) * page_size
    if window:
        paged = statement.add_columns(func.count().over().label(TOTAL))
        rows = (await run(session, paged.limit(page_size).offset(offset), "read")).all()
        if rows:
            return Page([build(row) for row in rows], page, page_size, int(getattr(rows[0], TOTAL)))
    else:
        rows = (await run(session, statement.limit(page_size).offset(offset), "read")).all()
        if 0 < len(rows) < page_size or (rows and not with_total):
            return Page([build(row) for row in rows], page, page_size, offset + len(rows))
        if rows or page > 1:
            total = await _count(session, count_source)
            return Page([build(row) for row in rows], page, page_size, total)
        return Page([], page, page_size, 0)
    if page == 1:
        return Page([], page, page_size, 0)
    return Page([], page, page_size, await _count(session, count_source))


async def _count(session: AsyncSession, count_source: Select[Any]) -> int:
    counted = await run(session, select(func.count()).select_from(count_source.subquery()), "read")
    return int(counted.scalar_one())
