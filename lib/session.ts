import { headers } from "next/headers";
import type { UserRole } from "@/lib/types";

export interface SessionUserInfo {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
}

/** Reads the identity middleware already resolved and forwarded via headers — no extra DB hit. */
export async function getCurrentUser(): Promise<SessionUserInfo | null> {
  const h = await headers();
  const id = h.get("x-user-id");
  const username = h.get("x-user-username");
  const role = h.get("x-user-role") as UserRole | null;
  if (!id || !username || !role) return null;
  const name = h.get("x-user-name");
  return { id: Number(id), username, name: name || null, role };
}
