"use client";

import { useI18n } from "@/components/I18nProvider";

// Temporary stand-in for mobile tabs that get their full screen in Phase 2.
export function MobilePlaceholder({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">{t(titleKey)}</h1>
      <div className="rounded-lg border border-dashed border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        Coming soon on mobile.
      </div>
    </div>
  );
}
