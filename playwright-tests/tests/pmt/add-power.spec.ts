import { test, expect } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT company-settings/add-power ("Quvvat qo'shish"): pick a year, download
// the template, and upload a filled-in file before Saqlash is meaningful.
// We don't actually upload/save here to avoid mutating shared capacity data.
// ---------------------------------------------------------------------------

test.describe("PMT — Quvvat qo'shish (add-power)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/company-settings/add-power`);
    await expect(page.getByRole("button", { name: "Shablonni yuklash" })).toBeVisible({
      timeout: 20000,
    });
  });

  test("Exposes a year select, template download, file picker and Saqlash", async ({
    page,
  }) => {
    await expect(page.locator(".n-select").filter({ hasText: "2026" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Shablonni yuklash" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Faylni tanlang" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Saqlash" })).toBeVisible();
  });

  test("Shablonni yuklash triggers a template download", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.getByRole("button", { name: "Shablonni yuklash" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().length).toBeGreaterThan(0);
  });

  test("Saqlash is disabled until a file is chosen", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Saqlash" })).toBeDisabled();
  });
});
