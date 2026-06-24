"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import { CloseIcon } from "@/components/icons";

export function TestInfoModal({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-surface-border bg-surface-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">
              {t("testInfo.title")}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 rounded-md p-1 text-gray-500 transition hover:bg-surface-hover hover:text-gray-300"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-gray-300">{description}</p>
      </div>
    </div>
  );
}
