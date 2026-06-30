import { test, expect } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT monitoring page (testpmt.miit.uz/monitoring): user stats, the
// "Onlayn foydalanuvchilar" panel filtered by the Online/Offline/Barchasi
// select, and the "Kunlik jami" list whose rows drill into a per-user
// activity/login history panel.
// ---------------------------------------------------------------------------

test.describe("PMT — Monitoring", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/monitoring`);
    await expect(page.getByText("Foydalanuvchilar statistikasi")).toBeVisible({
      timeout: 20000,
    });
  });

  test("Shows Jami/Offline/Online stats and the online-users status filter", async ({
    page,
  }) => {
    await expect(page.getByText("Jami", { exact: true })).toBeVisible();
    await expect(page.getByText("Offline", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Online", { exact: true }).first()).toBeVisible();

    const statusSelect = page.locator(".n-select", { hasText: "Online" }).first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.click();

    const options = page.locator(".n-base-select-option");
    await expect(options.filter({ hasText: "Barchasi" })).toBeVisible();
    await expect(options.filter({ hasText: "Offline" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Clicking a user in Kunlik jami opens their login/activity history", async ({
    page,
  }) => {
    const dailyRow = page.locator(".n-data-table-tbody .n-data-table-tr").first();
    await expect(dailyRow).toBeVisible({ timeout: 20000 });
    // The user cell renders name and role/JSHSHIR in separate sibling spans;
    // read only the first span to avoid the role suffix being captured.
    const userName = (
      await dailyRow.locator("td").nth(1).locator("span").first().textContent()
    )?.trim();

    await dailyRow.click();

    // Drill-in view: back arrow, the selected user's name, a date filter,
    // and an activity table with Amal/Obyekt/IP manzil/Sana columns.
    await expect(page.getByText("Faoliyat tarixi")).toBeVisible({ timeout: 10000 });
    if (userName) {
      await expect(page.getByText(userName, { exact: false }).first()).toBeVisible();
    }
    await expect(page.getByText("Amal", { exact: true })).toBeVisible();
    await expect(page.getByText("IP manzil")).toBeVisible();
    await expect(page.getByText("Sana", { exact: true })).toBeVisible();
  });
});
