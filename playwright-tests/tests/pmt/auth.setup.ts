import { test as setup } from "@playwright/test";
import { AUTH_FILE, login } from "./helpers";

// Runs once before the data-driven specs (wired as a project dependency in
// playwright.config.ts). One UI login instead of 26 removes most of the load
// this suite put on testpmt.miit.uz — the same pattern export, sez and pmi use.
setup("Authenticate & save session", async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: AUTH_FILE });
});
