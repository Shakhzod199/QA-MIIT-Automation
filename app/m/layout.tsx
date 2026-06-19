import type { Metadata, Viewport } from "next";
import { MobileShell } from "@/components/mobile/MobileShell";

// Mobile-only metadata. The apple* fields + theme-color are what make the
// installed PWA feel native (standalone window, dark status bar, home icon).
export const metadata: Metadata = {
  title: "QA Mobile",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QA Dashboard",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // Let content extend under the notch/home indicator; we pad with safe-area.
  viewportFit: "cover",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell>{children}</MobileShell>;
}
