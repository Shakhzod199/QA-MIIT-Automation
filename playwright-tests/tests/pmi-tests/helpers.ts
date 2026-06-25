import { expect, type Page } from "@playwright/test";

// Normalize PMI_BASE_URL to a bare origin: strip a trailing slash and an
// optional trailing "/auth" so callers can append "/auth" exactly once. This
// keeps it working whether the env/CI value is "https://testpmi.miit.uz" or
// "https://testpmi.miit.uz/auth".
const RAW_BASE_URL = process.env.PMI_BASE_URL ?? "https://testpmi.miit.uz";
export const BASE_URL = RAW_BASE_URL.replace(/\/+$/, "").replace(/\/auth$/, "");

function requireCredential(name: "PMI_USERNAME" | "PMI_PASSWORD"): string {
  const value = process.env[name];
  if (!value || value === "example") {
    throw new Error(
      `${name} is not set. Provide real OneID credentials via the ${name} env var before running the PMI login test.`
    );
  }
  return value;
}

export const USERNAME = requireCredential("PMI_USERNAME");
export const PASSWORD = requireCredential("PMI_PASSWORD");

/**
 * The visible "Kirish" button no longer opens the credential modal on a
 * single click — like SEZ, it now needs 5 clicks within 5s to reveal it.
 */
async function openLoginModalViaSecretHatch(page: Page): Promise<void> {
  const hatch = page.getByRole("button", { name: "Kirish", exact: true });
  // testpmi.miit.uz can take 15-25s to render under load (see the pmi
  // project's timeout comment in playwright.config.ts) — the default 5s
  // visibility wait is too tight when several specs log in concurrently.
  await expect(hatch).toBeVisible({ timeout: 20000 });
  for (let i = 0; i < 5; i++) {
    await hatch.click({ force: true });
  }
}

/**
 * Logs in with OneID credentials and waits until the dashboard is loaded.
 * Mirrors the flow asserted in login.spec.ts so other specs can reuse it.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth`);

  await openLoginModalViaSecretHatch(page);

  const loginModal = page.locator(".n-card.n-modal");
  await expect(loginModal).toBeVisible();

  await loginModal.getByPlaceholder("Login").fill(USERNAME);
  await loginModal.getByPlaceholder("Parol").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
}
