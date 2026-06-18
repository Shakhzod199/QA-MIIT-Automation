import { test, expect, type Page } from "@playwright/test";

const URL = "https://export.miit.uz";
const USERNAME = process.env.TEST_USERNAME ?? "admin";
const PASSWORD = process.env.TEST_PASSWORD ?? "newexport26";

// At the default 1280x720 viewport, the dashboard's floating stats card overlaps the filter
// toolbar and intercepts clicks. The dashboard is desktop-only, so test at a standard desktop size.
test.use({ viewport: { width: 1920, height: 1080 } });

// Filters live on the dashboard, which requires an authenticated session.
// This mirrors the login steps from login.spec.ts so this spec can run on its
// own; login.spec.ts must still pass for the app's login flow to be valid.
async function login(page: Page) {
  await page.goto(`${URL}/login`);

  const trigger = page.locator("#shaxzod_id");
  await expect(trigger).toBeAttached();
  for (let i = 0; i < 5; i++) {
    await trigger.click();
  }

  const modal = page.locator(".n-card.n-modal");
  await expect(modal).toBeVisible();

  await modal.getByPlaceholder("Login").fill(USERNAME);
  await modal.getByPlaceholder("Parol").fill(PASSWORD);
  await modal.getByRole("button", { name: "Kirish", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

// The dashboard's stat cards/map widgets fetch and animate in after the URL
// changes, so the companies table isn't interactive immediately after login.
// Wait for its first real row before touching any filter control.
async function waitForTableReady(page: Page) {
  const table = page.locator(".n-data-table");
  await expect(table).toBeVisible();
  await expect(table.locator(".n-data-table-tbody .n-data-table-tr").first()).toBeVisible({ timeout: 15000 });
  return table;
}

test.describe("Dashboard filter - export.miit.uz", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("search filter narrows the companies table and clearing restores it", async ({ page }) => {
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

  test("drawer filter applies a tag and removing it clears the filter", async ({ page }) => {
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
