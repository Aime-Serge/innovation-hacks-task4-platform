import { NextRequest, NextResponse } from "next/server";

// Redirect away from these if a session already exists — no reason to
// show a login/register form to someone already signed in.
const AUTH_ENTRY_PATHS = ["/login", "/register"];
// Never require a session, and never redirect away regardless of one —
// a signed-in user (possibly a stale/different-account cookie) clicking
// a real reset-password link must still land on it.
const ALWAYS_PUBLIC_PATHS = ["/forgot-password", "/reset-password"];

// A cheap presence check only — the signing secret must not be
// duplicated into edge config, so this never verifies the JWT itself.
// The real authorization decision is always re-made by the API on every
// request; this just avoids flashing a protected page before the client
// redirect would otherwise kick in.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthEntry = AUTH_ENTRY_PATHS.includes(pathname);
  const isAlwaysPublic = ALWAYS_PUBLIC_PATHS.includes(pathname);
  const hasSession = request.cookies.has("access_token");

  if (!isAuthEntry && !isAlwaysPublic && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthEntry && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // /api/* is the same-origin pass-through to the backend (see
  // next.config.ts) — it must not be redirected to /login, since the
  // login request itself goes through it.
  matcher: ["/((?!api/|_next|favicon.ico).*)"],
};
