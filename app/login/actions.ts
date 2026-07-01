"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { authenticateUser } from "@/lib/users";

export async function loginAction(
  username: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  const user = await authenticateUser(username, password);
  if (!user) return { error: "Invalid username or password" };

  const { token, expiresAt } = await createSession(user.id);
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
