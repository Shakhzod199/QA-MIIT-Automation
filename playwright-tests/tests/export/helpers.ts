import { expect, type Page } from "@playwright/test";

// Single source of truth for target + credentials. No credential lives in
// source: EXPORT_USERNAME / EXPORT_PASSWORD must come from the environment
// (locally via .env.local, in CI via GitHub Actions secrets).
function requireCredential(name: "EXPORT_USERNAME" | "EXPORT_PASSWORD"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Provide it via the ${name} env var (locally in .env.local, or as a GitHub Actions secret in CI) before running the export tests.`
    );
  }
  return value;
}

export const BASE_URL = process.env.BASE_URL ?? "https://export.miit.uz";
export const USERNAME = requireCredential("EXPORT_USERNAME");
export const PASSWORD = requireCredential("EXPORT_PASSWORD");

// Where auth.setup.ts caches the authenticated session. The data-driven specs
// reuse it via test.use({ storageState: AUTH_FILE }) instead of logging in again.
export const AUTH_FILE = "playwright/.auth/user.json";

// The OneID login page hides a 5-click trigger (#shaxzod_id) that opens a
// username/password modal. This mirrors the flow validated independently by
// login.spec.ts, and is the single login performed by auth.setup.ts.
export async function loginViaUi(page: Page) {
  await page.goto(`${BASE_URL}/login`);

  const trigger = page.locator("#shaxzod_id");
  await expect(trigger).toBeAttached();
  for (let i = 0; i < 5; i++) {
    await trigger.click();
  }

  const modal = page.locator(".n-card.n-modal");
  await expect(modal).toBeVisible();

  await modal.getByPlaceholder("Login").fill(USERNAME);
  await modal.getByPlaceholder("Parol").fill(PASSWORD);
  await modal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}
