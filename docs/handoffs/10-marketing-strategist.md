# Handoff Artifact: Marketing Strategist → Submission Package

## Most demo-able moment

Not "I added AI" — the concrete before/after: an empty project with just
a name and description, one click on "Generate tasks with AI," and a
real, editable task checklist appears that you can trim/edit and add for
real, inside the actual authenticated app (not a mockup, not a slide).
That's the hook — a visible transformation, not a claim.

## LinkedIn Post Copy

**Hook:**
Empty project → full task breakdown in one click. That's the moment I
wanted this post to lead with, not just "I added AI to my app."

**Body:**
Just shipped the capstone of my Full Stack Development Internship with
Innovation Hacks — an AI-powered project & task manager with real
authentication (Argon2id password hashing, CSRF-hardened sessions) and
a Postgres-backed API underneath. The AI feature takes a project's name
and description and proposes a concrete task list you can edit before
adding — and if the AI call ever fails, it falls back to a real
checklist instead of breaking, so the feature never leaves you stuck.
89 backend tests, a full security review, and four connected build
stages later, here's the result.

**Tag:** @Innovation Hacks (select from LinkedIn's mention dropdown —
see note below)

**Hashtags:** #FullStackDevelopment #SoftwareEngineering #AI
#BuildInnovateImpact #WebDevelopment

**Call to action:**
Repo, demo video, and the full build writeup (including the security
review that found and fixed a real bug before this shipped) are linked
below. Would love feedback from anyone who's built something similar.

---

## Suggested Clip (for the post itself — a short excerpt, not the full demo video)

~20–25 seconds, cut from `DEMO_SCRIPT.md`'s beats:
1. (2s) Already logged in, dashboard visible — skip the register/login
   typing, it's not the visual hook.
2. (5s) Open a project with a name + description but no tasks yet — the
   "before" state.
3. (10s) Click "Generate tasks with AI," show the brief loading state,
   then the checklist appearing.
4. (5–8s) Uncheck one suggestion, click "Add N tasks," cut to the task
   list now populated — the "after" state, in the same shot continuity
   as the "before."

Keep it a single unbroken interaction if possible (no jump cuts mid-
click) — LinkedIn video performs better as one continuous, real
demonstration than an edited montage for a claim like this.

## Note: confirm the real Innovation Hacks LinkedIn handle before posting

I have not verified Innovation Hacks' actual LinkedIn page/handle — I
don't have a reliable way to confirm it from here, and guessing a URL
risks tagging the wrong page. Before posting: search "Innovation Hacks"
directly in LinkedIn's own search, open their real company page, and use
LinkedIn's `@`-mention autocomplete (typing `@Innovation Hacks` as plain
text does not create a real tag/link — you have to select it from the
dropdown as you type). This matches the same caution already in
`docs/linkedin-post.md`.
