# ADR-325: this replaces the first Task 3 implementation

**Status:** Accepted, with a consequence for the live service.

The first Task 3 implementation (a different layout with its own tables and routes, deployed on Render) is replaced by the rebuild of the Task 2 API on PostgreSQL. Its history stays in Git, and this ADR is the record. The API contract is now Task 2's, so any client written against the first implementation's routes stops working once the rebuild is deployed. The Task 1 dashboard uses its mock adapter and is unaffected.
