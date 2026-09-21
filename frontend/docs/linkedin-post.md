# LinkedIn post draft: Task 1

Post this once the demo video is recorded and uploaded. Attach the video (or
two or three screenshots from `docs/screenshots/`) and tag Innovation Hacks with
LinkedIn's own @-mention: a plain "@Innovation Hacks" typed as text does not
create a real tag. Select their page from the mention dropdown as you type, and
confirm it is their official page first.

## Post copy

> Task 1 of my Full Stack Development Internship with @Innovation Hacks: a Developer Productivity Dashboard, rebuilt to an engineering standards pack instead of "it works on my machine".
>
> What I'm proud of:
> - Strict TypeScript end to end. Every type comes from a Zod schema, and an ESLint boundary rule fails the build if a component ever imports mock data. Swapping in the real API in Task 2 means changing one adapter.
> - Every screen has all its states: loading, empty, no results, error with Retry. Nine mock scenarios (slow, empty, failing, flaky, 500 tasks, emoji and right-to-left text) are one URL parameter away, so I could prove each state instead of hoping.
> - 235 unit and component tests at 93% line coverage, browser tests in Chromium and Firefox, and an axe accessibility run across every route in light and dark themes: zero violations.
> - Security as a build step: nonce-based Content-Security-Policy, security headers, a secret scan and a dependency audit.
>
> What I'm being straight about: the Standards Pack wants under 170 KB of JavaScript per route and Lighthouse performance of 90 or more. Next.js and React alone ship about 180 KB in my measurements, so those two checks still fail, and I wrote the numbers and the options into a decision record instead of loosening the test.
>
> Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, TanStack Query, Zod, Radix, Vitest, Playwright, axe.
>
> Repo and demo in the comments. #FullStackDevelopment #NextJS #TypeScript #Accessibility #InnovationHacks #Internship

## Shorter version

> Shipped Task 1 of my @Innovation Hacks Full Stack Development Internship: a developer dashboard in strict TypeScript with 235 tests, zero axe accessibility violations across every route and both themes, and nine mock scenarios that prove every loading, empty and error state. I also documented where it misses the standards pack's performance budget instead of hiding it. #FullStackDevelopment #NextJS #InnovationHacks

## Before you post

- [ ] Demo video recorded and uploaded (see `DEMO_SCRIPT.md`)
- [ ] The numbers above still match the README's gate table. Re-run `npm run gate` if the code changed, and edit the copy to what you saw
- [ ] GitHub repo pushed, and the branch merged or the link pointing at `task/1-frontend`
- [ ] Innovation Hacks tagged through the mention dropdown, not typed text
- [ ] Video or screenshots attached to the post itself
- [ ] Repo and demo links added as the first comment

## First comment

Live: https://task-management-dashboard-two-beta.vercel.app (demo login: aime.serge@example.com / password123, a mock account)
Repo: https://github.com/Aime-Serge/innovation-hacks-task1-dashboard
Demo: [add after recording]
