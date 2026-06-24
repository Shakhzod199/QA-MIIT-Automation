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
    const grid = await page.evaluate(() => {
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
        }))
      );
      return { headers, cells };
    });

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

      // Individual cells can legitimately be blank for a given company, so
      // require a value in at least one visible row rather than every row.
      const hasValue = grid.cells.some((row) => (row[col]?.text.length ?? 0) > 0);
      expect(
        hasValue,
        `"${label}" column should have a value in at least one row`
      ).toBe(true);
    }
  });
});
