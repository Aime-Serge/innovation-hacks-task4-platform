"""MT-01, MT-02, MT-04, MT-05, MT-07 to MT-09, MT-12 to MT-15: registration, profile and settings."""

import asyncio
from typing import Any
from uuid import UUID

import pytest

from app.domain import lists
from tests.conftest import (
    DEV,
    LEAD,
    OTHER,
    PASSWORD,
    Env,
    error_code,
    make_project,
    make_task,
    signup,
)

USERS = "/api/v1/users"
ME = "/api/v1/me"
NEW_PASSWORD = "a-brand-new-password-9"  # a test fixture


async def join(
    env: Env, name: str = "Nia Okoro", **over: Any
) -> tuple[dict[str, str], dict[str, Any]]:
    """Register through the API and sign in: headers and the created user."""
    body = signup(name=name, email=over.pop("email", "nia@example.com"), **over)
    created = await env.client.post(USERS, json=body)
    assert created.status_code == 201, created.text
    login = await env.login(body["email"], body["password"])
    return {"Authorization": f"Bearer {login.json()['accessToken']}"}, created.json()


def fields(response: Any) -> dict[str, str]:
    return {d["field"]: d["message"] for d in response.json()["error"]["details"]}


# --- MT-01: the two-step registration ------------------------------------------------------------


async def test_mt01_both_steps_validate_create_nothing_and_the_final_submit_signs_in(
    env: Env,
) -> None:
    body = signup(email="wizard@example.com")
    step1 = {k: body[k] for k in ("givenName", "familyName", "email", "password")}
    step2 = {k: body[k] for k in ("profile", "termsAccepted", "ageConfirmed")}
    before = (await env.client.get(USERS, headers=env.auth(LEAD))).json()["total"]
    for step, data in ((1, step1), (2, step2)):
        ok = await env.client.post(f"{USERS}/validate", json={"step": step, **data})
        assert ok.status_code == 200 and ok.json() == {"valid": True}
    assert (await env.client.get(USERS, headers=env.auth(LEAD))).json()["total"] == before
    assert (await env.login("wizard@example.com", body["password"])).status_code == 401
    created = await env.client.post(USERS, json=body)
    assert created.status_code == 201
    assert created.json()["name"] == "Ada Lovelace"
    assert created.json()["profile"]["discipline"] == "backend"
    assert (await env.login("wizard@example.com", body["password"])).status_code == 200


async def test_mt01_a_step_names_every_missing_field_at_once(env: Env) -> None:
    one = await env.client.post(f"{USERS}/validate", json={"step": 1})
    assert one.status_code == 422
    assert set(fields(one)) == {"givenName", "familyName", "email", "password"}
    two = await env.client.post(f"{USERS}/validate", json={"step": 2})
    assert set(fields(two)) == {
        "profile.discipline",
        "profile.seniority",
        "profile.employmentStatus",
        "profile.country",
        "profile.timeZone",
        "termsAccepted",
        "ageConfirmed",
    }


async def test_mt01_validate_is_rate_limited() -> None:
    from tests.conftest import build_env

    async for limited in build_env("empty", rate_limit_attempts=1):
        codes = [
            (await limited.client.post(f"{USERS}/validate", json={"step": 1})).status_code
            for _ in range(8)
        ]
        assert codes[:6] == [422] * 6 and codes[6:] == [429, 429]


# --- MT-02: the field-rule matrix ----------------------------------------------------------------

BAD_VALUES: list[tuple[str, Any, str]] = [
    ("givenName", "", "givenName"),
    ("givenName", "x" * 61, "givenName"),
    ("givenName", "Ada1", "givenName"),
    ("givenName", "<b>Ada</b>", "givenName"),
    ("familyName", " ", "familyName"),
    ("familyName", "O'Brien-", "familyName"),
    ("email", "nope", "email"),
    ("email", "a" * 250 + "@x.io", "email"),
    ("password", "short", "password"),
    ("password", "x" * 129, "password"),
]
BAD_PROFILE: list[tuple[str, Any]] = [
    ("discipline", "wizard"),
    ("seniority", "guru"),
    ("employmentStatus", "retired"),
    ("companyName", "c" * 121),
    ("jobTitle", "t" * 101),
    ("country", "rw"),
    ("country", "ZZ"),
    ("country", "XX"),
    ("city", "c" * 81),
    ("timeZone", "Mars/Olympus"),
    ("timeZone", ""),
]


@pytest.mark.parametrize(("field", "value", "reported"), BAD_VALUES)
async def test_mt02_account_field_rules_reject_bad_values(
    env: Env, field: str, value: Any, reported: str
) -> None:
    response = await env.client.post(USERS, json=signup(**{field: value}))
    assert response.status_code == 422 and reported in fields(response)


@pytest.mark.parametrize(("field", "value"), BAD_PROFILE)
async def test_mt02_profile_field_rules_reject_bad_values(env: Env, field: str, value: Any) -> None:
    body = signup()
    body["profile"][field] = value
    response = await env.client.post(USERS, json=body)
    assert response.status_code == 422 and f"profile.{field}" in fields(response)


@pytest.mark.parametrize("field", ["givenName", "familyName", "email", "password", "profile"])
async def test_mt02_required_fields_may_not_be_missing(env: Env, field: str) -> None:
    body = signup()
    del body[field]
    assert (await env.client.post(USERS, json=body)).status_code == 422


async def test_mt02_every_list_value_is_accepted_and_valid_edge_values_pass(env: Env) -> None:
    for index, value in enumerate(lists.DISCIPLINES):
        body = signup(email=f"d{index}@example.com")
        body["profile"]["discipline"] = value
        assert (await env.client.post(USERS, json=body)).status_code == 201, value
    for index, value in enumerate(lists.SENIORITIES):
        body = signup(email=f"s{index}@example.com")
        body["profile"]["seniority"] = value
        assert (await env.client.post(USERS, json=body)).status_code == 201, value
    for index, value in enumerate(lists.EMPLOYMENT_STATUSES):
        body = signup(email=f"e{index}@example.com")
        body["profile"] |= {"employmentStatus": value, "companyName": None, "jobTitle": None}
        expected = 422 if value in ("employed", "freelance") else 201
        assert (await env.client.post(USERS, json=body)).status_code == expected, value
    edge = signup(name="Jean-Luc O'Neill", email="edge@example.com", password="x" * 128) | {
        "givenName": "Jean-Luc",
        "familyName": "O'Neill",
    }
    edge["profile"]["city"] = "c" * 80
    assert (await env.client.post(USERS, json=edge)).status_code == 201


async def test_mt02_company_and_title_are_required_when_employed_or_freelance(env: Env) -> None:
    for status in ("employed", "freelance"):
        body = signup()
        body["profile"] |= {"employmentStatus": status, "companyName": None, "jobTitle": None}
        response = await env.client.post(USERS, json=body)
        assert response.status_code == 422
        assert {"profile.companyName", "profile.jobTitle"} <= set(fields(response))


async def test_mt02_the_composed_name_may_not_pass_80_characters(env: Env) -> None:
    body = signup() | {"givenName": "A" * 40, "familyName": "B" * 40}
    response = await env.client.post(USERS, json=body)
    assert response.status_code == 422 and "familyName" in fields(response)
    fine = signup(email="long@example.com") | {"givenName": "A" * 40, "familyName": "B" * 39}
    assert (await env.client.post(USERS, json=fine)).status_code == 201


async def test_mt02_the_password_may_not_equal_the_email_or_name(env: Env) -> None:
    same = signup(email="samepassword@example.com", password="samepassword@example.com")
    assert "password" in fields(await env.client.post(USERS, json=same))
    named = signup(password="ada lovelace") | {"givenName": "Ada", "familyName": "Lovelace"}
    named["password"] = "Ada Lovelace"
    assert (await env.client.post(USERS, json=named)).status_code == 422


# --- MT-04, MT-05 --------------------------------------------------------------------------------


async def test_mt04_terms_and_age_are_required_and_stored_with_the_terms_version(
    env: Env,
) -> None:
    for missing in ({"termsAccepted": False}, {"ageConfirmed": False}):
        response = await env.client.post(USERS, json=signup(**missing))
        assert response.status_code == 422 and set(fields(response)) == set(missing)
    strict = await env.client.post(USERS, json=signup(termsAccepted=1))
    assert strict.status_code == 422  # a truthy number is not consent


async def test_mt04_consent_is_stored_and_no_birth_date_is_collected(env: Env) -> None:
    _, created = await join(env)
    async with env.container.uow() as uow:
        stored = await uow.profiles.get(UUID(created["id"]))
    assert stored is not None
    assert stored.terms_version == env.container.settings.terms_version
    assert stored.age_confirmed_at == stored.terms_accepted_at == env.clock.now()
    assert not any("birth" in name for name in stored.__slots__)
    assert "birth" not in str(created).lower()
    rejected = await env.client.post(
        USERS, json=signup(email="dob@example.com", birthDate="1990-01-01")
    )
    assert rejected.status_code == 422  # unknown fields are refused, so no birth date can arrive


async def test_mt05_a_duplicate_email_is_409_email_already_exists(env: Env) -> None:
    await join(env)
    again = await env.client.post(USERS, json=signup(email="NIA@Example.com"))
    assert again.status_code == 409
    assert error_code(again) == "EMAIL_ALREADY_EXISTS"
    taken = await env.client.post(USERS, json=signup(email=DEV))
    assert taken.status_code == 409


# --- MT-07 and MT-14: privacy --------------------------------------------------------------------


def _hidden_shape(user: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in user.items() if k not in ("id", "name", "givenName", "familyName")}


async def test_mt07_a_member_page_follows_the_switch_and_never_shows_email_or_stats(
    env: Env,
) -> None:
    headers, created = await join(env)
    uid = created["id"]
    shown = (await env.client.get(f"{USERS}/{uid}", headers=env.auth(OTHER))).json()
    assert shown["profile"]["discipline"] == "backend"
    assert shown["email"] is None  # BR-403: not to another developer
    assert "stats" not in shown and "completeness" not in shown and "privacy" not in shown
    lead_view = (await env.client.get(f"{USERS}/{uid}", headers=env.auth(LEAD))).json()
    assert lead_view["email"] == "nia@example.com"  # a lead still sees the email
    assert "stats" not in lead_view and "completeness" not in lead_view

    off = await env.client.put(
        f"{ME}/privacy", json={"showProfessionalDetails": False}, headers=headers
    )
    assert off.status_code == 200
    hidden = (await env.client.get(f"{USERS}/{uid}", headers=env.auth(OTHER))).json()
    assert hidden["profile"] is None
    text = str(hidden)
    for secret in ("Acme", "Engineer", "Kigali", "backend", "RW", "mid"):
        assert secret not in text, secret
    assert hidden["name"] == "Nia Okoro"  # the name stays; the count of people is unchanged
    own = (await env.client.get(ME, headers=headers)).json()
    assert own["profile"]["discipline"] == "backend"  # the owner's view never changes
    assert own["privacy"] == {"showProfessionalDetails": False}


async def test_mt07_hidden_data_answers_exactly_like_missing_data(env: Env) -> None:
    headers, created = await join(env)
    await env.client.put(f"{ME}/privacy", json={"showProfessionalDetails": False}, headers=headers)
    async with env.container.uow() as uow:  # a legacy person: no profile row at all
        legacy = await uow.users.get_by_email(DEV)
    assert legacy is not None
    async with env.container.uow() as uow:
        await uow.profiles.delete(legacy.id)
        await uow.commit()
    hidden = (await env.client.get(f"{USERS}/{created['id']}", headers=env.auth(OTHER))).json()
    missing = (await env.client.get(f"{USERS}/{legacy.id}", headers=env.auth(OTHER))).json()
    assert hidden["profile"] is None and missing["profile"] is None
    assert set(_hidden_shape(hidden)) == set(_hidden_shape(missing))


async def test_mt14_the_switch_applies_at_once_to_get_user_and_the_picker_list(env: Env) -> None:
    headers, created = await join(env)
    uid = created["id"]

    async def listed() -> dict[str, Any]:
        page = (await env.client.get(f"{USERS}?q=Nia&pageSize=100", headers=env.auth(OTHER))).json()
        return next(u for u in page["items"] if u["id"] == uid) | {"total": page["total"]}

    before_total = (await listed())["total"]
    assert (await listed())["profile"]["companyName"] == "Acme"
    await env.client.put(f"{ME}/privacy", json={"showProfessionalDetails": False}, headers=headers)
    after = await listed()
    assert after["profile"] is None and after["total"] == before_total
    assert "Acme" not in str(after) and after["email"] is None
    assert (await env.client.get(f"{USERS}/{uid}", headers=env.auth(OTHER))).json()[
        "profile"
    ] is None
    await env.client.put(f"{ME}/privacy", json={"showProfessionalDetails": True}, headers=headers)
    assert (await listed())["profile"]["companyName"] == "Acme"  # and back on, at once


async def test_mt14_a_developer_never_sees_another_email_in_the_list(env: Env) -> None:
    await join(env)
    page = (await env.client.get(f"{USERS}?pageSize=100", headers=env.auth(DEV))).json()
    others = [u for u in page["items"] if u["email"] is not None]
    assert [u["email"] for u in others] == [DEV]  # only their own
    assert (await env.client.get(f"{USERS}?q=nia@example.com", headers=env.auth(DEV))).json()[
        "total"
    ] == 0  # and no search by email either


# --- MT-08 and MT-09: editing ---------------------------------------------------------------------


async def test_mt08_editing_rebuilds_the_name_and_reports_per_field_messages(env: Env) -> None:
    headers, _ = await join(env)
    ok = await env.client.patch(
        f"{ME}/profile",
        json={"givenName": "Chidi", "familyName": "Anagonye", "headline": "Ethics", "about": "Hi"},
        headers=headers,
    )
    assert ok.status_code == 200
    assert ok.json()["name"] == "Chidi Anagonye"
    assert ok.json()["profile"]["headline"] == "Ethics"
    bad = await env.client.patch(
        f"{ME}/profile",
        json={
            "about": "a" * 501,
            "headline": "h" * 121,
            "country": "QQ",
            "city": "",
            "givenName": "1",
        },
        headers=headers,
    )
    assert bad.status_code == 422
    assert {"about", "headline", "country", "city", "givenName"} <= set(fields(bad))
    assert (await env.client.patch(f"{ME}/profile", json={}, headers=headers)).status_code == 422
    assert (
        await env.client.patch(f"{ME}/profile", json={"headline": None}, headers=headers)
    ).json()["profile"]["headline"] is None  # null clears an optional field
    nulled = await env.client.patch(f"{ME}/profile", json={"about": None}, headers=headers)
    assert nulled.status_code == 422  # about is not nullable


async def test_mt08_employment_details_stay_required_for_working_people(env: Env) -> None:
    headers, _ = await join(env)
    response = await env.client.patch(f"{ME}/profile", json={"companyName": None}, headers=headers)
    assert response.status_code == 422 and "companyName" in fields(response)
    student = await env.client.patch(
        f"{ME}/profile",
        json={"employmentStatus": "student", "companyName": None, "jobTitle": None},
        headers=headers,
    )
    assert student.status_code == 200
    assert student.json()["profile"]["companyName"] is None


async def test_mt08_links_are_https_and_host_checked(env: Env) -> None:
    headers, _ = await join(env)
    good = {
        "github": "https://github.com/ada",
        "linkedin": "https://www.linkedin.com/in/ada",
        "website": "https://ada.dev/about?x=1",
    }
    ok = await env.client.patch(f"{ME}/profile", json={"links": good}, headers=headers)
    assert ok.status_code == 200 and ok.json()["profile"]["links"] == good
    for links in (
        {"github": "http://github.com/ada"},
        {"github": "https://evil.example/github.com"},
        {"github": "https://github.com@evil.example/"},
        {"github": "https://github.com:8443/ada"},
        {"linkedin": "https://notlinkedin.com/in/ada"},
        {"linkedin": "https://github.com/ada"},
        {"website": "http://ada.dev"},
        {"website": "javascript:alert(1)"},
        {"website": "ftp://ada.dev"},
    ):
        response = await env.client.patch(f"{ME}/profile", json={"links": links}, headers=headers)
        assert response.status_code == 422, links
        assert f"links.{next(iter(links))}" in fields(response), links
    cleared = await env.client.patch(
        f"{ME}/profile", json={"links": {"github": None}}, headers=headers
    )
    assert cleared.json()["profile"]["links"]["github"] is None
    assert cleared.json()["profile"]["links"]["website"] == good["website"]  # the rest is kept


async def test_mt08_skills_are_limited_to_ten_and_unique_ignoring_case(env: Env) -> None:
    headers, _ = await join(env)
    ok = await env.client.put(
        f"{ME}/skills", json={"skills": ["Python", "Go", " Rust "]}, headers=headers
    )
    assert ok.status_code == 200 and ok.json()["profile"]["skills"] == ["Python", "Go", "Rust"]
    assert ok.json()["completeness"]["percent"] > 0
    for skills in (
        [f"s{i}" for i in range(11)],
        ["Python", "python"],
        ["x" * 31],
        [""],
        ["a", "b", "A"],
    ):
        response = await env.client.put(f"{ME}/skills", json={"skills": skills}, headers=headers)
        assert response.status_code == 422, skills
        assert "skills" in "".join(fields(response))
    ten = await env.client.put(
        f"{ME}/skills", json={"skills": [f"s{i}" for i in range(10)]}, headers=headers
    )
    assert ten.status_code == 200
    kept = (await env.client.get(ME, headers=headers)).json()["profile"]["skills"]
    assert len(kept) == 10  # a refused list changes nothing


async def test_mt08_concurrent_skill_replacements_never_pass_the_limit(env: Env) -> None:
    headers, _ = await join(env)
    lists_ = [[f"w{worker}-{i}" for i in range(10)] for worker in range(8)]
    responses = await asyncio.gather(
        *(env.client.put(f"{ME}/skills", json={"skills": s}, headers=headers) for s in lists_)
    )
    assert all(r.status_code == 200 for r in responses)
    final = (await env.client.get(ME, headers=headers)).json()["profile"]["skills"]
    assert len(final) == 10 and final in lists_  # exactly one whole list won, none were mixed


async def test_mt09_markup_and_script_payloads_are_stored_and_returned_as_plain_text(
    env: Env,
) -> None:
    headers, _ = await join(env)
    payload = "<script>alert(1)</script><img src=x onerror=alert(2)>"
    ok = await env.client.patch(
        f"{ME}/profile",
        json={
            "headline": payload,
            "about": payload,
            "city": payload,
            "companyName": payload,
            "jobTitle": payload,
        },
        headers=headers,
    )
    assert ok.status_code == 200
    profile = ok.json()["profile"]
    for name in ("headline", "about", "city", "companyName", "jobTitle"):
        assert profile[name] == payload, name  # unchanged: escaping is the client's job (MB-04)
    skills = await env.client.put(f"{ME}/skills", json={"skills": [payload[:29]]}, headers=headers)
    assert skills.status_code == 200 and skills.json()["profile"]["skills"] == [payload[:29]]
    assert ok.headers["content-type"].startswith("application/json")  # never served as HTML
    assert ok.headers.get("x-content-type-options", "nosniff") == "nosniff"
    for name in ("givenName", "familyName"):
        response = await env.client.patch(f"{ME}/profile", json={name: "<b>x</b>"}, headers=headers)
        assert response.status_code == 422  # names take letters only, so markup cannot get in


async def test_mt09_completeness_follows_the_table_and_is_owner_only(env: Env) -> None:
    headers, created = await join(env)
    me = (await env.client.get(ME, headers=headers)).json()
    assert me["completeness"] == {"percent": 50, "next": "Write a short headline"}
    steps = [
        ({"headline": "Builds APIs"}, 60),
        ({"about": "About me"}, 75),
        ({"links": {"website": "https://ada.dev"}}, 85),
    ]
    for patch, percent in steps:
        response = await env.client.patch(f"{ME}/profile", json=patch, headers=headers)
        assert response.json()["completeness"]["percent"] == percent, patch
    full = await env.client.put(f"{ME}/skills", json={"skills": ["a", "b", "c"]}, headers=headers)
    assert full.json()["completeness"] == {"percent": 100, "next": None}
    assert (await env.client.get(f"{USERS}/{created['id']}", headers=env.auth(OTHER))).json().get(
        "completeness"
    ) is None
    stats = (await env.client.get(ME, headers=headers)).json()["stats"]
    assert stats == {"projectsOwned": 0, "tasksDone": 0, "tasksOpen": 0}


async def test_mt09_statistics_count_the_persons_own_projects_and_tasks(env: Env) -> None:
    headers, created = await join(env)
    project = await make_project(env, DEV)
    await make_task(env, project["id"], DEV, assigneeId=created["id"])
    mine = await env.client.post("/api/v1/projects", json={"name": "Mine"}, headers=headers)
    assert mine.status_code == 201
    stats = (await env.client.get(ME, headers=headers)).json()["stats"]
    assert stats == {"projectsOwned": 1, "tasksDone": 0, "tasksOpen": 1}


# --- MT-12, MT-13: password and sessions ---------------------------------------------------------


async def _session(env: Env, email: str, password: str) -> str:
    return str((await env.login(email, password)).json()["refreshToken"])


async def _refreshes(env: Env, token: str) -> int:
    return (await env.client.post("/api/v1/auth/refresh", json={"refreshToken": token})).status_code


async def test_mt12_wrong_current_password_is_403_and_changes_nothing(env: Env) -> None:
    headers, _ = await join(env)
    response = await env.client.post(
        f"{ME}/password",
        json={"currentPassword": "not-the-password-1", "newPassword": NEW_PASSWORD},
        headers=headers,
    )
    assert response.status_code == 403  # not 401: the client keeps its session
    assert error_code(response) == "INVALID_CREDENTIALS"
    assert (await env.login("nia@example.com", "correct-horse-battery")).status_code == 200


async def test_mt12_the_new_password_follows_the_rules(env: Env) -> None:
    headers, _ = await join(env)
    current = "correct-horse-battery"
    for new, field in (
        ("short", "newPassword"),
        (current, "newPassword"),
        ("nia@example.com", "newPassword"),
        ("Nia Okoro", "newPassword"),
    ):
        response = await env.client.post(
            f"{ME}/password", json={"currentPassword": current, "newPassword": new}, headers=headers
        )
        assert response.status_code == 422, new
        assert field in fields(response)
    assert (
        await env.client.post(f"{ME}/password", json={"currentPassword": current}, headers=headers)
    ).status_code == 422
    assert (await env.login("nia@example.com", current)).status_code == 200  # nothing changed


async def test_mt12_changing_the_password_ends_every_other_session_but_the_one_kept(
    env: Env,
) -> None:
    headers, _ = await join(env)
    current = "correct-horse-battery"
    kept = await _session(env, "nia@example.com", current)
    other_device = await _session(env, "nia@example.com", current)
    third_device = await _session(env, "nia@example.com", current)
    bystander = await _session(env, DEV, PASSWORD)
    changed = await env.client.post(
        f"{ME}/password",
        json={"currentPassword": current, "newPassword": NEW_PASSWORD, "refreshToken": kept},
        headers=headers,
    )
    assert changed.status_code == 204
    assert await _refreshes(env, other_device) == 401
    assert await _refreshes(env, third_device) == 401
    assert await _refreshes(env, bystander) == 200  # another person's session is untouched
    assert await _refreshes(env, kept) == 200  # the caller's own survives (GAP-02)
    assert (await env.login("nia@example.com", current)).status_code == 401
    assert (await env.login("nia@example.com", NEW_PASSWORD)).status_code == 200


async def test_mt12_without_a_refresh_token_every_session_ends(env: Env) -> None:
    headers, _ = await join(env)
    current = "correct-horse-battery"
    first = await _session(env, "nia@example.com", current)
    strange = await env.client.post(
        f"{ME}/password",
        json={"currentPassword": current, "newPassword": NEW_PASSWORD, "refreshToken": "x" * 48},
        headers=headers,
    )
    assert strange.status_code == 204  # an unknown token keeps nothing
    assert await _refreshes(env, first) == 401
    second = await _session(env, "nia@example.com", NEW_PASSWORD)
    someone_elses = await _session(env, DEV, PASSWORD)
    again = await env.client.post(
        f"{ME}/password",
        json={
            "currentPassword": NEW_PASSWORD,
            "newPassword": current,
            "refreshToken": someone_elses,
        },
        headers=headers,
    )
    assert again.status_code == 204
    assert await _refreshes(env, second) == 401
    assert await _refreshes(env, someone_elses) == 200  # a token of another person is never revoked


async def test_mt12_password_change_is_rate_limited() -> None:
    from tests.conftest import build_env

    async for limited in build_env("empty", rate_limit_attempts=2):
        headers, _ = await join(limited)
        codes = [
            (
                await limited.client.post(
                    f"{ME}/password",
                    json={"currentPassword": "wrong-password-123", "newPassword": NEW_PASSWORD},
                    headers=headers,
                )
            ).status_code
            for _ in range(4)
        ]
        assert codes == [403, 403, 429, 429]


async def test_mt13_signing_out_of_all_devices_ends_every_session(env: Env) -> None:
    headers, _ = await join(env)
    tokens = [await _session(env, "nia@example.com", "correct-horse-battery") for _ in range(3)]
    other = await _session(env, DEV, PASSWORD)
    assert (await env.client.delete(f"{ME}/sessions", headers=headers)).status_code == 204
    assert [await _refreshes(env, t) for t in tokens] == [401, 401, 401]
    assert await _refreshes(env, other) == 200
    assert (await env.client.delete(f"{ME}/sessions")).status_code == 401


# --- MT-15: deleting the account ------------------------------------------------------------------


async def test_mt15_deleting_needs_the_password_and_removes_the_person(env: Env) -> None:
    headers, created = await join(env)
    current = "correct-horse-battery"
    project = await make_project(env, DEV)
    task = await make_task(env, project["id"], DEV, assigneeId=created["id"])
    session = await _session(env, "nia@example.com", current)
    wrong = await env.client.post(
        f"{ME}/delete", json={"password": "wrong-password-123"}, headers=headers
    )
    assert wrong.status_code == 403 and error_code(wrong) == "INVALID_CREDENTIALS"
    assert (await env.client.post(f"{ME}/delete", json={}, headers=headers)).status_code == 422
    assert (await env.client.get(ME, headers=headers)).status_code == 200  # still there
    gone = await env.client.post(f"{ME}/delete", json={"password": current}, headers=headers)
    assert gone.status_code == 204
    assert (await env.client.get(ME, headers=headers)).status_code == 401  # signed out
    assert (await env.login("nia@example.com", current)).status_code == 401
    assert await _refreshes(env, session) == 401
    assert (
        await env.client.get(f"{USERS}/{created['id']}", headers=env.auth(LEAD))
    ).status_code == 404
    reread = await env.client.get(f"/api/v1/tasks/{task['id']}", headers=env.auth(DEV))
    assert reread.json()["assigneeId"] is None  # the task became unassigned (Task 3)
    async with env.container.uow() as uow:
        assert await uow.profiles.get(UUID(created["id"])) is None


async def test_mt15_an_owner_of_projects_is_blocked_with_user_owns_projects(env: Env) -> None:
    headers, created = await join(env)
    assert (
        await env.client.post("/api/v1/projects", json={"name": "Mine"}, headers=headers)
    ).status_code == 201
    blocked = await env.client.post(
        f"{ME}/delete", json={"password": "correct-horse-battery"}, headers=headers
    )
    assert blocked.status_code == 409 and error_code(blocked) == "USER_OWNS_PROJECTS"
    assert (await env.client.get(ME, headers=headers)).status_code == 200  # nothing was removed
    assert (
        await env.client.get(f"{USERS}/{created['id']}", headers=env.auth(LEAD))
    ).status_code == 200


async def test_mt15_the_last_lead_cannot_delete_their_account(env: Env) -> None:
    blocked = await env.client.post(
        f"{ME}/delete", json={"password": PASSWORD}, headers=env.auth(LEAD)
    )
    assert blocked.status_code == 409 and error_code(blocked) == "LAST_LEAD"


# --- MT-15 (preferences) and the existing sign-in surface ----------------------------------------


async def test_mt15_preferences_are_saved_per_account_and_returned_on_the_next_sign_in(
    env: Env,
) -> None:
    headers, _ = await join(env)
    saved = await env.client.put(
        f"{ME}/preferences", json={"theme": "dark", "timeZone": "Europe/Paris"}, headers=headers
    )
    assert saved.status_code == 200
    assert saved.json()["preferences"] == {"theme": "dark"}
    assert saved.json()["profile"]["timeZone"] == "Europe/Paris"
    fresh = await env.login("nia@example.com", "correct-horse-battery")  # another device
    again = await env.client.get(
        ME, headers={"Authorization": f"Bearer {fresh.json()['accessToken']}"}
    )
    assert again.json()["preferences"] == {"theme": "dark"}
    assert again.json()["profile"]["timeZone"] == "Europe/Paris"
    for body in (
        {"theme": "blue", "timeZone": "Europe/Paris"},
        {"theme": "dark", "timeZone": "Nope/Zone"},
        {"theme": "dark"},
    ):
        assert (
            await env.client.put(f"{ME}/preferences", json=body, headers=headers)
        ).status_code == 422
    # the older endpoint writes the same column (GAP-05)
    await env.client.patch(
        f"{USERS}/{again.json()['id']}", json={"preferences": {"theme": "light"}}, headers=headers
    )
    assert (await env.client.get(ME, headers=headers)).json()["preferences"] == {"theme": "light"}


async def test_mt15_me_and_auth_me_agree_and_a_legacy_account_is_flagged(env: Env) -> None:
    headers, _ = await join(env)
    me = (await env.client.get(ME, headers=headers)).json()
    auth_me = (await env.client.get("/api/v1/auth/me", headers=headers)).json()
    assert {k: me[k] for k in auth_me} == auth_me  # /auth/me is unchanged in meaning
    assert me["legacyProfile"] is False
    async with env.container.uow() as uow:
        legacy = await uow.users.get_by_email(DEV)
        assert legacy is not None
        profile = await uow.profiles.get(legacy.id)
        assert profile is not None
        from dataclasses import replace

        await uow.profiles.update(replace(profile, terms_version="legacy", country_code="ZZ"))
        await uow.commit()
    dev = (await env.client.get(ME, headers=env.auth(DEV))).json()
    assert dev["legacyProfile"] is True
    assert dev["completeness"]["percent"] < 100
