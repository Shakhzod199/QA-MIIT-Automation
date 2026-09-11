import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT company-settings/add-power ("Quvvat qo'shish"): pick a year, download
// the template, and upload a filled-in file before Saqlash is meaningful.
// We don't actually upload/save here to avoid mutating shared capacity data.
//
// The page now renders TWO of these cards stacked — "Quvvat" (year only) and
// a newer "Eksport" card (year + month) — each with its own identical
// Shablonni yuklash / Faylni tanlang / Saqlash row. An unscoped locator by
// role+name matches both and throws a strict-mode "resolved to 2 elements"
// error. Every locator below is scoped to the "Quvvat" card specifically,
// matching this file's stated scope; "Eksport" has no coverage yet.
// ---------------------------------------------------------------------------

/** The card whose header reads exactly `label` (e.g. "Quvvat", "Eksport"). */
function card(page: import("@playwright/test").Page, label: string) {
  return page
    .locator(".bg-white.rounded-xl.border.border-slate-200")
    .filter({ has: page.locator("span", { hasText: label }) })
    .first();
}

test.describe("PMT — Quvvat qo'shish (add-power)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/company-settings/add-power`);
    await expect(
      card(page, "Quvvat").getByRole("button", { name: "Shablonni yuklash" })
    ).toBeVisible({ timeout: 20000 });
  });

  test("Exposes a year select, template download, file picker and Saqlash", async ({
    page,
  }) => {
    const quvvat = card(page, "Quvvat");
    await expect(quvvat.locator(".n-select").filter({ hasText: "2026" })).toBeVisible();
    await expect(quvvat.getByRole("button", { name: "Shablonni yuklash" })).toBeVisible();
    await expect(quvvat.getByRole("button", { name: "Faylni tanlang" })).toBeVisible();
    await expect(quvvat.getByRole("button", { name: "Saqlash" })).toBeVisible();
  });

  test("Shablonni yuklash triggers a template download", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await card(page, "Quvvat").getByRole("button", { name: "Shablonni yuklash" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().length).toBeGreaterThan(0);
  });

  test("Saqlash is disabled until a file is chosen", async ({ page }) => {
    await expect(card(page, "Quvvat").getByRole("button", { name: "Saqlash" })).toBeDisabled();
  });
});
