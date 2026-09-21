# ADR-412: The model returns relative days, never absolute dates

**Status:** Accepted (from the Task 4 pack, section 7).

**Reason.** Avoids date arithmetic errors

**Where it lives.** `backend/app/ai/schemas.py` (`dueInDays`), `frontend/src/features/ai/TaskGenerationDialogImpl.tsx`.
