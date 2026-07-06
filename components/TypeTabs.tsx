"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { suiteHasSecurityTests } from "@/lib/securitySuites";

const TABS = [
  { type: "frontend", key: "suite.frontend" },
  { type: "api", key: "suite.api" },
  { type: "load", key: "suite.load" },
  { type: "security", key: "suite.security" },
] as const;

type SuiteType = (typeof TABS)[number]["type"];

/**
 * In-page tab bar mirroring the sidebar's Frontend/API/K6 sublinks
 * (components/SidebarNav.tsx TYPE_SUBLINKS) so switching test type doesn't
 * require going back to the sidebar.
 */
export function TypeTabs({
  workflowId,
  active,
  workflowName,
}: {
  workflowId: number;
  active: SuiteType;
  /** Used only to decide whether the Security tab applies to this suite. */
  workflowName?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const go = (type: SuiteType) => {
    if (type === active) return;
    router.push(type === "frontend" ? `/suites/${workflowId}` : `/suites/${workflowId}?type=${type}`);
  };

  const tabs = TABS.filter((tab) => tab.type !== "security" || suiteHasSecurityTests(workflowName));

  return (
    <div className="flex gap-1 border-b border-surface-border">
      {tabs.map((tab) => {
        const isActive = tab.type === active;
        return (
          <button
            key={tab.type}
            type="button"
            onClick={() => go(tab.type)}
            className="px-4 py-2 text-[13px] font-medium transition"
            style={
              isActive
                ? { borderBottom: "2px solid #3ddc97", color: "#3ddc97", marginBottom: -1 }
                : { borderBottom: "2px solid transparent", color: "#8a93a0", marginBottom: -1 }
            }
          >
            {t(tab.key)}
          </button>
        );
      })}
    </div>
  );
}
