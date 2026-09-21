# ADR-423: visibility is a `ReadScope` built by one function and applied by every query

**Status:** Accepted.

The pack (section 6) asks for one function that builds the readable-project condition, `owner_id = :user` or a task assigned to the user in the project or the user is a lead, used by every query. The two storage backends cannot share a SQL fragment, and the in-memory backend keeps projects and tasks in separate objects.

`services/visibility.read_scope` therefore computes, once per request and inside the request's transaction, a `ReadScope`: a lead reads everything; anyone else reads the ids of the projects they own plus the projects in which a task is assigned to them (the second lookup is served by the assignee index the pack adds). Every query object (`ProjectQuery`, `TaskQuery`, `ActivityQuery`) and the two aggregates (`count`, `totals`) carry that scope, and the repositories only apply it (`ReadScope.allows` in memory, `project_id IN (...)` in SQL). No other code decides visibility, and a project the caller may not read is 404 (BR-402); as a body field it is a 422 on that field, like an unknown id.

Cost: two small extra lookups per non-lead request, and a large `IN` list only for a person who owns or holds tasks in very many projects, which is outside this pack's scale (a small team). If that changes, the same `ReadScope` can be rendered as the pack's `EXISTS` condition without touching the services.
