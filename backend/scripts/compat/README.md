# Task 1 compatibility check

Generates TypeScript types from `docs/openapi.json` and assigns what the API returns to what the
Task 1 dashboard expects. A compile error is a real mismatch (see `docs/compatibility-task1.md`).

```bash
npx openapi-typescript docs/openapi.json -o /tmp/compat/api.d.ts
cp scripts/compat/compat.ts /tmp/compat/
cp <task1>/dashboard/src/schemas/index.ts /tmp/compat/schemas.ts
ln -s <task1>/dashboard/node_modules /tmp/compat/node_modules
<task1>/dashboard/node_modules/.bin/tsc -p /tmp/compat   # tsconfig: strict, noEmit, Bundler resolution
```
