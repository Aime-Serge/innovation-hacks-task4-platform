import { NextResponse, type NextRequest } from "next/server";
import { dataSource } from "@/lib/data-source";
import { cookieNames } from "@/lib/session/cookies";

// Redirect away from these if a mock session already exists.
const AUTH_ENTRY_PATHS = ["/login", "/register"];
// Never require a session, and never redirect away regardless of one.
const ALWAYS_PUBLIC_PATHS = ["/forgot-password", "/reset-password"];

/** NFR-16: a fresh nonce per request, so script-src needs no 'unsafe-inline'. */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// mock_session is a plain unsigned cookie set by the mock auth adapter (Task 1
// has no backend). This is a presence check to avoid flashing a protected page
// before the client-side redirect; it is not an authorization control (ADR-010).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthEntry = AUTH_ENTRY_PATHS.includes(pathname);
  const isPublic = isAuthEntry || ALWAYS_PUBLIC_PATHS.includes(pathname);
  // The marker holds no token: it only says a session exists (ADR-425). The API still checks it.
  const hasSession =
    dataSource() === "mock"
      ? request.cookies.has("mock_session")
      : request.cookies.has(cookieNames(process.env["ALLOW_INSECURE_COOKIES"] === "true").marker);

  if (!isPublic && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (isAuthEntry && hasSession) return NextResponse.redirect(new URL("/", request.url));

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // robots.txt must stay public so crawlers get the file, not the login page.
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)" }],
};
