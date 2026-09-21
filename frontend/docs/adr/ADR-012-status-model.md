# ADR-012: task status and priority follow the Pack

**Status:** Accepted

The baseline used `in-progress` and `blocked`, and had no `in_review` or `urgent`. BR-01 and BR-02 fix the sets: status is `todo`, `in_progress`, `in_review`, `done`; priority is `low`, `medium`, `high`, `urgent`. The baseline's `blocked` status is dropped because the Pack's workflow diagram has no such state. Progress (BR-03) counts `done`; overdue (BR-04) is a past due date on a task that is not `done`.
