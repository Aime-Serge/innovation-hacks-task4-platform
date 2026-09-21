# ADR-016: WebKit in CI only, and how Lighthouse authenticates

**Status:** Accepted. Known limitation.

- **WebKit.** NFR-18 wants Safari. The local machine cannot launch Playwright's WebKit because it lacks system libraries that need `sudo` (`playwright install-deps`). The Playwright config runs WebKit when `PW_WEBKIT=1`, and the CI workflow sets it after `playwright install --with-deps`. Chromium and Firefox ran locally; WebKit results come from CI only.
- **Lighthouse.** The four routes sit behind the mock session cookie, so `scripts/lighthouse.ts` sends `Cookie: mock_session=user-1`. Scores describe the signed-in pages on a production build, on the mobile profile. Lab scores vary by machine.
- **INP.** Lighthouse cannot measure INP in a lab run. Total Blocking Time (budget 200 ms) is the stand-in, and the interaction tests in Playwright cover behaviour.
