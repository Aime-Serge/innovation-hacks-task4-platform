# ADR-214: the rebuild is not backward compatible with the first deployed API

**Status:** Accepted, and it has a consequence for the live service.

The first Task 2 deployment had unversioned routes, no authentication and different shapes. The pack requires `/api/v1`, bearer tokens, a common error envelope and camelCase JSON, and none of that can be added without breaking those routes. The old API is replaced, not kept beside the new one.

**Consequence.** The live Render service changes when this branch is merged and deployed. Any client written against the old routes stops working. The only client known to exist is the Task 1 dashboard, which still uses its mock adapter, so nothing in the internship breaks. Task 4 was built against its own backend.
