// The session cookies, set only by the server layer (section 9, ADR-403). No token is ever
// readable by page scripts: every cookie is HttpOnly, and the API stays Bearer-only.

export type CookieSpec = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "Lax" | "Strict";
  path: string;
  /** Absent means a browser-session cookie: it ends when the browser closes. */
  maxAge?: number;
};

export type Tokens = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
};

export const REFRESH_PATH = "/api/bff/auth";

export function cookieNames(insecure: boolean): {
  access: string;
  refresh: string;
  marker: string;
} {
  // __Host- needs Secure, Path=/ and no Domain; __Secure- needs Secure. Plain HTTP cannot have them.
  return insecure
    ? { access: "ih_at", refresh: "ih_rt", marker: "ih_s" }
    : { access: "__Host-ih_at", refresh: "__Secure-ih_rt", marker: "__Host-ih_s" };
}

export function sessionCookies(tokens: Tokens, insecure: boolean): CookieSpec[] {
  const names = cookieNames(insecure);
  const base = { httpOnly: true, secure: !insecure } as const;
  // No Max-Age on any of them: closing the browser signs the person out, so the next visit opens
  // on the welcome page. The API still ends each token at its own expiry while the browser stays
  // open, and the client refreshes after a 401 (FR-405).
  return [
    {
      ...base,
      name: names.access,
      value: tokens.accessToken,
      sameSite: "Lax",
      path: "/",
    },
    {
      ...base,
      name: names.refresh,
      value: tokens.refreshToken,
      sameSite: "Strict",
      path: REFRESH_PATH,
    },
    // Not a token: only says "a session exists", so the route guard can redirect before any script
    // runs. The refresh cookie is path-limited and never reaches page requests (FR-404, ADR-425).
    {
      ...base,
      name: names.marker,
      value: "1",
      sameSite: "Lax",
      path: "/",
    },
  ];
}

export function clearedCookies(insecure: boolean): CookieSpec[] {
  const names = cookieNames(insecure);
  const base = { httpOnly: true, secure: !insecure, value: "", maxAge: 0 } as const;
  return [
    { ...base, name: names.access, sameSite: "Lax", path: "/" },
    { ...base, name: names.refresh, sameSite: "Strict", path: REFRESH_PATH },
    { ...base, name: names.marker, sameSite: "Lax", path: "/" },
  ];
}

export function serializeCookie(spec: CookieSpec): string {
  const parts = [
    `${spec.name}=${encodeURIComponent(spec.value)}`,
    `Path=${spec.path}`,
    ...(spec.maxAge === undefined ? [] : [`Max-Age=${spec.maxAge}`]),
    "HttpOnly",
    `SameSite=${spec.sameSite}`,
  ];
  if (spec.secure) parts.push("Secure");
  return parts.join("; ");
}

export function parseCookies(header: string | null): Map<string, string> {
  const found = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    try {
      found.set(name, decodeURIComponent(part.slice(index + 1).trim()));
    } catch {
      // A malformed value is ignored, never trusted.
    }
  }
  return found;
}
