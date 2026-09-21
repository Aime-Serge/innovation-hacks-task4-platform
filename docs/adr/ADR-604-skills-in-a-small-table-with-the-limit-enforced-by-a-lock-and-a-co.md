# ADR-604: Skills in a small table, with the limit enforced by a lock and a constraint trigger

**Status:** Accepted (from the Minimal Profile pack, section 9).

**Reason.** Database-level validation without arrays: at most 10 skills per user, unique by lower-cased name.

**Where it lives.** `profile_skills` table, `uq_profile_skills_user_id_name_lower`, a constraint trigger (migration 0008, to be confirmed).
