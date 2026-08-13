import { expect, type Locator, type Page } from "@playwright/test";

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

/** How long the OneID button must be held before it reveals the modal. */
const HOLD_MS = 5000;

/**
 * The username/password modal is hidden on the deployed login page — it only
 * offers OneID. It is unlocked by pressing and HOLDING the OneID button:
 * mousedown starts a 5s timer and, when it elapses, the button emits `hold`,
 * which opens the modal. mouseup, mouseleave and touchend all cancel the
 * timer, so the pointer has to stay put for the whole 5s.
 *
 * This replaced the old hatch (5 clicks on the hidden #shaxzod_id trigger).
 *
 * Returns the opened modal so callers don't re-locate it.
 */
export async function openLoginModal(page: Page): Promise<Locator> {
  const oneId = page.getByRole("button", { name: "OneID orqali kirish" });
  await expect(oneId).toBeVisible({ timeout: 20000 });

  const modal = page.locator(".n-card.n-modal");

  // Two attempts: a hold started before the page settles can be cancelled by
  // a layout shift sliding the button out from under the pointer, which fires
  // mouseleave and kills the timer.
  for (let attempt = 0; attempt < 2; attempt++) {
    await oneId.hover();
    await page.mouse.down();
    await page.waitForTimeout(HOLD_MS + 1000);
    // Releasing produces a click on the button, but the component swallows it
    // precisely because the hold fired — so this does not navigate to OneID.
    await page.mouse.up();

    const opened = await modal
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return modal;
  }

  await expect(modal, "the OneID press-and-hold did not reveal the login modal").toBeVisible();
  return modal;
}

// Mirrors the flow validated independently by login.spec.ts, and is the single
// login performed by auth.setup.ts.
export async function loginViaUi(page: Page) {
  await page.goto(`${BASE_URL}/login`);

  const modal = await openLoginModal(page);

  await modal.getByPlaceholder("Login").fill(USERNAME);
  await modal.getByPlaceholder("Parol").fill(PASSWORD);
  await modal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}
