# ADR-617: Profile API details: hidden profile, legacy scoring, list parity and a route guard

**Status:** Accepted (backend implementation of the minimal profile pack).

**Decisions.**

1. **A hidden profile is a null profile.** When a member turns the privacy switch off, `profile` is `null` for every other viewer, so the discipline, seniority, company, job title, location, headline, about text, skills and links are all absent, and the response has the same shape as for a person who has no profile row (MT-07 checks that the two answers match). The name and the avatar stay. Leads are not exempt (MB-02); they still see the email (BR-403).
2. **Lists have one source and one guard.** `backend/config/profile_lists.json` holds the values and labels. The migration and the SQLAlchemy models build their `CHECK` constraints from it; the three enums in `app/domain/enums.py` stay static (so type checking and the OpenAPI enumerations work) and refuse to import when they disagree with the file.
3. **Legacy scoring.** For a profile with `terms_version = legacy`, the discipline, employment and country points are earned only when a value differs from the neutral backfill (`other` and `mid`, `between_roles`, `ZZ`). A registered person always earns them. `GET /me` returns `legacyProfile` so the client can show the completion prompt.
4. **Wrong-method guard.** `/users/{userId}` would answer `422` to `PATCH /users/validate`; an unlisted route on `/users/validate` for the other methods returns `405` with `Allow: POST` instead.
5. **Strict booleans and semantic rules.** Consent, age and the privacy switch are strict booleans (a number is not consent). The ISO country list, IANA time zones and letters-only names are checked in code and stated in the descriptions; JSON Schema cannot express them, so the contract test adjusts its generated positive cases for those fields (logged in the supersession log).
6. **Names.** `PATCH /users/{userId}` still edits `name` only; `given_name` and `family_name` change through `PATCH /me/profile`, which rebuilds `name`.

**Where it lives.** `app/domain/profile_rules.py`, `app/domain/enums.py`, `app/services/profiles.py`, `app/api/v1/users.py`, `app/api/v1/me.py`.
