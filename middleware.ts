import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { verifySessionToken } from "@/lib/session-token";
import type { UserRecord, UserRole } from "@/lib/types";

// Runs on Node.js so the sensitive-route path below can call Supabase.
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
// This same list also marks which routes are worth a real Supabase
// revocation check (see middleware() below) — they're the only ones where a
// stale signed cookie (already-deleted user, changed role) actually matters.
function requiredRoleFor(pathname: string): UserRole | null {
  if (pathname.startsWith("/users") || pathname.startsWith("/api/users")) return "admin";
  if (pathname === "/api/runs/trigger") return "editor";
  if (/^\/api\/runs\/\d+\/cancel$/.test(pathname)) return "editor";
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = verifySessionToken(token);

  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requiredRole = requiredRoleFor(pathname);

  // Ordinary routes trust the signed cookie (pure crypto check above, zero
  // I/O) — this is what makes middleware fast on serverless, where an
  // in-memory cache can't be relied on across instances. Sensitive routes
  // (admin/user-management, trigger, cancel) pay one real Supabase lookup so
  // a deleted user or revoked session can't act on them, even though their
  // still-unexpired cookie would otherwise pass the signature check.
  let user: UserRecord | null = {
    id: claims.id,
    username: claims.username,
    name: claims.name,
    role: claims.role,
    createdAt: "",
    // Not in the signed cookie claims and not needed for this fast path (it
    // only feeds the role check below) — route handlers that need a fresh,
    // authoritative allow-list fetch it themselves via lib/access.ts.
    allowedWorkflows: [],
  };

  if (requiredRole) {
    user = await getSessionUser(claims.sid);
    if (!user) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!hasRole(user.role, requiredRole)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Forward the resolved identity so pages/route handlers don't need a
  // second DB round-trip per request.
  const headers = new Headers(request.headers);
  headers.set("x-user-id", String(user.id));
  headers.set("x-user-username", user.username);
  headers.set("x-user-name", user.name ?? "");
  headers.set("x-user-role", user.role);
  // sessions.token — lets /api/heartbeat write last_seen without re-verifying
  // the cookie itself (that already happened above, at zero I/O cost).
  headers.set("x-session-id", claims.sid);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
