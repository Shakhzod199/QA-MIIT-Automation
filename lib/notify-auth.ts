/**
 * Authorizes notify endpoints. These are exempt from the session middleware so
 * an external cron can reach them, so they self-authorize via EITHER:
 *  - a NOTIFY_SECRET (query `?secret=` or `x-notify-secret` header) for cron, or
 *  - a valid dashboard session cookie for in-app (browser) calls.
 */
export function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ?? request.headers.get("x-notify-secret") ?? undefined;
  if (process.env.NOTIFY_SECRET && provided === process.env.NOTIFY_SECRET) return true;

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)ds=([^;]+)/);
  const expected = process.env.DASHBOARD_SECRET ?? "ds-session";
  return Boolean(match && decodeURIComponent(match[1]) === expected);
}
