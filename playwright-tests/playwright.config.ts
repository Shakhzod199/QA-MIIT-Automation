import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// One project entry per product/team.
// Each entry points at its own testDir so the CLI output, HTML report, and
// --project filter all stay cleanly separated.
//
// To add a new project:
//   1. mkdir tests/<project-name>/
//   2. Copy an existing block below and change `name` and `testDir`
//   3. Override baseURL if the target runs on a different port
// ---------------------------------------------------------------------------
export default defineConfig({
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["json", { outputFile: "playwright-report/results.json" }], ["list"]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // ── auth setup ─────────────────────────────────────────────────────────
    // Logs in once and saves the session to playwright/.auth/user.json. Wired
    // as a dependency of "export" so it always runs first. Matched by filename
    // only, so it is not picked up as a normal test by the "export" project.
    {
      name: "setup",
      testDir: "./tests/export",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
      },
    },

    // ── new-export frontend ────────────────────────────────────────────────
    {
      name: "export",
      testDir: "./tests/export",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
      },
    },

    // ── add new projects below this line ──────────────────────────────────
    // {
    //   name: "billing",
    //   testDir: "./tests/billing",
    //   use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3002" },
    // },
  ],
});
