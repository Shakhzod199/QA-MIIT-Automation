"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  // The mobile PWA (/m/*) and the login page provide their own chrome, so skip
  // the desktop sidebar shell for them.
  if (pathname === "/login" || pathname === "/m" || pathname.startsWith("/m/")) {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-surface-border bg-surface-panel p-6">
        <div className="mb-8">
          <Link href="/trends" className="text-lg font-semibold text-white transition hover:text-indigo-300">
            QA Dashboard
          </Link>
          <p className="text-xs text-gray-500">{t("app.subtitle")}</p>
        </div>

        <SidebarNav />

        <div className="mt-auto space-y-3 border-t border-surface-border pt-4">
          <div className="px-1">
            <LanguageSwitcher />
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-surface-hover hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t("app.signOut")}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
