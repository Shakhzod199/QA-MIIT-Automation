import { test, expect } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT company-settings/enterprise-management: a list of metric rows (Foyda
// solig'i, Ish haqi solig'i, Umumiy soliqlar, Export-Import, Elektr
// energiya, Gaz, Suv, Bandlik), each with its own from-month/till-month/year
// filter and a "Ma'lumotlarni yangilash" refresh button.
// ---------------------------------------------------------------------------

test.describe("PMT — Korxona boshqaruvi (enterprise-management)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/company-settings/enterprise-management`);
    await expect(page.getByText("Foyda solig'i")).toBeVisible({ timeout: 20000 });
  });

  test("Each metric row has from/till month, year and Korxona turi filters", async ({
    page,
  }) => {
    const labels = [
      "Foyda solig'i",
      "Ish haqi solig'i",
      "Umumiy soliqlar",
      "Export-Import",
      "Elektr energiya",
      "Gaz",
      "Suv",
      "Bandlik",
    ];

    for (const label of labels) {
      const row = page.locator(".bg-white.rounded-xl.border.border-slate-200").filter({ hasText: label });
      await expect(row.locator(".n-select").first()).toBeVisible();
    }

    const refreshButtons = page.getByRole("button", { name: "Ma'lumotlarni yangilash" });
    await expect(refreshButtons).toHaveCount(labels.length);
  });

  test("Refresh re-renders a percentage value for the first metric row", async ({
    page,
  }) => {
    const firstRow = page
      .locator(".bg-white.rounded-xl.border.border-slate-200")
      .filter({ hasText: "Foyda solig'i" });
    const firstRefresh = firstRow.getByRole("button", {
      name: "Ma'lumotlarni yangilash",
    });

    // Refresh stays disabled until one of the row's filters (e.g. the
    // till-month select) is actually changed from its current value.
    await expect(firstRefresh).toBeDisabled();
    const tillMonthSelect = firstRow.locator(".n-select").first();
    const currentMonth = (await tillMonthSelect.textContent())?.trim();

    await tillMonthSelect.click();
    const options = page.locator(".n-base-select-option");
    await expect(options.first()).toBeVisible();
    const optionTexts = await options.allTextContents();
    const differentIndex = optionTexts.findIndex((text) => text.trim() !== currentMonth);
    await options.nth(differentIndex === -1 ? 0 : differentIndex).click();

    await expect(firstRefresh).toBeEnabled({ timeout: 10000 });

    await firstRefresh.click();

    const percentageBadge = firstRow.getByText(/^\d+([.,]\d+)?%$/).first();
    await expect(percentageBadge).toBeVisible({ timeout: 15000 });
  });
});
