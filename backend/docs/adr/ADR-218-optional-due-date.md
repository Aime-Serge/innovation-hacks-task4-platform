# ADR-218: `Project.dueDate` is optional in Task 2 and required in Task 1

**Status:** Accepted. Reported by the compatibility check.

Task 1's mock `Project` has a required `dueDate`. The Task 2 pack makes it optional and nullable, and a project can be planned before it has a date. Task 2 follows its own pack. Types generated from `docs/openapi.json` therefore have `dueDate: string | null`, and Task 1's Zod schema and any code that formats the date need a null branch before the real adapter is switched on. `docs/compatibility-task1.md` lists every place this matters.
