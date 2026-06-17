"use server";

import { cookies } from "next/headers";

export async function loginAction(
  username: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  if (
    username === process.env.DASHBOARD_USERNAME &&
    password === process.env.DASHBOARD_PASSWORD
  ) {
    const cookieStore = await cookies();
    cookieStore.set("ds", process.env.DASHBOARD_SECRET ?? "ds-session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return { success: true };
  }
  return { error: "Invalid username or password" };
}
