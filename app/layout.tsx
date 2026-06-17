import type { Metadata } from "next";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Dashboard",
  description: "Playwright suite runs for new-export, powered by GitHub Actions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
