import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

// A cheap presence check only — the signing secret must not be
// duplicated into edge config, so this never verifies the JWT itself.
// The real authorization decision is always re-made by the API on every
// request; this just avoids flashing a protected page before the client
// redirect would otherwise kick in.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const hasSession = request.cookies.has("access_token");

  if (!isPublicPath && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicPath && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
