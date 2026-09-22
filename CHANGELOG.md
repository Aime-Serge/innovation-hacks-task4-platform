# Changelog

Format: one section per proposed release. No tag has been created; dates are added when a release is cut.

## [Unreleased] - proposed v1.1.0 (branch feat/minimal-profile)

### Added
- Two-step registration that captures professional information, with terms and age confirmation (MF-01 to MF-05). In progress.
- Own profile page, member profile page, profile editor and settings (MF-06 to MF-12). In progress.
- People picker for task assignment that shows each member's discipline and company (MF-11). In progress.
- Change password, sign out of all devices, and account deletion (MF-13, MF-14, MF-17). In progress.
- Migration `0008_minimal_profile` (ADR-609). In progress.
- `docs/guide-compliance.md` with the 49 guide requirements and `make guide-check` (MF-22).
- Make targets `test-profile`, `db-check`, `e2e-profile`, `guide-check` and `screenshots`, added to `make gate`.
- `MIN_AGE` and `TERMS_VERSION` settings, documented in `.env.example`, the README and the deploy runbook.
- ADR-601 to ADR-616, `docs/how-it-works.md`, and `docs/submission/` (demo script, LinkedIn draft, release notes, self-review).
- README sections for features, technology stack, screenshots, demo links and task submissions.
- `scripts/smoke.sh` steps for the profile flows (they need the new endpoints).

### Changed
- `POST /users` requires the profile block, consent and age confirmation (supersession S-A).
- The avatar menu no longer shows the email (S-C).
- The release order in the deploy runbook is migrate (0008), API, frontend, smoke.

### Known limitations
- No email verification and no password reset; a duplicate email is reported at registration; companies are free text; one API instance because the rate limiter is per process.
