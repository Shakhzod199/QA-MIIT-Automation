"use client";

import { createContext, useContext } from "react";
import type { SessionUserInfo } from "@/lib/session";

const UserContext = createContext<SessionUserInfo | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: SessionUserInfo | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** The logged-in user, or null on the (public) login page. */
export function useCurrentUser(): SessionUserInfo | null {
  return useContext(UserContext);
}
