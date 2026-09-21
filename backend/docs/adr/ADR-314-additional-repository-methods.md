# ADR-314: four additive repository methods, and a `with_hash` option

**Status:** Accepted. The pack allows two additive changes to the Task 2 protocols (locking reads and the `UnitOfWork` port, ADR-303). Its own requirements need more.

- FR-310 and NFR-304 ask for one aggregate over a page of projects, and dashboard totals from one query. That needs `progress_for_many(ids)` and `totals(today)`, plus `projects.count(statuses)` for the active-project count.
- FR-321 loads the `xl` profile (80,000 rows) by bulk insert. That needs `add_many` on each repository.
- NFR-318 says only the login lookup reads `password_hash`. Registration also looks an email up, so `get_by_email` gets `with_hash: bool = False`, and only login passes `True`.

No existing method changed signature or meaning, both backends implement all of them, and the contract suite covers them.
