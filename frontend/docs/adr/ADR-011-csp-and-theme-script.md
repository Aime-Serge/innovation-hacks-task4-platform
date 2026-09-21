# ADR-011: nonce CSP, dynamic rendering, and the theme script

**Status:** Accepted

**Context.** The Pack's CSP is `default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. A nonce only works when the page is rendered per request. FR-24 also needs the theme set before first paint, which needs a script that runs before the body.

**Decisions.**
1. `src/proxy.ts` generates a nonce per request and sets `Content-Security-Policy` on the request and the response. Next applies the nonce to its own scripts. Development adds `'unsafe-eval'` for React's debugging; production does not.
2. The root layout reads the nonce from the request headers. That opts every route into dynamic rendering. There is no static prerendering, and that is the price of a nonce (Next.js CSP guide).
3. The theme script is one inline `<script nonce>` in `<head>`. It has no `dangerouslySetInnerHTML` (banned by lint): React writes a string child of `<script>` unescaped.
4. `style-src` carries the same nonce as scripts and never `unsafe-inline` (see the amendment below). Two components had to change to comply: the checkbox is native (ADR-006), and the toast viewport mounts only while a toast exists, because Radix renders `style="pointer-events:none"` on it. `tests/e2e/platform.spec.ts` fails on any CSP console error across every route.

**Relaxation.** One: see the amendment below.

## Amendment: `style-src` carries a nonce (a relaxation of the Pack's CSP)

The Pack's header table says `style-src 'self'`. Opening any Radix dialog made Chromium report a CSP violation: `react-remove-scroll`, which Radix Dialog uses to lock page scroll, injects a `<style>` element at runtime, and `style-src 'self'` blocks it (the scroll lock silently did nothing). Found by `tests/e2e/platform.spec.ts`, which fails on any CSP console error.

Options considered:
1. `'unsafe-inline'`: rejected, it allows any injected style.
2. Replace Radix Dialog with the native `<dialog>` element: rejected for now. It would remove the relaxation, but it departs from Pack ADR-006 and needs its own keyboard, drawer and jsdom test work.
3. **Chosen:** `style-src 'self' 'nonce-…'` with the same per-request nonce as scripts, and `NonceBridge` sets `window.__webpack_nonce__` so the library stamps its tag. Only a `<style>` carrying the nonce runs, so an attacker who can inject markup still cannot inject styles.

This is the only relaxation. `script-src`, `img-src`, `frame-ancestors`, `base-uri` and `form-action` follow the Pack exactly. The unit test and the e2e test assert the nonce form and the absence of `unsafe-inline`.
