import { expect, type Locator, type Page } from "@playwright/test";

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

/** How long the OneID button must be held before it reveals the modal. */
const HOLD_MS = 5000;

/**
 * The username/password login button is hidden on test/prod (only shown on
 * localhost or after OneID fails). It is unlocked by pressing and HOLDING the
 * OneID button: mousedown starts a 5s timer and, when it elapses, the button
 * emits `hold`, which opens the modal. mouseup, mouseleave and touchend all
 * cancel the timer, so the pointer has to stay put for the whole 5s.
 *
 * This replaced the old hatch (5 clicks on an invisible button[aria-hidden]
 * next to OneID), which stopped existing entirely — that button is no longer
 * in the DOM, so every pmt spec failed at login on "element(s) not found".
 *
 * Returns the opened modal so callers don't re-locate it.
 */
export async function openLoginModal(page: Page): Promise<Locator> {
  const oneId = page.getByRole("button", { name: /OneID/i });
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

/**
 * Logs in with username/password and waits until the dashboard is loaded.
 * Mirrors the flow asserted in login.spec.ts so other specs can reuse it.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);

  const loginModal = await openLoginModal(page);

  await loginModal.getByPlaceholder("Loginni kiriting").fill(USERNAME);
  await loginModal.getByPlaceholder("Parolni kiriting").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}
