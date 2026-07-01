import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { signSessionToken } from "@/lib/session-token";
import { authenticateUser } from "@/lib/users";
import { recordLogin } from "@/lib/visits";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const user = await authenticateUser(username, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
  }

  const [{ token, expiresAt }] = await Promise.all([createSession(user.id), recordLogin(user.id)]);
  const signed = signSessionToken({
    sid: token,
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: expiresAt.getTime(),
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
  return res;
}
