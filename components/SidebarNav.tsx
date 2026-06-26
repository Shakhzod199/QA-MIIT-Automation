"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import type { WorkflowsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TOP_LINKS = [{ href: "/trends", key: "nav.dashboard" }];
const BOTTOM_LINKS = [
  { href: "/reports", key: "nav.reports" },
  { href: "/flaky", key: "nav.flaky" },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const workflows = data?.workflows ?? [];

  const [testCasesOpen, setTestCasesOpen] = useState(pathname.startsWith("/suites") || pathname === "/");

  const baseItemClass = (active: boolean) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition ${
      active ? "bg-surface-hover text-white" : "text-gray-400 hover:bg-surface-hover hover:text-white"
    }`;

  return (
    <nav className="space-y-1">
      {TOP_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={baseItemClass(pathname === link.href)}>
          {t(link.key)}
        </Link>
      ))}

      {/* Test cases — expands to the project list. Frontend/API/K6 selection
          happens via tabs on each project's own page, not here. */}
      <button
        type="button"
        onClick={() => setTestCasesOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
          pathname === "/" || pathname.startsWith("/suites")
            ? "bg-surface-hover text-white"
            : "text-gray-400 hover:bg-surface-hover hover:text-white"
        }`}
      >
        <span>{t("nav.testcases")}</span>
        <Chevron open={testCasesOpen} />
      </button>

      {testCasesOpen && (
        <div className="ml-2 space-y-1 border-l border-surface-border pl-2">
          <Link href="/" className={baseItemClass(pathname === "/")}>
            {t("nav.allTestcases")}
          </Link>

          {workflows.map((workflow) => (
            <Link
              key={workflow.id}
              href={`/suites/${workflow.id}`}
              className={`${baseItemClass(pathname === `/suites/${workflow.id}`)} truncate`}
            >
              {workflow.name}
            </Link>
          ))}
        </div>
      )}

      {BOTTOM_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={baseItemClass(pathname === link.href)}>
          {t(link.key)}
        </Link>
      ))}
    </nav>
  );
}
