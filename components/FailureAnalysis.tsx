"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18n";
import type { FailureAnalysis, FailureOwner } from "@/lib/types";

/**
 * Renders the owner tag, the plain-language cause, and — for everything except
 * infra — a copy-ready message for whoever needs to act. Deliberately shown
 * above the existing "What went wrong (technical)" block: the stakeholder
 * reading this page wants the verdict, not the stack trace.
 */

const OWNER_STYLES: Record<FailureOwner, string> = {
  backend: "bg-red-500/15 text-red-300 ring-red-500/30",
  frontend: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  test: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  infra: "bg-gray-500/15 text-gray-400 ring-gray-500/30",
};

/**
 * The owner tag on its own, for the collapsed test row — the whole point is to
 * see who owns a failure without opening anything.
 */
export function OwnerChip({ owner }: { owner: FailureOwner }) {
  const { t } = useI18n();
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${OWNER_STYLES[owner]}`}
    >
      {t(`analysis.owner.${owner}`)}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard is unavailable over plain http or without permission —
          // the message is still selectable, so fail quietly.
        }
      }}
      className="shrink-0 rounded-md border border-surface-border px-2 py-1 text-xs text-gray-400 transition hover:bg-surface-hover hover:text-gray-200 active:scale-95"
    >
      {copied ? t("analysis.copied") : t("analysis.copy")}
    </button>
  );
}

export default function FailureAnalysisPanel({
  analysis,
  locale,
}: {
  analysis: FailureAnalysis;
  locale: Locale;
}) {
  const { t } = useI18n();
  const isInfra = analysis.owner === "infra";

  return (
    <div className="mt-2 rounded-lg border border-surface-border bg-surface-hover/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${OWNER_STYLES[analysis.owner]}`}
        >
          {t(`analysis.owner.${analysis.owner}`)}
        </span>
        {/* Only surface confidence when it's a caveat — "high" is the norm and
            labelling it adds noise to every row. */}
        {analysis.confidence !== "high" && (
          <span className="text-xs text-gray-500">{t(`analysis.confidence.${analysis.confidence}`)}</span>
        )}
        {/* Say plainly when a verdict came from keyword rules rather than a
            real reading of the evidence — a template shouldn't be mistaken
            for a diagnosis. */}
        {analysis.source === "rules" && (
          <span
            className="text-xs text-gray-600"
            title={t("analysis.ruleBasedHint")}
          >
            · {t("analysis.ruleBased")}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-gray-200">{analysis.cause[locale]}</p>

      {isInfra ? (
        <p className="mt-2 text-xs text-gray-500">{t("analysis.infraHint")}</p>
      ) : (
        analysis.messageUz && (
          <details className="mt-2.5">
            <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-200">
              {analysis.owner === "test" ? t("analysis.messageToQa") : t("analysis.messageToDev")}
            </summary>
            <div className="mt-2 flex items-start gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-md bg-surface-panel px-3 py-2 text-sm leading-relaxed text-gray-200">
                {analysis.messageUz}
              </p>
              <CopyButton text={analysis.messageUz} />
            </div>
          </details>
        )
      )}
    </div>
  );
}
