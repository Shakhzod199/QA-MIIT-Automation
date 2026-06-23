"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

const links = [
  { href: "/trends", key: "nav.dashboard" },
  { href: "/", key: "nav.testcases" },
  { href: "/reports", key: "nav.reports" },
  { href: "/flaky", key: "nav.flaky" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
              active ? "bg-surface-hover text-white" : "text-gray-400 hover:bg-surface-hover hover:text-white"
            }`}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
