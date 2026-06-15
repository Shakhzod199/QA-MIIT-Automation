import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Dashboard",
  description: "Playwright suite runs for new-export, powered by GitHub Actions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-60 shrink-0 border-r border-surface-border bg-surface-panel p-6">
            <div className="mb-8">
              <h1 className="text-lg font-semibold text-white">QA Dashboard</h1>
              <p className="text-xs text-gray-500">new-export automation</p>
            </div>
            <nav className="space-y-1">
              <a
                href="/"
                className="block rounded-md bg-surface-hover px-3 py-2 text-sm font-medium text-white"
              >
                Dashboard
              </a>
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
