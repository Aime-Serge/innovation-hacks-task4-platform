"""Profile request and response models (MF-02, MF-06, MF-08). Every request is `extra=forbid`.

Free text is plain text: markup is stored as typed and shown as text, never interpreted (MB-04).
"""

from typing import Annotated, ClassVar, Self

from pydantic import AfterValidator, Field, StrictBool, StringConstraints, field_validator

from app.domain import profile_rules
from app.domain.enums import Discipline, EmploymentStatus, Seniority, Theme
from app.domain.models import Profile
from app.schemas.base import (
    BAD,
    CLEAN,
    NOT_BLANK,
    ApiModel,
    HttpsUrl,
    OutModel,
    PatchModel,
)


def _person_name(value: str) -> str:
    if not profile_rules.is_person_name(value):
        raise ValueError("Use letters, spaces, hyphens and apostrophes only.")
    return value


def _country(value: str) -> str:
    if not profile_rules.is_country(value):
        raise ValueError("Choose a country from the list.")
    return value


def _time_zone(value: str) -> str:
    if not profile_rules.is_time_zone(value):
        raise ValueError("Choose a time zone from the list, such as Africa/Kigali.")
    return value


def _github(value: str) -> str:
    if not profile_rules.GITHUB_URL.match(value):
        raise ValueError("Must be a link to github.com.")
    return value


def _linkedin(value: str) -> str:
    if not profile_rules.LINKEDIN_URL.match(value):
        raise ValueError("Must be a link to linkedin.com.")
    return value


PersonName = Annotated[
    str,
    StringConstraints(min_length=1, max_length=60, pattern=NOT_BLANK),
    AfterValidator(_person_name),
]
CompanyName = Annotated[str, StringConstraints(min_length=1, max_length=120, pattern=NOT_BLANK)]
JobTitle = Annotated[str, StringConstraints(min_length=1, max_length=100, pattern=NOT_BLANK)]
City = Annotated[str, StringConstraints(min_length=1, max_length=80, pattern=NOT_BLANK)]
Headline = Annotated[str, StringConstraints(min_length=1, max_length=120, pattern=NOT_BLANK)]
About = Annotated[str, StringConstraints(max_length=500, pattern=CLEAN)]
Country = Annotated[
    str,
    StringConstraints(min_length=2, max_length=2, pattern=r"^[A-Z]{2}$"),
    AfterValidator(_country),
]
TimeZone = Annotated[
    str, StringConstraints(min_length=1, max_length=64, pattern=CLEAN), AfterValidator(_time_zone)
]
Skill = Annotated[str, StringConstraints(min_length=1, max_length=30, pattern=NOT_BLANK)]
_PATH = rf"([/?#][^ \t\r\n{BAD}]*)?$"
GithubUrl = Annotated[
    str,
    StringConstraints(max_length=2048, pattern=rf"^https://([A-Za-z0-9-]+\.)?github\.com{_PATH}"),
    AfterValidator(_github),
]
LinkedinUrl = Annotated[
    str,
    StringConstraints(max_length=2048, pattern=rf"^https://([A-Za-z0-9-]+\.)?linkedin\.com{_PATH}"),
    AfterValidator(_linkedin),
]


class ProfileBlock(ApiModel):
    """The professional details of registration step 2."""

    discipline: Discipline
    seniority: Seniority
    employment_status: EmploymentStatus
    company_name: CompanyName | None = Field(
        default=None, description="Required when the status is employed or freelance."
    )
    job_title: JobTitle | None = Field(
        default=None, description="Required when the status is employed or freelance."
    )
    country: Country = Field(description="ISO 3166-1 alpha-2 code, from the list.", examples=["RW"])
    city: City | None = None
    time_zone: TimeZone = Field(examples=["Africa/Kigali"])


class ProfileBlockDraft(ApiModel):
    """The same fields with none required, so the server can name each missing one (step check)."""

    discipline: Discipline | None = None
    seniority: Seniority | None = None
    employment_status: EmploymentStatus | None = None
    company_name: CompanyName | None = None
    job_title: JobTitle | None = None
    country: Country | None = None
    city: City | None = None
    time_zone: TimeZone | None = None


class LinksPatch(PatchModel):
    nullable: ClassVar[frozenset[str]] = frozenset({"github", "linkedin", "website"})

    github: GithubUrl | None = None
    linkedin: LinkedinUrl | None = None
    website: HttpsUrl | None = None


class ProfileUpdate(PatchModel):
    """PATCH /me/profile: send only what changes. A null clears an optional field."""

    nullable: ClassVar[frozenset[str]] = frozenset(
        {"company_name", "job_title", "city", "headline"}
    )

    given_name: PersonName | None = None
    family_name: PersonName | None = None
    discipline: Discipline | None = None
    seniority: Seniority | None = None
    employment_status: EmploymentStatus | None = None
    company_name: CompanyName | None = None
    job_title: JobTitle | None = None
    country: Country | None = None
    city: City | None = None
    time_zone: TimeZone | None = None
    headline: Headline | None = None
    about: About | None = None
    links: LinksPatch | None = None


class SkillsReplace(ApiModel):
    skills: list[Skill] = Field(max_length=10, description="At most 10, unique ignoring case.")

    @field_validator("skills")
    @classmethod
    def _unique(cls, value: list[Skill]) -> list[Skill]:
        seen = [skill.casefold() for skill in value]
        if len(set(seen)) != len(seen):
            raise ValueError("Each skill may appear once, ignoring capital letters.")
        return value


class PreferencesReplace(ApiModel):
    theme: Theme
    time_zone: TimeZone = Field(examples=["Africa/Kigali"])


class PrivacyReplace(ApiModel):
    show_professional_details: StrictBool = Field(
        description="Show discipline, seniority, company, job title and location to other members."
    )


CurrentPassword = Annotated[
    str, StringConstraints(min_length=1, max_length=128, strip_whitespace=False, pattern=CLEAN)
]
NewPassword = Annotated[
    str, StringConstraints(min_length=12, max_length=128, strip_whitespace=False, pattern=CLEAN)
]


class PasswordChange(ApiModel):
    current_password: CurrentPassword
    new_password: NewPassword = Field(
        description="12 to 128 characters; not the email or name, and not the current password."
    )
    refresh_token: str | None = Field(
        default=None,
        min_length=1,
        max_length=512,
        description="The session to keep. Every other session ends; without it, all end.",
    )


class AccountDelete(ApiModel):
    password: CurrentPassword


class ValidationOk(OutModel):
    valid: bool = Field(description="Always true: a failure is a 422 with per-field details.")


class Links(OutModel):
    github: str | None
    linkedin: str | None
    website: str | None


class ProfileOut(OutModel):
    discipline: Discipline
    seniority: Seniority
    employment_status: EmploymentStatus
    company_name: str | None
    job_title: str | None
    country: str = Field(description="ISO 3166-1 alpha-2 code; `ZZ` means not set yet.")
    city: str | None
    time_zone: str
    headline: str | None = Field(description="The headline the person wrote, if any.")
    display_headline: str | None = Field(
        description="The headline to show: the stored one, else composed from the details."
    )
    about: str
    links: Links
    skills: list[str]

    @classmethod
    def of(cls, profile: Profile) -> Self:
        return cls(
            discipline=profile.discipline,
            seniority=profile.seniority,
            employment_status=profile.employment_status,
            company_name=profile.company_name,
            job_title=profile.job_title,
            country=profile.country_code,
            city=profile.city,
            time_zone=profile.time_zone,
            headline=profile.headline,
            display_headline=profile_rules.display_headline(profile),
            about=profile.about,
            links=Links(
                github=profile.github_url,
                linkedin=profile.linkedin_url,
                website=profile.website_url,
            ),
            skills=list(profile.skills),
        )
