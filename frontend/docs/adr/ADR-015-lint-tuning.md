# ADR-015: one typescript-eslint rule is tuned

**Status:** Accepted

The config is `typescript-eslint` `strictTypeChecked` plus `no-explicit-any` and `ban-ts-comment` as errors, `react/jsx-no-literals` (NFR-21), `react/no-danger`, `max-lines` of 200 for components, and import boundaries.

The only tuning: `@typescript-eslint/no-confusing-void-expression` runs with `ignoreArrowShorthand: true`, so `onClick={() => setOpen(true)}` is allowed. The rule still forbids returning a void expression from a normal function. No rule is disabled, no inline `eslint-disable` exists, and no threshold was lowered.
