"""Generate the ERD and the data dictionary from the live schema (FR-326, NFR-320).

    python scripts/generate_db_docs.py            write database/docs/erd.mmd and data-dictionary.md
    python scripts/generate_db_docs.py --check    fail when the files differ from the schema

The schema is read, through MIGRATION_DATABASE_URL, from a database the migrations built, so the
documents describe what the migrations really create and never a hand-written picture.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

DOCS = Path("database/docs")
ERD = DOCS / "erd.mmd"
DICTIONARY = DOCS / "data-dictionary.md"
TABLES = ("users", "projects", "tasks", "activity")
ACTIONS = {"a": "no action", "r": "restrict", "c": "cascade", "n": "set null", "d": "set default"}

COLUMNS = text(
    "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, c.is_generated, "
    "c.generation_expression FROM information_schema.columns c "
    "WHERE c.table_schema = 'public' AND c.table_name = :t ORDER BY c.ordinal_position"
)
CONSTRAINTS = text(
    "SELECT conname, contype::text AS kind, pg_get_constraintdef(oid) AS definition, "
    "confdeltype::text AS delete_action FROM pg_constraint "
    "WHERE conrelid = CAST(:t AS regclass) ORDER BY contype, conname"
)
INDEXES = text(
    "SELECT indexname, indexdef FROM pg_indexes "
    "WHERE schemaname = 'public' AND tablename = :t AND indexname NOT LIKE 'pk\\_%' "
    "ORDER BY indexname"
)
FOREIGN_KEYS = text(
    "SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent, "
    "a.attname AS column_name, a.attnotnull AS required FROM pg_constraint c "
    "JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] "
    "WHERE c.contype = 'f' ORDER BY 1, 3"
)


async def read_schema(url: str) -> dict[str, Any]:
    engine = create_async_engine(url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            schema: dict[str, Any] = {"tables": {}}
            for table in TABLES:
                params = {"t": table}
                schema["tables"][table] = {
                    "columns": (await connection.execute(COLUMNS, params)).all(),
                    "constraints": (await connection.execute(CONSTRAINTS, params)).all(),
                    "indexes": (await connection.execute(INDEXES, params)).all(),
                }
            schema["foreign_keys"] = (await connection.execute(FOREIGN_KEYS)).all()
    finally:
        await engine.dispose()
    return schema


def short_type(data_type: str) -> str:
    return {"timestamp with time zone": "timestamptz", "character varying": "text"}.get(
        data_type, data_type
    )


def render_erd(schema: dict[str, Any]) -> str:
    lines = ["erDiagram"]
    for fk in schema["foreign_keys"]:
        many = "o{"
        optional = "|o" if not fk.required else "||"
        lines.append(
            f"  {fk.parent.upper()} {optional}--{many} {fk.child.upper()} : {fk.column_name}"
        )
    for table, info in schema["tables"].items():
        primary = {
            c.definition.split("(")[1].rstrip(")") for c in info["constraints"] if c.kind == "p"
        }
        foreign = {fk.column_name for fk in schema["foreign_keys"] if fk.child == table}
        unique = {
            c.definition.split("(")[1].rstrip(")") for c in info["constraints"] if c.kind == "u"
        }
        lines.append(f"  {table.upper()} {{")
        for column in info["columns"]:
            name = column.column_name
            marks = [
                m
                for m, present in (
                    ("PK", name in primary),
                    ("FK", name in foreign),
                    ("UK", name in unique),
                )
                if present
            ]
            lines.append(
                f"    {short_type(column.data_type)} {name}"
                + (f" {','.join(marks)}" if marks else "")
            )
        lines.append("  }")
    return "\n".join(lines) + "\n"


def render_dictionary(schema: dict[str, Any]) -> str:
    out = [
        "# Data dictionary",
        "",
        "Generated from the live schema by `scripts/generate_db_docs.py`. Do not edit by hand:",
        "`make db-docs` rewrites it and `make db-docs-check` fails when it is out of date.",
        "",
    ]
    for table, info in schema["tables"].items():
        out += [
            f"## `{table}`",
            "",
            "| Column | Type | Null | Default |",
            "| --- | --- | --- | --- |",
        ]
        for c in info["columns"]:
            default = c.generation_expression if c.is_generated == "ALWAYS" else c.column_default
            note = (
                f"generated: `{default}`"
                if c.is_generated == "ALWAYS"
                else (f"`{default}`" if default else "")
            )
            nullable = c.is_nullable.lower()
            out.append(f"| `{c.column_name}` | {short_type(c.data_type)} | {nullable} | {note} |")
        out += ["", "| Constraint | Kind | Definition |", "| --- | --- | --- |"]
        kinds = {"p": "primary key", "f": "foreign key", "u": "unique", "c": "check"}
        for c in info["constraints"]:
            extra = f" (on delete {ACTIONS[c.delete_action]})" if c.kind == "f" else ""
            out.append(f"| `{c.conname}` | {kinds[c.kind]} | `{c.definition}`{extra} |")
        out += ["", "| Index | Definition |", "| --- | --- |"]
        for i in info["indexes"]:
            out.append(f"| `{i.indexname}` | `{i.indexdef}` |")
        out.append("")
    return "\n".join(out)


def main() -> int:
    url = os.environ.get("MIGRATION_DATABASE_URL")
    if not url:
        print("Invalid configuration. MIGRATION_DATABASE_URL: Field required", file=sys.stderr)
        return 1
    schema = asyncio.run(read_schema(url))
    erd, dictionary = render_erd(schema), render_dictionary(schema)
    if "--check" in sys.argv:
        stale = [
            p.name
            for p, body in ((ERD, erd), (DICTIONARY, dictionary))
            if not p.exists() or p.read_text() != body
        ]
        if stale:
            print(f"Out of date: {', '.join(stale)}. Run: make db-docs", file=sys.stderr)
            return 1
        print("ERD and data dictionary match the live schema.")
        return 0
    DOCS.mkdir(parents=True, exist_ok=True)
    ERD.write_text(erd)
    DICTIONARY.write_text(dictionary)
    print(f"Wrote {ERD} and {DICTIONARY}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
