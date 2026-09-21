# ADR-328: large lists count separately and only when the page is full

**Status:** Accepted. Refines ADR-324.

ADR-324 used a window count so that a list costs one query. The `xl` load test showed the price: at
20,000 tasks `count(*) OVER ()` makes the database materialise and sort every match, and a plain
task list took 130 ms with nobody else using the server. Now:

- **Users and projects** (hundreds to a thousand rows) keep the window count, so a project list is
  still user, page, progress: three queries.
- **Tasks and activity** fetch the page alone. A page shorter than the page size already gives the
  total (offset plus rows), so a small result costs no count. Only a full page runs `count(*)`, so
  the worst case is user, page, count: still three queries, and no growth with page size (TC-392).
- Migration `0004` adds `ix_tasks_created_at_id`, because the default order is `created_at` and no
  index served it. The pack's index list is the minimum; Phase 8 allows an index that a named query
  justifies.
