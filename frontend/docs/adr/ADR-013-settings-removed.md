# ADR-013: Settings is folded into Profile

**Status:** Accepted. Scope reduction against the baseline.

The Pack defines four routes plus project detail and names no Settings page. The baseline's Settings (avatar upload, password change, account deletion) was 330 lines in one component and outside the Pack. Name and theme now live on the Profile page (FR-10). Avatar upload, password change and account deletion are not in this build. The mock auth adapter still implements them behind `AuthService` and its tests, so they can return as small components without new services.
