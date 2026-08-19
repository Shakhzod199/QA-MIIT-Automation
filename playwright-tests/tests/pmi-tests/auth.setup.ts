import { test as setup } from "@playwright/test";
import { AUTH_FILE, login } from "./helpers";

// Runs once before the data-driven specs (wired as a project dependency in
// playwright.config.ts). Performing the UI login a single time and persisting
// the session removes the per-test login that hammered the shared account on
// the live server — the same pattern export and sez already use.
setup("Authenticate & save session", async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: AUTH_FILE });
});
