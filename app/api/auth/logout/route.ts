import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";
import { verifySessionToken } from "@/lib/session-token";

export async function POST(request: NextRequest) {
  const claims = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (claims) await deleteSession(claims.sid);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
