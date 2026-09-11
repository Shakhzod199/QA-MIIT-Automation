import { test, expect } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

test.use({
  // Reuse the session captured once by auth.setup.ts instead of logging in per test.
  storageState: AUTH_FILE,
  // At 1280x720 the dashboard's floating stats card overlaps the toolbar and
  // intercepts clicks. The dashboard is desktop-only, so use a desktop size.
  viewport: { width: 1920, height: 1080 },
});

// ---------------------------------------------------------------------------
// Export dashboard "Ustunlar" (columns) panel (export.miit.uz/dashboard).
// Toggling "Barchasini tanlash" should check every hideable column, add them
// all as table headers, and each applied column should actually carry data
// across the visible rows — not just render as an empty header.
// ---------------------------------------------------------------------------

/**
 * Columns that render a boolean flag as an icon (no text) rather than a
 * value — checked separately below because the flag is real but SPARSE
 * (Muammolar ~4.5% of ~6,400 companies, Chat xabarlari ~11%), so asserting
 * against whichever 10 rows the default view happens to load would pass or
 * fail depending on luck, not on whether the column works. Confirmed against
 * the live API: both flags exist on real rows, and each has its own "exists"
 * option in the drawer filter, which is used to guarantee flagged rows are
 * on screen before checking for the icon.
 */
const ICON_FLAG_COLUMNS: { label: string; filterOptionText: string }[] = [
  { label: "Muammolar", filterOptionText: "Muammo mavjud" },
  { label: "Chat xabarlari", filterOptionText: "Chat xabari mavjud" },
];

test.describe("Export — dashboard Ustunlar (columns)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    const table = page.locator(".n-data-table").first();
    await expect(table).toBeVisible({ timeout: 20000 });
    await expect(
      table.locator(".n-data-table-tbody .n-data-table-tr").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Barchasini tanlash checks every column and each applied column has data in the table", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.getByRole("button", { name: /Ustunlar/i }).click();
    const panel = page.locator(".column-toggle-wrapper");
    await expect(panel).toBeVisible();

    // Drive "Barchasini tanlash" to checked regardless of its starting
    // state, so the test doesn't depend on a previous run's leftover state.
    const allCheckbox = page.getByRole("checkbox", { name: "Barchasini tanlash" });
    await expect(allCheckbox).toBeVisible();
    if ((await allCheckbox.getAttribute("aria-checked")) !== "true") {
      await allCheckbox.click();
    }
    await expect(allCheckbox).toHaveAttribute("aria-checked", "true");

    // Every individual column checkbox in the panel should now be checked too.
    const checkboxes = panel.locator('[role="checkbox"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(1);
    for (let i = 0; i < checkboxCount; i++) {
      await expect(checkboxes.nth(i)).toHaveAttribute("aria-checked", "true");
    }

    // Close the panel and let the table re-render with the new columns.
    await page.getByRole("button", { name: /Ustunlar/i }).click();
    await expect(panel).toBeHidden();

    // The real column headers are the thead's first row (a second row holds
    // per-column summary values, not column titles), and line up 1:1 with
    // each data row's cells.
    const readGrid = () =>
      page.evaluate(() => {
        const headerRow = document.querySelector(
          ".n-data-table-thead .n-data-table-tr"
        );
        const headers = Array.from(
          headerRow?.querySelectorAll(".n-data-table-th") ?? []
        ).map((th) => (th.textContent ?? "").trim());
        const rows = Array.from(
          document.querySelectorAll(".n-data-table-tbody .n-data-table-tr")
        );
        const cells = rows.map((row) =>
          Array.from(row.querySelectorAll(".n-data-table-td")).map((td) => ({
            text: (td.textContent ?? "").trim(),
            hasButton: !!td.querySelector("button"),
            hasIcon: !!td.querySelector("svg"),
          }))
        );
        return { headers, cells };
      });

    const grid = await readGrid();
    const iconFlagLabels = new Set(ICON_FLAG_COLUMNS.map((c) => c.label));

    expect(grid.headers.length).toBeGreaterThan(10); // every hideable column applied
    expect(grid.cells.length).toBeGreaterThan(0);

    for (let col = 0; col < grid.headers.length; col++) {
      const label = grid.headers[col];

      if (label === "Amallar") {
        // Row actions render icon buttons, not text.
        const hasButton = grid.cells.some((row) => row[col]?.hasButton);
        expect(hasButton, `"${label}" column should render action buttons`).toBe(
          true
        );
        continue;
      }

      if (iconFlagLabels.has(label)) {
        continue; // checked below via a dedicated filter — see ICON_FLAG_COLUMNS
      }

      // Individual cells can legitimately be blank for a given company, so
      // require a value in at least one visible row rather than every row.
      const hasValue = grid.cells.some((row) => (row[col]?.text.length ?? 0) > 0);
      expect(
        hasValue,
        `"${label}" column should have a value in at least one row`
      ).toBe(true);
    }

    // ── Sparse icon-flag columns: filter to guarantee flagged rows ────────
    const searchInput = page.getByPlaceholder("Qidirish", { exact: true });
    const drawerToggle = searchInput
      .locator(
        "xpath=ancestor::*[contains(concat(' ', @class, ' '), ' n-input-wrapper ')][1]"
      )
      .locator(".n-input__suffix button");

    for (const { label, filterOptionText } of ICON_FLAG_COLUMNS) {
      await drawerToggle.scrollIntoViewIfNeeded();
      await drawerToggle.click();

      const drawer = page.locator(".n-drawer");
      await expect(drawer).toBeVisible();

      const field = drawer
        .locator("div")
        .filter({ has: page.locator("label", { hasText: label }) })
        .last();
      await field.locator(".n-base-selection").first().click();
      await page
        .locator(".n-base-select-menu:visible .n-base-select-option", {
          hasText: filterOptionText,
        })
        .first()
        .click();

      await drawer.getByRole("button", { name: "Yopish" }).click();
      await expect(drawer).toBeHidden();

      const filterTag = page.locator(".n-tag", { hasText: filterOptionText }).first();
      await expect(filterTag).toBeVisible({ timeout: 10000 });
      await expect(
        page.locator(".n-data-table-tbody .n-data-table-tr").first()
      ).toBeVisible({ timeout: 15000 });

      const filteredGrid = await readGrid();
      const col = filteredGrid.headers.indexOf(label);
      expect(col, `"${label}" column header should still be present`).toBeGreaterThanOrEqual(0);
      expect(
        filteredGrid.cells.length,
        `the "${filterOptionText}" filter returned no rows`
      ).toBeGreaterThan(0);
      const hasIcon = filteredGrid.cells.some((row) => row[col]?.hasIcon);
      expect(
        hasIcon,
        `"${label}" column should render its flag icon for a matching company`
      ).toBe(true);

      // Clear the filter before the next column's pass reopens the drawer,
      // so filters don't stack across iterations.
      await filterTag.locator(".n-tag__close").click();
      await expect(filterTag).toBeHidden();
    }
  });
});
