"use client";

import { useI18n } from "@/components/I18nProvider";
import { FlagRU, FlagUK, FlagUZ } from "@/components/flags";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { code: Locale; label: string; Flag: (p: { className?: string }) => React.ReactElement }[] = [
  { code: "en", label: "English", Flag: FlagUK },
  { code: "uz", label: "O‘zbekcha", Flag: FlagUZ },
  { code: "ru", label: "Русский", Flag: FlagRU },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1.5">
      {OPTIONS.map(({ code, label, Flag }) => {
        const active = locale === code;
        return (
          <button
            key={code}
            onClick={() => setLocale(code)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`overflow-hidden rounded-[3px] ring-1 transition ${
              active
                ? "ring-indigo-400 opacity-100 scale-105"
                : "ring-surface-border opacity-50 hover:opacity-100"
            }`}
          >
            <Flag className="block h-5 w-8" />
          </button>
        );
      })}
    </div>
  );
}
