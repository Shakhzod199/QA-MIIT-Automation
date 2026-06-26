"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

const TABS = [
  { type: "frontend", key: "suite.frontend" },
  { type: "api", key: "suite.api" },
  { type: "load", key: "suite.load" },
] as const;

type SuiteType = (typeof TABS)[number]["type"];

/**
 * In-page tab bar mirroring the sidebar's Frontend/API/K6 sublinks
 * (components/SidebarNav.tsx TYPE_SUBLINKS) so switching test type doesn't
 * require going back to the sidebar.
 */
export function TypeTabs({ workflowId, active }: { workflowId: number; active: SuiteType }) {
  const { t } = useI18n();
  const router = useRouter();

  const go = (type: SuiteType) => {
    if (type === active) return;
    router.push(type === "frontend" ? `/suites/${workflowId}` : `/suites/${workflowId}?type=${type}`);
  };

  return (
    <div className="flex gap-1 border-b border-surface-border">
      {TABS.map((tab) => {
        const isActive = tab.type === active;
        return (
          <button
            key={tab.type}
            type="button"
            onClick={() => go(tab.type)}
            className={[
              "px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-b-2 border-indigo-500 text-white"
                : "border-b-2 border-transparent text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {t(tab.key)}
          </button>
        );
      })}
    </div>
  );
}
