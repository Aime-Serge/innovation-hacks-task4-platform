# Release notes: proposed v1.1.0

Proposal only. **No tag has been created and none should be created until the gate is green and the author agrees.** The only existing tag is `task-3-baseline`. The guide gives no calendar dates; the author confirms deadlines with the organisers, so no date is written here. Date: `<set-me>`.

## Summary

Adds registration with a professional profile, profile pages, settings, and a people picker for task assignment on top of the Task 4 platform, and finishes the submission material (compliance matrix, README, demo script, LinkedIn draft, self-review).

## Added (feat/minimal-profile)

- Two-step registration with terms and age confirmation.
- Own profile page, member profile page, profile editor, skills, links.
- Settings: profile, preferences (theme and time zone), privacy, account.
- Change password, sign out of all devices, delete account.
- People picker showing discipline and company.
- Migration `0008_minimal_profile` (additive; ADR-609).
- `MIN_AGE` and `TERMS_VERSION` settings.
- `make guide-check`, `make test-profile`, `make db-check`, `make e2e-profile`, `make screenshots`.
- Documents: `docs/guide-compliance.md`, `docs/how-it-works.md`, ADR-601 to ADR-616, `docs/submission/`.

## Changed

- `POST /users` requires the profile block, consent and age confirmation (S-A). Existing users are backfilled with neutral values and `legacy` terms (ADR-608).
- The avatar menu no longer shows the email (S-C).

## Upgrade order

Migrate (0008), API, frontend, smoke (`docs/deploy-runbook.md`). The previous API keeps working on the new schema.

## Known limitations

No email verification or password reset; a duplicate email is reported at registration; companies are free text; profiles are visible to signed-in members only; one API instance (per-process rate limiter). Baseline failures recorded in `docs/baseline-final.md` (one schemathesis case, Prettier on three e2e files) are logged in `docs/blockers.md`; whether they are fixed is not claimed here.

## Links

| Item | Link |
|---|---|
| Repository | `<pending>` |
| Demo video | `<pending>` |
| Live site (optional) | `<pending>` |
| LinkedIn post | `<pending>` |
