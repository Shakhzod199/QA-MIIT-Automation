"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

type Tab = { href: string; key: string; icon: React.ReactNode };

const TABS: Tab[] = [
  {
    href: "/m",
    key: "nav.dashboard",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
    ),
  },
  {
    href: "/m/reports",
    key: "nav.reports",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  {
    href: "/m/trends",
    key: "nav.trends",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8" />
    ),
  },
  {
    href: "/m/flaky",
    key: "nav.flaky",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
  },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const isActive = (href: string) =>
    href === "/m" ? pathname === "/m" : pathname.startsWith(href);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* top bar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-surface-border bg-surface-panel/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div>
          <p className="text-base font-semibold text-white">QA Dashboard</p>
          <p className="text-[11px] text-gray-500">{t("app.subtitle")}</p>
        </div>
        <button
          onClick={handleSignOut}
          aria-label={t("app.signOut")}
          className="rounded-md p-2 text-gray-400 transition hover:bg-surface-hover hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* page content */}
      <main className="flex-1 px-4 py-4 pb-24">{children}</main>

      {/* bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-surface-border bg-surface-panel/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                active ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {tab.icon}
              </svg>
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
