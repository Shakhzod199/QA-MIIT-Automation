import { test, expect } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// SEZ industrial-zones list "Ustunlar" (columns) panel
// (testsez2.miit.uz/dashboard/admin/projects/industrial-zones). Toggling
// "Barcha" should check every hideable column, add them all as table
// headers, and each applied column should actually carry data across the
// visible rows — not just render as an empty header.
// ---------------------------------------------------------------------------

test.use({ storageState: AUTH_FILE });

test.describe("SEZ — Sanoat zonalari Ustunlar (columns)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/admin/projects/industrial-zones`);
    const table = page.locator(".n-data-table").first();
    await expect(table).toBeVisible({ timeout: 20000 });
    await expect(
      table.locator(".n-data-table-tbody .n-data-table-tr").first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("Barcha checks every column and each applied column has data in the table", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.getByRole("button", { name: /Ustunlar/i }).click();
    const panel = page.locator(".column-toggle-wrapper");
    await expect(panel).toBeVisible();

    // Drive "Barcha" to checked regardless of its starting state, so the
    // test doesn't depend on whatever was left over from a previous run.
    const allCheckbox = page.getByRole("checkbox", { name: "Barcha" });
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

    // The table's thead has one row of real column labels, lined up 1:1
    // with each data row's cells.
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

    expect(grid.headers.length).toBeGreaterThan(5); // every hideable column applied
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

      // Individual cells can legitimately be blank for a given zone (e.g.
      // missing sector), so require a value in at least one visible row
      // rather than every row.
      const hasValue = grid.cells.some((row) => (row[col]?.text.length ?? 0) > 0);
      expect(
        hasValue,
        `"${label}" column should have a value in at least one row`
      ).toBe(true);
    }
  });
});
