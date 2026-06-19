import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /api/notify self-authorizes (session cookie OR NOTIFY_SECRET) so external
// cron can reach it, so it is exempt from the session redirect here.
// The PWA manifest + icons must be publicly fetchable so the browser can read
// them to offer "Install" even before/independent of a session.
const PUBLIC = [
  "/login",
  "/api/auth",
  "/api/notify",
  "/manifest.webmanifest",
  "/icon-",
  "/apple-touch-icon",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("ds")?.value;
  const secret = process.env.DASHBOARD_SECRET ?? "ds-session";

  if (!session || session !== secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
