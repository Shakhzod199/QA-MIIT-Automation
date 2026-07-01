import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  deleteSession(request.cookies.get(SESSION_COOKIE)?.value);

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
