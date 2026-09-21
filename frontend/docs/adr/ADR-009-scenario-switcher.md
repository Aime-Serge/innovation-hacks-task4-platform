# ADR-009: the scenario switcher stays in production builds

**Status:** Accepted

**Context.** Section 8 requires all nine scenarios to be selectable through `?scenario=`, and the gate says a reviewer must reach each one. Reviewers open the deployed site, not a development build.

**Decision.** `?scenario=` always works, and the header shows a Scenario select. Setting `NEXT_PUBLIC_SCENARIO_SWITCHER=off` hides the select; the URL parameter keeps working. The variable is non-sensitive, as TH-04 requires.

**Consequence.** A real product would remove the switcher in production. That is a one-line environment change.
