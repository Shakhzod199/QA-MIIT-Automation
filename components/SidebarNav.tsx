"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { useCurrentUser } from "@/components/UserProvider";
import type { FlakyResponse, WorkflowsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function NavDot({ active }: { active: boolean }) {
  return (
    <span
      className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
      style={active ? { background: "#3ddc97" } : { border: "1.5px solid #5b636e" }}
    />
  );
}

function NavItem({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[8px] px-[11px] py-[9px] text-[13px] font-medium transition"
      style={active ? { background: "rgba(61,220,151,0.12)", color: "#3ddc97" } : { color: "#8a93a0" }}
    >
      <span className="flex items-center gap-[11px]">
        <NavDot active={active} />
        {children}
      </span>
      {badge}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const user = useCurrentUser();
  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const { data: flakyData } = useSWR<FlakyResponse>("/api/flaky?limit=10", fetcher, {
    revalidateOnFocus: false,
  });

  const workflows = workflowsData?.workflows ?? [];
  const flakyCount = flakyData?.tests?.length ?? 0;

  const [testCasesOpen, setTestCasesOpen] = useState(
    pathname === "/" || pathname.startsWith("/suites")
  );

  const isDashboard = pathname === "/trends";
  const isTestCases = pathname === "/" || pathname.startsWith("/suites");
  const isReports = pathname.startsWith("/reports");
  const isFlaky = pathname === "/flaky";
  const isUsers = pathname.startsWith("/users");

  return (
    <nav className="flex flex-col gap-[2px] px-2">
      <NavItem href="/trends" active={isDashboard}>
        {t("nav.dashboard")}
      </NavItem>

      {/* Test Cases — collapsible */}
      <button
        type="button"
        onClick={() => setTestCasesOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-[8px] px-[11px] py-[9px] text-[13px] font-medium transition"
        style={isTestCases ? { background: "rgba(61,220,151,0.12)", color: "#3ddc97" } : { color: "#8a93a0" }}
      >
        <span className="flex items-center gap-[11px]">
          <NavDot active={isTestCases} />
          {t("nav.testcases")}
        </span>
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${testCasesOpen ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {testCasesOpen && (
        <div
          className="ml-[18px] flex flex-col gap-[2px] border-l pl-2"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <Link
            href="/"
            className="rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition"
            style={pathname === "/" ? { color: "#3ddc97" } : { color: "#5b636e" }}
          >
            {t("nav.allTestcases")}
          </Link>
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              href={`/suites/${wf.id}`}
              className="truncate rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition"
              style={pathname === `/suites/${wf.id}` ? { color: "#3ddc97" } : { color: "#5b636e" }}
            >
              {wf.name}
            </Link>
          ))}
        </div>
      )}

      <NavItem href="/reports" active={isReports}>
        {t("nav.reports")}
      </NavItem>

      <NavItem
        href="/flaky"
        active={isFlaky}
        badge={
          flakyCount > 0 ? (
            <span
              className="rounded-[20px] px-1.5 py-0.5 font-mono text-[10px] font-semibold"
              style={{ background: "rgba(245,181,68,0.16)", color: "#f5b544" }}
            >
              {flakyCount}
            </span>
          ) : undefined
        }
      >
        {t("nav.flaky")}
      </NavItem>

      {user?.role === "admin" && (
        <NavItem href="/users" active={isUsers}>
          {t("nav.users")}
        </NavItem>
      )}
    </nav>
  );
}
