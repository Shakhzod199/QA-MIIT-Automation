import { test as setup } from "@playwright/test";
import { AUTH_FILE, loginViaUi } from "./helpers";

// Runs once before the data-driven specs (wired as a project dependency in
// playwright.config.ts). Performing the UI login a single time and persisting
// the session removes the per-test login that previously raced the shared
// account on the live server — which is why those specs no longer need serial
// mode and can run in parallel again.
setup("authenticate", async ({ page }) => {
  await loginViaUi(page);
  await page.context().storageState({ path: AUTH_FILE });
});
