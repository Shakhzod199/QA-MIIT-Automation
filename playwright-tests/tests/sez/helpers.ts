import { expect, type Page } from "@playwright/test";

// Normalize SEZ_BASE_URL to a bare origin: strip a trailing slash and an
// optional trailing "/login" so callers can append "/login" exactly once.
const RAW_BASE_URL = process.env.SEZ_BASE_URL ?? "https://testsez2.miit.uz";
export const BASE_URL = RAW_BASE_URL.replace(/\/+$/, "").replace(/\/login$/, "");

function requireCredential(name: "SEZ_USERNAME" | "SEZ_PASSWORD"): string {
  const value = process.env[name];
  if (!value || value === "example") {
    throw new Error(
      `${name} is not set. Provide real credentials via the ${name} env var before running the SEZ login test.`
    );
  }
  return value;
}

export const USERNAME = requireCredential("SEZ_USERNAME");
export const PASSWORD = requireCredential("SEZ_PASSWORD");

// Where auth.setup.ts caches the authenticated session. The data-driven specs
// (columns/filter) reuse it via test.use({ storageState: AUTH_FILE }) instead
// of logging in again — the SEZ backend appears to invalidate a session when
// the same account logs in concurrently elsewhere, which made every spec
// calling login() in its own beforeEach flaky under parallel workers.
export const AUTH_FILE = "playwright/.auth/sez-user.json";

/**
 * The email/password login button is hidden on test/prod (only shown on
 * localhost or after OneID fails). An invisible button next to the OneID
 * button opens the login modal directly when clicked 5 times within 5s.
 */
async function openLoginModalViaSecretHatch(page: Page): Promise<void> {
  const hatch = page.locator('button[aria-hidden="true"]');
  // testsez2.miit.uz can render slowly under load — the default 5s wait is
  // too tight (mirrors the same fix in tests/pmi-tests/helpers.ts).
  await expect(hatch).toBeAttached({ timeout: 20000 });
  for (let i = 0; i < 5; i++) {
    await hatch.click({ force: true });
  }
}

/**
 * Logs in with email/password and waits until the dashboard is loaded.
 * Mirrors the flow asserted in login.spec.ts so other specs can reuse it.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);

  await openLoginModalViaSecretHatch(page);

  const loginModal = page.locator(".n-card.n-modal");
  await expect(loginModal).toBeVisible();

  await loginModal.getByPlaceholder("Email").fill(USERNAME);
  await loginModal.getByPlaceholder("Parol").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(`${BASE_URL}/dashboard/`, { timeout: 15000 });
}
