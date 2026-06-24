import { expect, type Page } from "@playwright/test";

// Normalize PMT_BASE_URL to a bare origin: strip a trailing slash and an
// optional trailing "/login" so callers can append "/login" exactly once.
const RAW_BASE_URL = process.env.PMT_BASE_URL ?? "https://testpmt.miit.uz";
export const BASE_URL = RAW_BASE_URL.replace(/\/+$/, "").replace(/\/login$/, "");

function requireCredential(name: "PMT_USERNAME" | "PMT_PASSWORD"): string {
  const value = process.env[name];
  if (!value || value === "example") {
    throw new Error(
      `${name} is not set. Provide real credentials via the ${name} env var before running the PMT login test.`
    );
  }
  return value;
}

export const USERNAME = requireCredential("PMT_USERNAME");
export const PASSWORD = requireCredential("PMT_PASSWORD");

/**
 * The username/password login button is hidden on test/prod (only shown on
 * localhost or after OneID fails). An invisible button next to the OneID
 * button opens the login modal directly when clicked 5 times within 5s.
 */
async function openLoginModalViaSecretHatch(page: Page): Promise<void> {
  const hatch = page.locator('button[aria-hidden="true"]');
  await expect(hatch).toBeAttached();
  for (let i = 0; i < 5; i++) {
    await hatch.click({ force: true });
  }
}

/**
 * Logs in with username/password and waits until the dashboard is loaded.
 * Mirrors the flow asserted in login.spec.ts so other specs can reuse it.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);

  await openLoginModalViaSecretHatch(page);

  const loginModal = page.locator(".n-card.n-modal");
  await expect(loginModal).toBeVisible();

  await loginModal.getByPlaceholder("Loginni kiriting").fill(USERNAME);
  await loginModal.getByPlaceholder("Parolni kiriting").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}
