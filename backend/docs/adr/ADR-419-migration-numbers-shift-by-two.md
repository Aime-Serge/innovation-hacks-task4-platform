# ADR-419: Task 4 migrations are numbered 0005 to 0007

**Status:** Accepted.

The pack calls its migrations `0003_refresh_tokens`, `0004_ai_requests` and `0005_visibility_index`, but Task 3 already uses 0003 (reporting grants) and 0004 (task creation index). Renumbering the Task 3 files would rewrite history that is already applied elsewhere, so the Task 4 migrations become `0005_refresh_tokens`, `0006_ai_requests` and `0007_visibility_index`. Names and contents are unchanged; only the sequence differs.
