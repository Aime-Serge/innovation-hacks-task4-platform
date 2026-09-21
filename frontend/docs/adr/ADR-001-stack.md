# ADR-001 (Pack ADR-001, 002, 003): stack, strict TypeScript, service seam

**Status:** Accepted

- Next.js App Router with React 19. Layouts, `error.tsx` and `not-found.tsx` map to the states the Pack requires.
- TypeScript strict everywhere: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `allowJs: false`. `npm run check:no-js` fails on any JavaScript file; the allowlist is empty. PostCSS is configured declaratively in `postcss.config.json`, so no JavaScript config remains.
- Components depend on the `ProjectService`, `TaskService`, `UserService` and `ActivityService` interfaces in `src/services`. The only importer of an adapter is `src/providers`, enforced by ESLint. Task 2 adds `adapters/http` and changes one provider.

Alternative considered: Vite with React. Rejected because the guide approves Next.js and its file conventions cover the required states.
