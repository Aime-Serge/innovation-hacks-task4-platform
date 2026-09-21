/**
 * Only same-origin, absolute-path redirect targets are allowed. router.push
 * and location.assign both follow a full URL to another site, so an
 * unvalidated ?next= would be an open redirect.
 */
export function safeInternalPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

/**
 * Full page load, used after any auth state change (login, register,
 * logout, account deletion). A client-side router.push isn't enough:
 * production builds prefetch links in the background, and while logged
 * out the route guard answers the prefetch of "/" with a redirect to
 * /login — which the router caches and then replays after login, bouncing
 * the user straight back to the login page. A real navigation bypasses
 * that cache (and, on logout, also drops any cached authenticated pages).
 */
export function hardNavigate(path: string): void {
  window.location.assign(safeInternalPath(path));
}

/**
 * Updates the URL without a navigation. Next.js integrates the History API with
 * usePathname and useSearchParams, so filters stay shareable (FR-17) without a
 * server round trip on every click, which is what keeps interactions under the
 * 200 ms INP budget (NFR-03).
 */
export function replaceUrl(href: string): void {
  // null, not the current state: Next treats its own state object as an internal call and skips the router update.
  window.history.replaceState(null, "", href);
}
