import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import type { UserRecord, UserRole } from "@/lib/types";

// Session lookups are a Supabase (fetch-based) call — works on either
// runtime, kept on Node.js for parity with the rest of the app's server code.
export const runtime = "nodejs";

// A Supabase round-trip on every single request (every page load, every
// poll) adds ~400-600ms to everything. Cache the resolved session per token
// for a short window so a burst of navigation/polling from one browser
// reuses the same lookup instead of re-querying Supabase each time.
// Tradeoff: a session revoked via logout/delete can still pass here for up
// to CACHE_TTL_MS afterward if the request lands on the same warm instance
// that cached it — acceptable for an internal dashboard, not for anything
// handling sensitive data.
const CACHE_TTL_MS = 20_000;
const sessionCache = new Map<string, { user: UserRecord | null; cachedAt: number }>();

function getCachedSessionUser(token: string): UserRecord | null | undefined {
  const entry = sessionCache.get(token);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    sessionCache.delete(token);
    return undefined;
  }
  return entry.user;
}

function setCachedSessionUser(token: string, user: UserRecord | null) {
  if (sessionCache.size > 1000) {
    for (const [key, entry] of sessionCache) {
      if (Date.now() - entry.cachedAt > CACHE_TTL_MS) sessionCache.delete(key);
    }
  }
  sessionCache.set(token, { user, cachedAt: Date.now() });
}

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let user: UserRecord | null = null;
  if (token) {
    const cached = getCachedSessionUser(token);
    user = cached !== undefined ? cached : await getSessionUser(token);
    if (cached === undefined) setCachedSessionUser(token, user);
  }

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
