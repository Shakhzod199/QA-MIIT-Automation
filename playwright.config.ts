import { defineConfig, devices } from "@playwright/test";

/**
 * BASE_URL points at the new-export frontend under test.
 * Locally this is the Vite dev server (`pnpm dev` -> :3001 in new-export-main).
 * In CI this defaults to the same value as a placeholder until a real
 * staging/preview target is wired up.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["json", { outputFile: "playwright-report/results.json" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
