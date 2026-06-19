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
 * Logs in with OneID credentials and waits until the dashboard is loaded.
 * Mirrors the flow asserted in login.spec.ts so other specs can reuse it.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth`);

  // The credential modal is opened by the "Kirish" button, NOT the OneID one.
  await page.getByRole("button", { name: "Kirish", exact: true }).click();

  const loginModal = page.locator(".n-card.n-modal");
  await expect(loginModal).toBeVisible();

  await loginModal.getByPlaceholder("Login").fill(USERNAME);
  await loginModal.getByPlaceholder("Parol").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
}
