"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { authenticateUser } from "@/lib/users";
import { recordLogin } from "@/lib/visits";

export async function loginAction(
  username: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  const user = await authenticateUser(username, password);
  if (!user) return { error: "Invalid username or password" };

  // Independent writes — creating the session doesn't depend on the visit
  // log or vice versa, so run them concurrently instead of back-to-back.
  const [{ token, expiresAt }] = await Promise.all([createSession(user.id), recordLogin(user.id)]);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
  return { success: true };
}
