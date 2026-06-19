import { test, expect, type Page } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

test.use({
  // Reuse the session captured once by auth.setup.ts instead of logging in per test.
  storageState: AUTH_FILE,
  // At 1280x720 the dashboard's floating stats card overlaps the filter toolbar
  // and intercepts clicks. The dashboard is desktop-only, so use a desktop size.
  viewport: { width: 1920, height: 1080 },
});

// The dashboard's stat cards/map widgets fetch and animate in, so the companies
// table isn't interactive immediately. Wait for its first real row first.
async function waitForTableReady(page: Page) {
  const table = page.locator(".n-data-table");
  await expect(table).toBeVisible();
  await expect(table.locator(".n-data-table-tbody .n-data-table-tr").first()).toBeVisible({ timeout: 15000 });
  return table;
}

test.describe("Dashboard filter - export.miit.uz", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
  });

  test("Search filter narrows the companies table and clearing restores it", async ({ page }) => {
    const table = await waitForTableReady(page);

    const initialRowCount = await table.locator(".n-data-table-tbody .n-data-table-tr").count();
    expect(initialRowCount).toBeGreaterThan(0);

    // exact: true avoids matching the table's separate per-column "Qidirish..." filter input.
    const searchInput = page.getByPlaceholder("Qidirish", { exact: true });
    await expect(searchInput).toBeVisible();

    // An unmatched term should filter the table down to an empty state.
    await searchInput.fill("zzz_no_such_company_zzz");
    await expect(table.locator(".n-data-table-empty")).toBeVisible({ timeout: 10000 });

    // Clearing the search should restore the original rows.
    await searchInput.fill("");
    await expect(table.locator(".n-data-table-tbody .n-data-table-tr").first()).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => table.locator(".n-data-table-tbody .n-data-table-tr").count(), { timeout: 10000 })
      .toBe(initialRowCount);
  });

  test("Drawer filter applies a tag and removing it clears the filter", async ({ page }) => {
    await waitForTableReady(page);

    // Open the advanced filter drawer via the toggle button inside the search box's suffix
    // (exact: true avoids matching the table's separate per-column "Qidirish..." filter input).
    const searchInput = page.getByPlaceholder("Qidirish", { exact: true });
    const drawerToggle = searchInput.locator("xpath=ancestor::*[contains(concat(' ', @class, ' '), ' n-input-wrapper ')][1]").locator(
      ".n-input__suffix button",
    );
    await drawerToggle.scrollIntoViewIfNeeded();
    await drawerToggle.click();

    const drawer = page.locator(".n-drawer");
    await expect(drawer).toBeVisible();

    // Filter by TIN, a plain text field in the drawer.
    await drawer.getByPlaceholder("STIR kiriting").fill("123456789");

    // Close the drawer.
    await drawer.getByRole("button", { name: "Yopish" }).click();
    await expect(drawer).toBeHidden();

    // A filter tag should now be visible for the applied TIN filter.
    const filterTag = page.locator(".n-tag", { hasText: "123456789" }).first();
    await expect(filterTag).toBeVisible({ timeout: 10000 });

    // Removing the tag should clear the filter.
    await filterTag.locator(".n-tag__close").click();
    await expect(filterTag).toBeHidden();
  });
});
