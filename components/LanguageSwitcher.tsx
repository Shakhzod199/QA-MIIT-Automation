"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { FlagRU, FlagUK, FlagUZ } from "@/components/flags";
import type { Locale } from "@/lib/i18n";

type Option = {
  code: Locale;
  label: string;
  Flag: (p: { className?: string }) => React.ReactElement;
};

const OPTIONS: Option[] = [
  { code: "en", label: "English", Flag: FlagUK },
  { code: "uz", label: "O‘zbekcha", Flag: FlagUZ },
  { code: "ru", label: "Русский", Flag: FlagRU },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.code === locale) ?? OPTIONS[0];
  const CurrentFlag = current.Flag;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition ${
          open
            ? "border-indigo-500/50 bg-surface-hover text-white"
            : "border-surface-border bg-surface-panel text-gray-200 hover:border-gray-600 hover:bg-surface-hover"
        }`}
      >
        <span className="overflow-hidden rounded-[4px] shadow-sm ring-1 ring-black/30">
          <CurrentFlag className="block h-4 w-6" />
        </span>
        <span className="flex-1 text-left font-medium">{current.label}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden rounded-lg border border-surface-border bg-surface-panel p-1 shadow-xl shadow-black/50"
        >
          {OPTIONS.map(({ code, label, Flag }) => {
            const active = locale === code;
            return (
              <button
                key={code}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                  active ? "bg-indigo-500/15 text-white" : "text-gray-300 hover:bg-surface-hover"
                }`}
              >
                <span className="overflow-hidden rounded-[4px] shadow-sm ring-1 ring-black/30">
                  <Flag className="block h-4 w-6" />
                </span>
                <span className="flex-1 text-left font-medium">{label}</span>
                {active && (
                  <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
