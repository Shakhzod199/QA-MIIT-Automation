"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-surface-border bg-surface-panel p-6">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-white">QA Dashboard</h1>
          <p className="text-xs text-gray-500">new-export automation</p>
        </div>
        <SidebarNav />
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
