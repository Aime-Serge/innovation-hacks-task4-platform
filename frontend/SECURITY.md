# Security policy

DevDash is a demo build: mock data, a mock login, no server-side secrets. The
controls below are still enforced, because they carry over to the real backend.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository (Security tab, "Report
a vulnerability"), or an issue that does not include exploit details. Please
allow a reasonable time to respond before disclosing publicly.

## Controls in this repository

| Area | Control | Where verified |
| --- | --- | --- |
| Script injection | Per-request nonce Content-Security-Policy, no `dangerouslySetInnerHTML` (lint), React escaping | `tests/e2e/platform.spec.ts`, ADR-011 |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | headers test |
| Transport and browser features | HSTS, `nosniff`, referrer policy, permissions policy | headers test |
| Hostile URL state | Query parameters parsed against allow-lists; unknown values fall back to defaults | TC-053 |
| Open redirects | `?next=` accepts only same-origin paths | TC-004 |
| Hostile API responses | Every adapter response is validated with a Zod schema; a parse failure becomes the error state | contract tests |
| Secrets | Secret scan in the gate; only non-sensitive `NEXT_PUBLIC_` variables | `npm run audit` |
| Dependencies | Exact versions, committed lockfile, `npm audit` gate, Dependabot | `npm run audit` |

## Known weaknesses (by design, demo only)

The mock login stores accounts and plain-text passwords in `localStorage` and
uses an unsigned session cookie ([ADR-010](docs/adr/ADR-010-mock-auth.md)).
Never enter a real password. Task 2 replaces it with an HttpOnly, Secure,
SameSite session cookie.
