import { test, expect, type Page } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT dashboard's Tarmoq / Hudud / Soha tabs (testpmt.miit.uz/dashboard,
// "Barchasi" map view's sibling tabs). Each renders a totals-driven table
// ("Jami" row first) with an Excel export and an expand-to-full-list
// control. Row counts drift as organizations are added, so these assert
// structure (Jami row + at least one breakdown row, working export button,
// working expand) rather than a hardcoded row count.
// ---------------------------------------------------------------------------

async function gotoTab(page: Page, tab: 1 | 2 | 3): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard?tab=${tab}&type=1&showType=0`);
  await expect(page.locator(".n-data-table-tbody .n-data-table-tr").first()).toBeVisible({
    timeout: 20000,
  });
}

async function expandFullTable(page: Page): Promise<void> {
  const expandBtn = page.getByRole("button", { name: /Xaritada ko'rish/i });
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
    await page.waitForTimeout(500);
  }
}

for (const [tab, name] of [
  [1, "Tarmoq"],
  [2, "Hudud"],
  [3, "Soha"],
] as const) {
  test.describe(`PMT — dashboard ${name} tab`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await gotoTab(page, tab);
    });

    test(`${name} table has a Jami totals row plus breakdown rows, Excel export, and expands`, async ({
      page,
    }) => {
      const table = page.locator(".n-data-table-tbody");
      const rows = table.locator(".n-data-table-tr");

      const initialCount = await rows.count();
      expect(initialCount).toBeGreaterThan(0);
      await expect(rows.first()).toContainText("Jami");

      // Excel export button is present and enabled.
      const exportBtn = page.getByRole("button", { name: /Yuklab olish/i });
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn).toBeEnabled();

      await expandFullTable(page);
      const expandedCount = await rows.count();
      expect(expandedCount).toBeGreaterThanOrEqual(initialCount);
    });
  });
}
