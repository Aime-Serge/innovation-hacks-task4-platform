# ADR-017: the 170 KB first-load JavaScript budget is not met

**Status:** Open. NFR-04 is **not met**, and the gate reports it as failing.

**What is measured.** `tests/e2e/bundle.spec.ts` loads each route in Chromium with a session, sums every `/_next/static/**/*.js` response, and gzips each at level 6. The budget is the Pack's 170 KB. The test was not loosened.

**Result (production build, Turbopack, Next.js 16.3.4, React 19.2.8).**

| Route | Gzipped JavaScript |
| --- | --- |
| `/` | 186.2 KB |
| `/projects`, `/projects/[id]` | 187.4 KB |
| `/tasks` | 188.4 KB |
| `/profile` | 185.7 KB |
| `/login` | 186.2 KB |

**Why.** The framework alone is about 175 KB. A request for an unknown URL, whose page contains almost none of this application's code (a heading, a link, the theme and session providers), shipped 179 KB in the same measurement. That leaves the Pack's 170 KB below what Next.js and React put on any page in this configuration. The application's own contribution is roughly 8 to 10 KB on top of that floor.

**What was already done to keep it down** (each measured; together they cut 293 KB to 186 KB):

- Zod moved to `zod/mini` (about 75 KB gzip less).
- Radix Dialog, DropdownMenu and Toast, and the two form dialogs, load on first use instead of on every page.
- The Avatar no longer uses Radix; the checkbox is native.
- The query cache, services and toast provider are mounted only under the signed-in layout.
- The mock fixtures are built on the first request.
- Inter is self-hosted, so the build needs no network.

**Options that would close the gap, and what each costs.** None was taken without a decision.

1. `next build --webpack` measured about 7 KB smaller in an earlier build (178 to 182 KB then). Still over, and it makes production and development use different bundlers.
2. Replace TanStack Query (about 10 KB gzip) with a small hook. Together with option 1 this comes close to the budget. It contradicts Pack ADR-004.
3. Move data fetching to server components and server functions, so the browser ships no query cache, no Zod and no mock adapter. This can reach the budget, and it is a re-architecture of every screen.
4. Ask the Pack's owners to restate the budget against the framework floor (for example "floor plus 20 KB").

**Related lab results** (`npm run lighthouse`, mobile profile, median of three runs after a warm-up, machine under normal load).

| Route | Performance | LCP | CLS | Total Blocking Time |
| --- | --- | --- | --- | --- |
| `/` | 84 | 0.76 s | 0.004 | 637 ms |
| `/projects` | 81 | 0.78 s | 0.002 | 787 ms |
| `/tasks` | 78 | 0.78 s | 0.005 | 992 ms |
| `/profile` | 86 | 1.43 s | 0.003 | 552 ms |

LCP and CLS meet their budgets; accessibility, best practices and SEO score 100. The performance score is below the Pack's 90 because blocking time is high, which follows from the same script weight. The script prints TBT but does not gate on it: the Pack's budget is INP, which Lighthouse cannot measure in a lab run and which `tests/e2e/inp.spec.ts` measures on real interactions (worst interaction 128 to 144 ms at a 4x throttled CPU in four quiet runs, budget 200 ms; one run with a stray Chrome process eating CPU measured 264 ms and failed).

**Earlier finding, fixed.** Before the layout-shift work the dashboard scored a CLS of 0.51 and the task page 0.09, because skeletons were shorter than the content that replaced them. Lists now scroll inside a fixed-height box and the project filter reserves its space.
