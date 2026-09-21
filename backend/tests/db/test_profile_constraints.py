"""MT-03: raw SQL cannot store a bad profile, whoever writes it (MF-02, MN-06).

Every statement runs as the application role, so this proves the database itself refuses each rule
of pack section 5. Each named constraint has at least one case, and the catalogue test in
`test_integrity.py` fails when a constraint exists without one.
"""

import asyncio
from typing import Any
from uuid import UUID

import pytest

from app.domain import lists
from tests.db.conftest import Db

CHECK, UNIQUE, FK, NOT_NULL = "23514", "23505", "23503", "23502"

PROFILE = (
    "INSERT INTO profiles (user_id, discipline, seniority, employment_status, company_name, "
    "job_title, country_code, city, time_zone, headline, about, github_url, linkedin_url, "
    "website_url, terms_version, terms_accepted_at, age_confirmed_at) VALUES "
    "(:user, :discipline, :seniority, :status, :company, :title, :country, :city, :zone, "
    ":headline, :about, :github, :linkedin, :website, :terms, now(), "
    "CASE WHEN CAST(:aged AS boolean) THEN now() END)"
)
GOOD: dict[str, Any] = {
    "discipline": "backend",
    "seniority": "senior",
    "status": "employed",
    "company": "Acme",
    "title": "Engineer",
    "country": "RW",
    "city": "Kigali",
    "zone": "Africa/Kigali",
    "headline": "Builds APIs",
    "about": "",
    "github": "https://github.com/ada",
    "linkedin": "https://www.linkedin.com/in/ada",
    "website": "https://ada.dev",
    "terms": "2026-09",
    "aged": True,
}

CASES: list[tuple[str, dict[str, Any], str]] = [
    ("discipline unknown", {"discipline": "wizard"}, "ck_profiles_discipline"),
    ("discipline empty", {"discipline": ""}, "ck_profiles_discipline"),
    ("seniority unknown", {"seniority": "guru"}, "ck_profiles_seniority"),
    ("status unknown", {"status": "retired"}, "ck_profiles_employment_status"),
    ("company empty", {"company": ""}, "ck_profiles_company_name_length"),
    ("company 121 chars", {"company": "c" * 121}, "ck_profiles_company_name_length"),
    ("company untrimmed", {"company": " Acme"}, "ck_profiles_company_name_length"),
    ("title empty", {"title": ""}, "ck_profiles_job_title_length"),
    ("title 101 chars", {"title": "t" * 101}, "ck_profiles_job_title_length"),
    ("employed without company", {"company": None}, "ck_profiles_employment_details"),
    ("employed without title", {"title": None}, "ck_profiles_employment_details"),
    (
        "freelance without company",
        {"status": "freelance", "company": None},
        "ck_profiles_employment_details",
    ),
    ("country lowercase", {"country": "rw"}, "ck_profiles_country_code"),
    ("country three letters", {"country": "RWA"}, "ck_profiles_country_code"),
    ("country digits", {"country": "R1"}, "ck_profiles_country_code"),
    ("city empty", {"city": ""}, "ck_profiles_city_length"),
    ("city 81 chars", {"city": "c" * 81}, "ck_profiles_city_length"),
    ("time zone empty", {"zone": ""}, "ck_profiles_time_zone_length"),
    ("time zone 65 chars", {"zone": "z" * 65}, "ck_profiles_time_zone_length"),
    ("headline 121 chars", {"headline": "h" * 121}, "ck_profiles_headline_length"),
    ("about 501 chars", {"about": "a" * 501}, "ck_profiles_about_length"),
    ("github over http", {"github": "http://github.com/ada"}, "ck_profiles_github_url_https"),
    ("github other host", {"github": "https://evil.example/ada"}, "ck_profiles_github_url_https"),
    (
        "github host as userinfo",
        {"github": "https://github.com@evil.example/"},
        "ck_profiles_github_url_https",
    ),
    (
        "github too long",
        {"github": "https://github.com/" + "a" * 2050},
        "ck_profiles_github_url_https",
    ),
    (
        "linkedin over http",
        {"linkedin": "http://www.linkedin.com/in/ada"},
        "ck_profiles_linkedin_url_https",
    ),
    (
        "linkedin lookalike host",
        {"linkedin": "https://notlinkedin.com/in/ada"},
        "ck_profiles_linkedin_url_https",
    ),
    ("website over http", {"website": "http://ada.dev"}, "ck_profiles_website_url_https"),
    ("website javascript", {"website": "javascript:alert(1)"}, "ck_profiles_website_url_https"),
    (
        "website too long",
        {"website": "https://ada.dev/" + "a" * 2050},
        "ck_profiles_website_url_https",
    ),
    ("no age confirmation", {"aged": False}, "ck_profiles_age_confirmed"),
]

SKILL = (
    "INSERT INTO profile_skills (id, user_id, name, sort_order) "
    "VALUES (gen_random_uuid(), :user, :name, :pos)"
)


async def _profile(db: Db, **change: Any) -> UUID:
    user = await db.user()
    await db.run(PROFILE, **(GOOD | {"user": user} | change))
    return user


@pytest.mark.sql
@pytest.mark.parametrize(("label", "change", "name"), CASES, ids=[c[0] for c in CASES])
async def test_mt03_profile_constraints_reject_direct_sql(
    app_db: Db, label: str, change: dict[str, Any], name: str
) -> None:
    user = await app_db.user()
    state, got = await app_db.rejected(PROFILE, **(GOOD | {"user": user} | change))
    assert (state, got) == (CHECK, name)


@pytest.mark.sql
async def test_mt03_a_valid_profile_and_every_list_value_are_accepted(app_db: Db) -> None:
    await _profile(app_db)
    for value in lists.DISCIPLINES:
        await _profile(app_db, discipline=value)
    for value in lists.SENIORITIES:
        await _profile(app_db, seniority=value)
    for value in lists.EMPLOYMENT_STATUSES:
        await _profile(app_db, status=value)
    # A student needs neither company nor title, and legacy terms need no age confirmation.
    await _profile(app_db, status="student", company=None, title=None)
    await _profile(app_db, terms="legacy", aged=False)
    await _profile(app_db, github=None, linkedin=None, website=None, city=None, headline=None)


@pytest.mark.sql
async def test_mt03_names_on_users_are_limited_to_60_characters(app_db: Db) -> None:
    for column, name in (
        ("given_name", "ck_users_given_name_length"),
        ("family_name", "ck_users_family_name_length"),
    ):
        user = await app_db.user()
        for bad in ("", "x" * 61, " Ada"):
            state, got = await app_db.rejected(
                f"UPDATE users SET {column} = :v WHERE id = :id", v=bad, id=user
            )
            assert (state, got) == (CHECK, name), (column, bad)
        await app_db.run(f"UPDATE users SET {column} = :v WHERE id = :id", v="x" * 60, id=user)
        await app_db.run(f"UPDATE users SET {column} = NULL WHERE id = :id", id=user)


@pytest.mark.sql
async def test_mt03_profile_is_one_per_user_and_needs_its_user(app_db: Db) -> None:
    user = await _profile(app_db)
    state, name = await app_db.rejected(PROFILE, **(GOOD | {"user": user}))
    assert (state, name) == (UNIQUE, "pk_profiles")
    ghost = "11111111-1111-1111-1111-111111111111"
    state, name = await app_db.rejected(PROFILE, **(GOOD | {"user": UUID(ghost)}))
    assert (state, name) == (FK, "fk_profiles_user_id_users")


@pytest.mark.sql
async def test_mt03_required_profile_columns_are_not_null(app_db: Db) -> None:
    for column in ("discipline", "seniority", "status", "country", "zone", "terms", "about"):
        user = await app_db.user()
        state, _ = await app_db.rejected(PROFILE, **(GOOD | {"user": user, column: None}))
        assert state == NOT_NULL, column


@pytest.mark.sql
async def test_mt03_skill_name_length_uniqueness_and_owner(app_db: Db) -> None:
    user = await _profile(app_db)
    await app_db.run(SKILL, user=user, name="Python", pos=0)
    for label, bad in (("empty", ""), ("31 chars", "s" * 31), ("untrimmed", " Go")):
        state, name = await app_db.rejected(SKILL, user=user, name=bad, pos=1)
        assert (state, name) == (CHECK, "ck_profile_skills_name_length"), label
    state, name = await app_db.rejected(SKILL, user=user, name="PYTHON", pos=1)
    assert (state, name) == (UNIQUE, "uq_profile_skills_user_id_name_lower")
    other = await _profile(app_db)
    await app_db.run(SKILL, user=other, name="python", pos=0)  # another person may have it
    ghost = UUID("11111111-1111-1111-1111-111111111111")
    state, name = await app_db.rejected(SKILL, user=ghost, name="Rust", pos=0)
    assert (state, name) == (FK, "fk_profile_skills_user_id_users")


@pytest.mark.sql
async def test_mt03_the_eleventh_skill_is_refused_by_the_trigger(app_db: Db) -> None:
    user = await _profile(app_db)
    for index in range(10):
        await app_db.run(SKILL, user=user, name=f"skill{index}", pos=index)
    state, name = await app_db.rejected(SKILL, user=user, name="one-too-many", pos=10)
    assert (state, name) == (CHECK, "ck_profile_skills_max_per_user")
    rows = await app_db.run("SELECT count(*) AS n FROM profile_skills WHERE user_id = :u", u=user)
    assert rows[0].n == 10


@pytest.mark.sql
async def test_mt03_concurrent_inserts_cannot_pass_the_skill_limit(app_db: Db) -> None:
    user = await _profile(app_db)
    for index in range(8):
        await app_db.run(SKILL, user=user, name=f"skill{index}", pos=index)
    results = await asyncio.gather(
        *(app_db.run(SKILL, user=user, name=f"racer{i}", pos=8 + i) for i in range(6)),
        return_exceptions=True,
    )
    assert sum(1 for r in results if not isinstance(r, BaseException)) == 2
    rows = await app_db.run("SELECT count(*) AS n FROM profile_skills WHERE user_id = :u", u=user)
    assert rows[0].n == 10


@pytest.mark.sql
async def test_mt03_deleting_a_user_removes_the_profile_and_skills(app_db: Db) -> None:
    user = await _profile(app_db)
    await app_db.run(SKILL, user=user, name="Python", pos=0)
    await app_db.run("DELETE FROM users WHERE id = :id", id=user)
    assert await app_db.run("SELECT count(*) AS n FROM profiles") == [(0,)]
    assert await app_db.run("SELECT count(*) AS n FROM profile_skills") == [(0,)]


@pytest.mark.sql
async def test_mt04_no_birth_date_or_excluded_category_exists_in_the_schema(admin_db: Db) -> None:
    """MB-07: nothing collects gender, birth date, ethnicity, religion, IDs, health or location."""
    rows = await admin_db.run(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'"
    )
    banned = ("birth", "dob", "gender", "ethnic", "religio", "national_id", "health", "latitude")
    found = [r.column_name for r in rows if any(word in r.column_name for word in banned)]
    assert found == []
