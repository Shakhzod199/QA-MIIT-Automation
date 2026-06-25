import { test, expect, type Page, type Locator } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// SEZ — Iqtisodiy va sanoat zonalarini yaratish (required fields).
// Submits the create-zone form with all 7 required passport fields empty
// (Nomi, Viloyat, Tuman, Direksiya, Zonani tanlang, ixtisoslashuvi, MIZ va SZ
// turi) and confirms each shows its validation error and the form does not
// submit.
// ---------------------------------------------------------------------------

test.use({ storageState: AUTH_FILE });

/** The `.n-form-item` matched by its LABEL text. */
function formItem(page: Page, label: string): Locator {
  return page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: label }) })
    .first();
}

test.describe("SEZ — Iqtisodiy va sanoat zonalarini yaratish (required fields)", () => {
  test("blocks submission and shows validation errors when all 7 required fields are empty", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/admin/projects/industrial-zones`);
    await page.getByRole("button", { name: "Yaratish", exact: true }).click();
    await expect(page).toHaveURL(/\/industrial-zones\/create/, { timeout: 15000 });

    // Submit immediately with everything empty.
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();

    // "Zonani tanlang" (parent_id) has a distinct required message; the rest
    // share the generic "Bu maydon majburiy" text.
    const genericMessage = "Bu maydon majburiy";
    const parentMessage = "Bosh zonani tanlash majburiy";

    for (const label of [
      "Nomi",
      "Viloyat",
      "Tuman",
      "Direksiya",
      "Iqtisodiy va sanoat zonasi ixtisoslashuvi",
      "MIZ va SZ turi",
    ]) {
      await expect(formItem(page, label).locator(".n-form-item-feedback")).toContainText(
        genericMessage,
        { timeout: 10000 }
      );
    }
    await expect(formItem(page, "Zonani tanlang").locator(".n-form-item-feedback")).toContainText(
      parentMessage,
      { timeout: 10000 }
    );

    // Submission must not have navigated away from the create form.
    await expect(page).toHaveURL(/\/industrial-zones\/create/);
  });
});
