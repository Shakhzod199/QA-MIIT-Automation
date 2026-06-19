import type { Metadata } from "next";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { I18nProvider } from "@/components/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Dashboard",
  description: "Playwright suite runs for new-export, powered by GitHub Actions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </I18nProvider>
      </body>
    </html>
  );
}
