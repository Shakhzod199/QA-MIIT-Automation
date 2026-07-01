import type { UserRole } from "@/lib/types";

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

/** True if `role` is at least as privileged as `minimum`. */
export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
