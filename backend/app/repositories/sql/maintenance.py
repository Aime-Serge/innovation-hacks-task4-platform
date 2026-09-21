"""Operator-only helpers that are not part of the repository contract (seed reset, FR-321)."""

from sqlalchemy import text

from app.repositories.sql.session import Database

# Children first, so no foreign key ever objects. The application role may DELETE, not TRUNCATE.
# Fixed statements, not built from names, so there is nothing to inject into.
_CLEAR = (
    text("DELETE FROM activity"),
    text("DELETE FROM tasks"),
    text("DELETE FROM projects"),
    text("DELETE FROM users"),
)


async def clear_all(database: Database) -> None:
    async with database.engine.begin() as connection:
        for statement in _CLEAR:
            await connection.execute(statement)
