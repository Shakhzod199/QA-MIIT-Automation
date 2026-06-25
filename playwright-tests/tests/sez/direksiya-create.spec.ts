import { test, expect, type Page, type Locator } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// SEZ — Direksiya CRUD (required fields).
// WORK IN PROGRESS: only covers the STIR auto-fill step so far. Entering a
// valid 9-digit STIR auto-fills the first 4 fields (Nomi, Viloyat, Tuman,
// Sektori) from the organization lookup. The remaining required fields for
// this form are still to be added.
// ---------------------------------------------------------------------------

test.use({ storageState: AUTH_FILE });

/** The `.n-form-item` matched by its LABEL text. */
function formItem(page: Page, label: string): Locator {
  return page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: label }) })
    .first();
}

test.describe("SEZ — Direksiya CRUD (required fields)", () => {
  test("STIR auto-fills Nomi, Viloyat, Tuman, and Sektori", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/admin/projects/directorates`);
    await page.getByRole("button", { name: "Yaratish", exact: true }).click();
    await expect(page).toHaveURL(/\/directorates\/form/, { timeout: 15000 });

    await formItem(page, "STIR").locator("input").first().fill("312685565");

    const nameInput = formItem(page, "Nomi").locator("input").first();
    const regionInput = formItem(page, "Viloyat").locator("input").first();
    const districtInput = formItem(page, "Tuman").locator("input").first();
    const sectorInput = formItem(page, "Sektori").locator("input").first();

    await expect(nameInput).not.toHaveValue("", { timeout: 10000 });
    await expect(regionInput).not.toHaveValue("", { timeout: 10000 });
    await expect(districtInput).not.toHaveValue("", { timeout: 10000 });
    await expect(sectorInput).not.toHaveValue("", { timeout: 10000 });
  });
});
