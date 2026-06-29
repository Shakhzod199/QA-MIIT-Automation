import { test, expect } from "@playwright/test";

const BASE_URL = "https://testpmt.miit.uz";
const USERNAME = process.env.PMT_USERNAME!;
const PASSWORD = process.env.PMT_PASSWORD!;

test("explore PMT navigation after login", async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  const hatch = page.locator('button[aria-hidden="true"]');
  await expect(hatch).toBeAttached();
  for (let i = 0; i < 5; i++) await hatch.click({ force: true });

  const loginModal = page.locator(".n-card.n-modal");
  await expect(loginModal).toBeVisible();
  await loginModal.getByPlaceholder("Loginni kiriting").fill(USERNAME);
  await loginModal.getByPlaceholder("Parolni kiriting").fill(PASSWORD);
  await loginModal.getByRole("button", { name: "Kirish", exact: true }).click();
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
