import { createHmac, timingSafeEqual } from "crypto";
import type { UserRole } from "@/lib/types";

// Self-verifying session cookie: signature + expiry check with zero I/O, so
// middleware doesn't need a Supabase round-trip on every request. `sid` is
// the underlying opaque token (matches a row in the `sessions` table) — kept
// so sensitive routes can still do a real revocation check, and so logout
// can delete the right row.
export interface SessionTokenPayload {
  sid: string;
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  /** Epoch ms. */
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set.");
  return secret;
}

function signBody(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionTokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = signBody(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
