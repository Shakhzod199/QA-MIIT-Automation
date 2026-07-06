"use client";

import { useI18n } from "@/components/I18nProvider";
import type { RunSummary } from "@/lib/types";

/** "Manual" (gray) vs "CI/CD" (purple) pill — same meaning everywhere on the dashboard. */
export function TriggerSourceBadge({ source, title }: { source: RunSummary["triggerSource"]; title?: string }) {
  const { t } = useI18n();
  if (source === "ci-cd") {
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
        style={{ background: "rgba(139,92,246,0.14)", color: "#8b5cf6" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" />
        {t("table.triggerCi")}
      </span>
    );
  }
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
      style={{ background: "rgba(91,99,110,0.2)", color: "#8a93a0" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#5b636e]" />
      {t("table.triggerManual")}
    </span>
  );
}
