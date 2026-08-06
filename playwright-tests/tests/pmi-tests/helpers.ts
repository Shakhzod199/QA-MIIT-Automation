import { expect, type Locator, type Page } from "@playwright/test";

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

/** How long the OneID button must be held before it reveals the modal. */
const HOLD_MS = 5000;

/**
 * The credential modal is hidden on test/prod — the page offers only OneID,
 * and the "Kirish" button next to it renders at opacity-0 and does nothing
 * until the form is unlocked. It is unlocked by pressing and HOLDING the
 * OneID button: mousedown starts a 5s timer and, when it elapses, the button
 * emits `hold`, which both unlocks Kirish and opens the modal. mouseup,
 * mouseleave and touchend all cancel the timer, so the pointer has to stay
 * put for the whole 5s.
 *
 * This replaced the old hatch (5 rapid clicks on the hidden Kirish button),
 * which silently stopped opening anything — every pmi spec failed on the
 * modal never appearing.
 *
 * Returns the opened modal so callers don't re-locate it.
 */
export async function openLoginModal(page: Page): Promise<Locator> {
  const oneId = page.getByRole("button", { name: "OneID orqali kirish" });
  // testpmi.miit.uz can take 15-25s to render under load (see the pmi
  // project's timeout comment in playwright.config.ts) — the default 5s
  // visibility wait is too tight when several specs log in concurrently.
  await expect(oneId).toBeVisible({ timeout: 20000 });

  const modal = page.locator(".n-card.n-modal");

  // Two attempts: a hold started before the hero section settles can be
  // cancelled by a layout shift sliding the button out from under the
  // pointer, which fires mouseleave and kills the timer.
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
 * Logs in with OneID credentials and waits until the dashboard is loaded.
 * Mirrors the flow asserted in login.spec.ts so other specs can reuse it.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth`);

  const loginModal = await openLoginModal(page);

  await loginModal.getByPlaceholder("Login").fill(USERNAME);
  await loginModal.getByPlaceholder("Parol").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
}
