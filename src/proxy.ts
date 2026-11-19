import { NextResponse, type NextRequest } from "next/server";

// Fast path only: no session cookie at all → go to /login. The cookie's signature and the
// profile are checked on the server for every page, download and action (requireProfile).
const COOKIE = "eor_session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return new NextResponse("Please sign in", { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except sign-in pages, Next internals and static files.
  matcher: ["/((?!login|auth/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
