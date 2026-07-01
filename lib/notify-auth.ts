import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";

/**
 * Authorizes notify endpoints. These are exempt from the session middleware so
 * an external cron can reach them, so they self-authorize via EITHER:
 *  - a NOTIFY_SECRET (query `?secret=` or `x-notify-secret` header) for cron, or
 *  - a valid dashboard session cookie for in-app (browser) calls.
 */
export async function isAuthorized(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ?? request.headers.get("x-notify-secret") ?? undefined;
  if (process.env.NOTIFY_SECRET && provided === process.env.NOTIFY_SECRET) return true;

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  return Boolean(await getSessionUser(decodeURIComponent(match[1])));
}
