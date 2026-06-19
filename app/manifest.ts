import type { MetadataRoute } from "next";

// Served by Next at /manifest.webmanifest. Scoped to /m so installing the PWA
// ("Add to Home Screen") launches straight into the mobile app shell.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QA Dashboard",
    short_name: "QA",
    description: "MIIT Playwright test suite runs, powered by GitHub Actions",
    start_url: "/m",
    scope: "/m",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Maskable lets Android crop the icon into its adaptive shape cleanly.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
