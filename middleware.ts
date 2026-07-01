import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

// Session lookups hit SQLite, which needs real Node.js (native bindings) —
// not the default Edge middleware runtime.
export const runtime = "nodejs";

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

// Path-based authorization on top of "any valid session" — admin owns user
// management, editor+ can trigger/cancel runs, everyone else is read-only.
function requiredRoleFor(pathname: string): UserRole | null {
  if (pathname.startsWith("/users") || pathname.startsWith("/api/users")) return "admin";
  if (pathname === "/api/runs/trigger") return "editor";
  if (/^\/api\/runs\/\d+\/cancel$/.test(pathname)) return "editor";
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = getSessionUser(token);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requiredRole = requiredRoleFor(pathname);
  if (requiredRole && !hasRole(user.role, requiredRole)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Forward the resolved identity so pages/route handlers don't need a
  // second DB round-trip per request.
  const headers = new Headers(request.headers);
  headers.set("x-user-id", String(user.id));
  headers.set("x-user-username", user.username);
  headers.set("x-user-name", user.name ?? "");
  headers.set("x-user-role", user.role);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
