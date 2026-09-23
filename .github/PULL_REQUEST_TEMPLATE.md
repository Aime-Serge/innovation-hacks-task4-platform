## Summary

<!-- What does this change do, and why? -->

## Requirement ID(s)

<!--
Cite the real FR/NFR ID(s) this change serves, from
docs/standards/task4-standards-pack.md (e.g. FR-401 to FR-444) or, for the
minimal profile extension, docs/standards/minimal-profile-pack.md
(e.g. FR-501 to FR-563, or an MF-xx item referenced in CHANGELOG.md).
If this change is not tied to a requirement (tooling, chore, docs), say so.
-->

- Requirement(s): <set-me>

## Area

- [ ] frontend/
- [ ] backend/
- [ ] docs/
- [ ] .github / CI / tooling

## ADR / supersession

- [ ] No existing ADR or test assertion is affected.
- [ ] This changes behavior covered by an existing ADR or test — a new ADR
      was added under `docs/adr/`, and/or `docs/supersession-log.md` was
      updated with the old and new assertion.

## Testing

<!-- What did you run? Paste the relevant command(s) and outcome. -->

- [ ] `make gate` passes locally (or the relevant subset — say which).
- [ ] New/changed behavior has test coverage.

## Screenshots (if UI-facing)

<!--
Only reference a screenshot that actually exists in docs/screenshots-inventory.md,
docs/screenshots/task-4/, backend/docs/screenshots/ or frontend/docs/screenshots/.
-->

## Checklist

- [ ] No secret or credential is included (see `SECURITY.md`).
- [ ] `.env.example` updated in the relevant package if a new environment
      variable was introduced, and the README's environment table matches.
