import type { Metadata } from "next";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { I18nProvider } from "@/components/I18nProvider";
import { UserProvider } from "@/components/UserProvider";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Dashboard",
  description: "Playwright suite runs for new-export, powered by GitHub Actions",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <UserProvider user={user}>
          <I18nProvider>
            <ConditionalLayout>{children}</ConditionalLayout>
          </I18nProvider>
        </UserProvider>
      </body>
    </html>
  );
}
