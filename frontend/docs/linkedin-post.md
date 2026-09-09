# LinkedIn post draft — Task 1

Post this once the demo video is recorded and uploaded. Attach the video
(or, if it's not ready yet, 2-3 of the screenshots from `docs/screenshots/`)
and tag Innovation Hacks using LinkedIn's own @-mention when you type the
post — a plain "@Innovation Hacks" typed as text does not create a real
tag/link, you have to select their page from the mention dropdown as you
type.

## Post copy

> Task 1 of my Full Stack Development Internship with @Innovation Hacks: a Developer Productivity Dashboard — an at-a-glance status view for a developer's own projects and tasks.
>
> A few decisions I'm glad I made:
> - Skipped the generic SaaS look (glossy cards, drop shadows, arbitrary blue badges) for something that actually fits the subject: a graphite editor-style canvas, monospace type for identifiers and numbers, and a diff-inspired status system where every state is an icon shape + text — never color alone.
> - Every dynamic view — stats, projects, tasks, profile — has real loading, empty, and error states, not just a happy path. Verified with an automated accessibility scan (zero violations) and tested at 375/768/1280px for zero horizontal scroll.
> - Built the component architecture so Task 2's real API will be a drop-in swap of two fetch functions, not a rewrite.
>
> Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, Vitest + Testing Library, Playwright for verification.
>
> Repo + demo in the comments. #FullStackDevelopment #NextJS #TypeScript #WebDevelopment #InnovationHacks #Internship

## Shorter alternative (if the above reads long for your feed)

> Just shipped Task 1 of my @Innovation Hacks Full Stack Development Internship — a Developer Productivity Dashboard built with Next.js, TypeScript, and Tailwind CSS v4. Loading/empty/error states on every view, zero accessibility violations on an automated scan, and a component architecture designed so the real API in Task 2 is a drop-in swap, not a rewrite.
>
> Repo + demo below. #FullStackDevelopment #NextJS #WebDevelopment #InnovationHacks

## Before you post

- [ ] Demo video recorded and uploaded (see `DEMO_SCRIPT.md`)
- [ ] GitHub repo pushed and set to a link you can actually share
- [ ] Tag applied via LinkedIn's mention dropdown, not typed as plain text
- [ ] Video or screenshots attached to the post itself, not just linked
- [ ] Repo + demo links added as the first comment (LinkedIn deprioritizes posts with outbound links in the body)
