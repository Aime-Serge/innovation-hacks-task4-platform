# ADR-426: registration photo is an optional, validated avatar source

**Status:** Accepted.

**Context.** Task 1 offered a small account form and an optional avatar, while Task 4 registration
creates an account together with the professional profile needed throughout the platform. The
registration flow must not discard that richer information, and a selected image must survive the
same real-API path as the rest of the profile rather than only working in the Task 1 mock.

**Decision.** The Task 4 wizard remains two steps: account details first, then the required
professional profile, optional location fields, consent and an optional profile image. The image
can be an `https` link or a selected PNG, JPEG or WebP file up to 500 KB. A selected file is read
as a base64 `data:image/...` value; the client previews that exact value and sends it as the
top-level `avatarUrl` member of `POST /users`.

The API validates the same two source forms, stores the value in the existing `users.avatar_url`
column, and rejects invalid images before an account is created. Migration `0009` expands the
database check constraint for the inline form while retaining existing `https` avatars. The CSP
allows `https:` and `data:` images. Avatar consumers use the returned value in the account menu,
profiles, people picker, task assignee cards and activity feed; they fall back to initials if it is
missing or cannot load.

**Consequences.** There is no object-storage service in this release, so inline images add at most
about 700 KB to the registration payload and database row. The API's 1 MB body limit still leaves
room for the complete registration document. An externally linked image may later disappear; the
visible fallback preserves a usable identity in that case. Updating an existing avatar remains
outside this registration decision.
