import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load credentials/config from the gitignored .env.local at the repo root
// (one level up from this playwright-tests dir) if it exists. CI can instead
// provide these as real environment variables / secrets.
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

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
    {
      name: "pmi",
      testDir: "./tests/pmi-tests",
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PMI_BASE_URL ?? "http://localhost:3000" },
    },

    // ── pmi backend (api smoke tests) ───────────────────────────────────────
    // No browser — uses Playwright's `request` fixture. Selected via the
    // "api" workflow_dispatch type.
    {
      name: "pmi-api",
      testDir: "./tests/pmi-api",
      use: { baseURL: process.env.PMI_BASE_URL ?? "http://localhost:3000" },
    },
    // {
    //   name: "billing",
    //   testDir: "./tests/billing",
    //   use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3002" },
    // },
  ],
});
