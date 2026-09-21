"""The controlled profile lists, read from one file (MF-02, ADR-607).

`backend/config/profile_lists.json` is the only place the values are written. The enums, the
schemas, the migration and the database constraints all read it, and the frontend reads the same
file, so the four cannot disagree.
"""

import json
from dataclasses import dataclass
from pathlib import Path

LISTS_FILE = Path(__file__).resolve().parents[2] / "config" / "profile_lists.json"


@dataclass(frozen=True)
class Option:
    value: str
    label: str


@dataclass(frozen=True)
class Lists:
    disciplines: tuple[Option, ...]
    seniorities: tuple[Option, ...]
    employment_statuses: tuple[Option, ...]
    unknown_country: str
    countries: dict[str, str]

    @staticmethod
    def values(options: tuple[Option, ...]) -> tuple[str, ...]:
        return tuple(option.value for option in options)


def _options(raw: list[dict[str, str]]) -> tuple[Option, ...]:
    return tuple(Option(item["value"], item["label"]) for item in raw)


def load_lists(path: Path = LISTS_FILE) -> Lists:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Lists(
        disciplines=_options(raw["disciplines"]),
        seniorities=_options(raw["seniorities"]),
        employment_statuses=_options(raw["employmentStatuses"]),
        unknown_country=raw["unknownCountry"],
        countries={item["code"]: item["name"] for item in raw["countries"]},
    )


LISTS = load_lists()
DISCIPLINES = Lists.values(LISTS.disciplines)
SENIORITIES = Lists.values(LISTS.seniorities)
EMPLOYMENT_STATUSES = Lists.values(LISTS.employment_statuses)
COUNTRY_CODES = frozenset(LISTS.countries)
UNKNOWN_COUNTRY = LISTS.unknown_country


def sql_in(column: str, values: tuple[str, ...]) -> str:
    """`column IN ('a', 'b')` for a CHECK constraint. The values come from the file, not a user."""
    return f"{column} IN ({', '.join(repr(value) for value in values)})"
