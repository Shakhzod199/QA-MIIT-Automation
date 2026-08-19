import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("explore PMT navigation after login", async ({ page }) => {
  // Uses the shared login() so the press-and-hold flow lives in exactly one
  // place — this spec previously inlined its own copy of the (now removed)
  // 5-click hatch and was the last thing still referencing it.
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  await page.waitForTimeout(2000);

  const links = await page.locator("a[href]").evaluateAll((els) =>
    els.map((e) => ({ href: (e as HTMLAnchorElement).getAttribute("href"), text: e.textContent?.trim() }))
  );
  const unique = Array.from(new Set(links.map((l) => JSON.stringify(l))));
  console.log("=== NAV LINKS ===");
  console.log(unique.join("\n"));
  console.log("=== CURRENT URL ===", page.url());
  await page.screenshot({ path: "/tmp/pmt_dashboard.png", fullPage: true });
});
