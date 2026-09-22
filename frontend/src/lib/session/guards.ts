// Request checks for the server layer (FR-435, TH-408, TH-413).

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// PUT (MF-15, MF-16, MB-05: /me/skills, /me/preferences, /me/privacy are whole-value replacements).
export const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);
// The only API areas the browser may reach through /api/bff (everything else is a 404).
export const ALLOWED_AREAS = new Set([
  "auth",
  "users",
  "projects",
  "tasks",
  "activity",
  "dashboard",
  "ai",
  "me",
]);

/** State-changing calls must come from the site itself: the Origin header equals SITE_URL. */
export function isAllowedOrigin(method: string, origin: string | null, siteUrl: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  return origin !== null && origin === new URL(siteUrl).origin;
}

export type Resolved = { ok: true; path: string } | { ok: false };

/** Turns the catch-all segments into an API path, or refuses: traversal, odd characters, unknown areas. */
export function resolveUpstreamPath(segments: string[]): Resolved {
  if (segments.length === 0 || segments.length > 6) return { ok: false };
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return { ok: false };
    }
    const bad =
      value === "" ||
      value === "." ||
      value === ".." ||
      /[/\\\0?#%]/.test(value) ||
      !/^[\w.~@-]+$/.test(value);
    if (bad) return { ok: false };
    decoded.push(value);
  }
  if (!ALLOWED_AREAS.has(decoded[0] ?? "")) return { ok: false };
  return { ok: true, path: `/api/v1/${decoded.map(encodeURIComponent).join("/")}` };
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
export function requestIdFrom(header: string | null, fresh: () => string): string {
  return header !== null && REQUEST_ID.test(header) ? header : fresh();
}
