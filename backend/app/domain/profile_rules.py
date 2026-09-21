"""Profile rules that need no storage: names, links, time zones, completeness, headline (MB-04).

The same regular expressions guard the database constraints `ck_profiles_github_url_https` and
`ck_profiles_linkedin_url_https`, so a link the service accepts is one the database accepts.
"""

import re
from dataclasses import dataclass
from functools import cache
from zoneinfo import available_timezones

from app.domain import lists
from app.domain.enums import EmploymentStatus
from app.domain.models import Profile, User

MAX_DISPLAY_NAME = 80  # users.name allows 80 characters (ADR-612)
LEGACY = "legacy"
_HOST = r"^https://([A-Za-z0-9-]+\.)?{host}([/?#]|$)"
GITHUB_URL = re.compile(_HOST.format(host=r"github\.com"), re.IGNORECASE)
LINKEDIN_URL = re.compile(_HOST.format(host=r"linkedin\.com"), re.IGNORECASE)
# Unicode letters, with combining marks, joined by single spaces, hyphens or apostrophes.
_LETTER = r"[^\W\d_]"
_MARKS = r"[\u0300-\u036f]*"
_NAME = re.compile(rf"^{_LETTER}{_MARKS}(?:[ '\u2019-]?{_LETTER}{_MARKS})*$")
_NEEDS_WORK_DETAILS = (EmploymentStatus.EMPLOYED, EmploymentStatus.FREELANCE)


def is_person_name(value: str) -> bool:
    return _NAME.fullmatch(value) is not None


def compose_name(given: str, family: str) -> str:
    return f"{given} {family}"


@cache
def _zones() -> frozenset[str]:
    return frozenset(available_timezones())


def is_time_zone(value: str) -> bool:
    return len(value) <= 64 and value in _zones()


def is_country(value: str) -> bool:
    """A real ISO 3166-1 alpha-2 code. The reserved unknown code is only ever a backfill."""
    return value in lists.COUNTRY_CODES and value != lists.UNKNOWN_COUNTRY


def needs_work_details(status: EmploymentStatus) -> bool:
    return status in _NEEDS_WORK_DETAILS


def _label(options: tuple[lists.Option, ...], value: str) -> str:
    return next((o.label for o in options if o.value == value), value)


def display_headline(profile: Profile) -> str | None:
    """The stored headline, else "Senior Backend engineer at Acme" composed from the details."""
    if profile.headline:
        return profile.headline
    if profile.terms_version == LEGACY and not profile.company_name:
        return None  # nothing real to compose from
    seniority = _label(lists.LISTS.seniorities, profile.seniority.value)
    discipline = _label(lists.LISTS.disciplines, profile.discipline.value)
    role = "software professional" if discipline == "Other" else f"{discipline} engineer"
    text = f"{seniority} {role}"
    return f"{text} at {profile.company_name}" if profile.company_name else text


@dataclass(frozen=True)
class Completeness:
    percent: int
    next: str | None


def completeness(user: User, profile: Profile) -> Completeness:
    """The section 3 table: registration alone earns 50, and each further part its own points."""
    legacy = profile.terms_version == LEGACY
    parts: list[tuple[int, bool, str]] = [
        (
            10,
            user.given_name is not None and user.family_name is not None,
            "Add your given and family name",
        ),
        (
            15,
            not legacy or profile.discipline.value != "other" or profile.seniority.value != "mid",
            "Choose your discipline and seniority",
        ),
        (
            15,
            not legacy or profile.employment_status is not EmploymentStatus.BETWEEN_ROLES,
            "Tell us about your work",
        ),
        (
            10,
            not legacy or profile.country_code != lists.UNKNOWN_COUNTRY,
            "Set your country and time zone",
        ),
        (10, bool(profile.headline), "Write a short headline"),
        (15, bool(profile.about), "Write a few lines about yourself"),
        (15, len(profile.skills) >= 3, "Add at least three skills"),
        (
            10,
            any((profile.github_url, profile.linkedin_url, profile.website_url)),
            "Add a link to GitHub, LinkedIn or your website",
        ),
    ]
    earned = sum(points for points, done, _ in parts if done)
    missing = next((message for _, done, message in parts if not done), None)
    return Completeness(earned, missing)
