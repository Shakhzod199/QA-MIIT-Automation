"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useCurrentUser } from "@/components/UserProvider";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();

  if (pathname === "/login" || pathname === "/m" || pathname.startsWith("/m/")) {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 flex h-screen w-[212px] shrink-0 flex-col overflow-y-auto border-r border-surface-border bg-surface-sidebar">
        {/* Logo */}
        <Link
          href="/trends"
          className="flex items-center gap-2.5 px-4 pb-5 pt-5 transition hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small static asset, no optimization needed */}
          <img
            src="/icon-192-android.png"
            alt="QAutomation logo"
            className="h-[26px] w-[26px] shrink-0 rounded-[7px]"
          />
          <span className="text-[14px] font-semibold tracking-[-0.2px] text-q-text">
            QA Dashboard
          </span>
        </Link>

        <Suspense fallback={null}>
          <SidebarNav />
        </Suspense>

        <div className="mt-auto">
          <div className="px-3 pb-1">
            <LanguageSwitcher />
          </div>
          <div className="flex items-center gap-2.5 border-t border-surface-border px-3 py-3 mt-1">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full"
              style={{ background: "linear-gradient(135deg,#3a4150,#222831)" }}
            >
              {/* Placeholder person silhouette (head + shoulders), clipped by the circle */}
              <svg viewBox="0 0 24 24" className="mt-1.5 h-6 w-6" fill="#8a93a0" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M12 13.5c-4.4 0-8 2.9-8 6.5v4h16v-4c0-3.6-3.6-6.5-8-6.5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-q-text">
                {user?.name || user?.username || "QA Team"}
              </div>
              <button
                onClick={handleSignOut}
                className="text-[11px] text-q-dim transition hover:text-q-muted"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
