import { defineConfig, devices } from "@playwright/test";
// Keep the cached-session path in one place; tests/pmi-tests/helpers.ts
// exports the same constant for auth.setup.ts to write to.
const PMI_AUTH_FILE = "playwright/.auth/pmi-user.json";
const PMT_AUTH_FILE = "playwright/.auth/pmt-user.json";
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
  // CI has always retried; locally a single slow response from the shared test
  // servers used to fail the whole run. One local retry absorbs that — flaky
  // tests are still reported as "flaky", so a genuine regression is not hidden.
  retries: process.env.CI ? 2 : 1,
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

    // ── QA Dashboard security (auth/authz/session of THIS app) ────────────
    // Disabled for now — not needed yet. The spec itself (tests/security/
    // authz.spec.ts) is left in place; uncomment this block to reactivate.
    // No browser — pure API-level checks via the `request` fixture against a
    // running instance of the dashboard itself. Needs SECURITY_ADMIN_USER /
    // SECURITY_ADMIN_PASS (an existing admin) to provision role fixtures; the
    // spec self-skips if they're absent. Point SECURITY_BASE_URL at the
    // running app (defaults to the local prod server on :3417).
    // {
    //   name: "security",
    //   testDir: "./tests/security",
    //   use: { baseURL: process.env.SECURITY_BASE_URL ?? "http://localhost:3417" },
    // },

    // ── add new projects below this line ──────────────────────────────────
    // SEZ's account appears to be single-session: even just *reusing* one
    // cached login from two contexts at once (not only fresh UI logins) can
    // knock one of them back to the login page. So every sez-* project below
    // is chained via "dependencies" into one strictly serial pipeline —
    // login.spec.ts's fresh logins finish first, then sez-setup caches the
    // final session, then columns and filter each get that session to
    // themselves, one project at a time.
    {
      name: "sez-login",
      testDir: "./tests/sez",
      testMatch: /login\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },

    {
      name: "sez-setup",
      testDir: "./tests/sez",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["sez-login"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },

    {
      name: "sez-columns",
      testDir: "./tests/sez",
      testMatch: /columns\.spec\.ts/,
      dependencies: ["sez-setup"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },

    {
      name: "sez-filter",
      testDir: "./tests/sez",
      testMatch: /filter\.spec\.ts/,
      dependencies: ["sez-columns"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },

    {
      name: "sez-create-zone",
      testDir: "./tests/sez",
      testMatch: /create-zone\.spec\.ts/,
      dependencies: ["sez-filter"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },
    {
      name: "sez-create-zone-required-fields",
      testDir: "./tests/sez",
      testMatch: /create-zone-required-fields\.spec\.ts/,
      dependencies: ["sez-create-zone"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },
    {
      name: "sez-invest-project",
      testDir: "./tests/sez",
      testMatch: /invest-project\.spec\.ts/,
      dependencies: ["sez-create-zone-required-fields"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },
    {
      name: "sez-direksiya-create",
      testDir: "./tests/sez",
      testMatch: /direksiya-create\.spec\.ts/,
      dependencies: ["sez-invest-project"],
      use: { ...devices["Desktop Chrome"], baseURL: process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz" },
    },

    // testpmi.miit.uz responds noticeably slower from CI's network path than
    // from a local machine (backend dropdown options / navigation can take
    // 15-25s instead of <5s) — give every pmi test that headroom by default
    // instead of relying on test.setTimeout in each file.
    // pmi is split three ways so the suite logs in ONCE instead of once per
    // test. login.spec.ts must keep doing real UI logins (that is its subject),
    // so it runs first in its own project without a cached session; pmi-setup
    // then caches one session and every other spec reuses it. Running
    // --project=pmi pulls both dependencies in automatically.
    {
      name: "pmi-login",
      testDir: "./tests/pmi-tests",
      testMatch: /login\.spec\.ts/,
      timeout: 60000,
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PMI_BASE_URL ?? "http://localhost:3000" },
    },

    {
      name: "pmi-setup",
      testDir: "./tests/pmi-tests",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["pmi-login"],
      timeout: 60000,
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PMI_BASE_URL ?? "http://localhost:3000" },
    },

    {
      name: "pmi",
      testDir: "./tests/pmi-tests",
      testIgnore: [/login\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ["pmi-setup"],
      timeout: 60000,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PMI_BASE_URL ?? "http://localhost:3000",
        storageState: PMI_AUTH_FILE,
      },
    },

    // ── pmt frontend ─────────────────────────────────────────────────────────
    // testpmt.miit.uz can't handle many concurrent logins — run with
    // --workers=2 to avoid parallel login failures. 60s timeout matches pmi.
    // Split three ways for the same reason as pmi: one login for the whole
    // suite instead of 26. login.spec.ts keeps doing real UI logins (that is
    // its subject) and runs first without a cached session; pmt-setup then
    // caches one session for everything else. --project=pmt pulls both
    // dependencies in automatically, so CI needs no change.
    {
      name: "pmt-login",
      testDir: "./tests/pmt",
      testMatch: /login\.spec\.ts/,
      timeout: 60000,
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PMT_BASE_URL ?? "http://localhost:3000" },
    },

    {
      name: "pmt-setup",
      testDir: "./tests/pmt",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["pmt-login"],
      timeout: 60000,
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PMT_BASE_URL ?? "http://localhost:3000" },
    },

    {
      name: "pmt",
      testDir: "./tests/pmt",
      testIgnore: [/login\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ["pmt-setup"],
      timeout: 60000,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PMT_BASE_URL ?? "http://localhost:3000",
        storageState: PMT_AUTH_FILE,
      },
    },

    // ── pmi backend (api tests against the real Swagger-documented API) ────
    // No browser — uses Playwright's `request` fixture. Selected via the
    // "api" workflow_dispatch type.
    {
      name: "pmi-api",
      testDir: "./tests/pmi-api",
      use: { baseURL: process.env.PMI_API_BASE_URL ?? "https://apiproject.miit.uz" },
    },

    // ── PMT backend (api tests driven from the Postman collection) ───────────
    // No browser — uses Playwright's `request` fixture. Cookie-based auth:
    // POST /auth/login sets the accessToken httpOnly cookie, which the context
    // carries automatically for all subsequent calls.
    {
      name: "pmt-api",
      testDir: "./tests/pmt-api",
      use: { baseURL: process.env.PMT_API_BASE_URL ?? "https://testpmt.miit.uz/api" },
    },

    // ── export backend (api tests against the real Swagger-documented API) ──
    // No browser — uses Playwright's `request` fixture. Selected via the
    // "api" workflow_dispatch type.
    {
      name: "export-api",
      testDir: "./tests/export-api",
      use: { baseURL: process.env.BASE_URL ?? "https://export.miit.uz" },
    },

    // ── export backend security (role boundaries, read-only) ───────────────
    // No browser — pure API-level checks via the `request` fixture. Needs
    // EXPORT_VIEWER_USERNAME / EXPORT_VIEWER_PASSWORD (a pre-existing,
    // restricted-role account) to run; the spec self-skips if they're absent.
    // Deliberately read-only — see role-boundaries.spec.ts header comment.
    {
      name: "export-api-security",
      testDir: "./tests/export-api-security",
      use: { baseURL: process.env.BASE_URL ?? "https://export.miit.uz" },
    },
    // {
    //   name: "billing",
    //   testDir: "./tests/billing",
    //   use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3002" },
    // },
  ],
});
