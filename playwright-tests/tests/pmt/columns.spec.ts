import { test, expect } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT organizations "Ustunlar" (columns) panel (testpmt.miit.uz/dashboard,
// Korxonalar/organizations view). Toggling "Barchasi" should check every
// hideable column, add them all as table headers, and each applied column
// should actually carry data across the visible rows — not just render as
// an empty header.
// ---------------------------------------------------------------------------

test.describe("PMT — Korxonalar Ustunlar (columns)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // showType=0 is the organizations list; admins default to showType=3
    // (rating dashboard) otherwise, so this is forced explicitly.
    await page.goto(`${BASE_URL}/dashboard?type=1&showType=0`);
    const table = page.locator(".project-table.n-data-table");
    await expect(table).toBeVisible({ timeout: 20000 });
    await expect(
      table.locator(".n-data-table-tbody .n-data-table-tr").first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("Barchasi checks every column and each applied column has data in the table", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // The "Ustunlar" toggle sits below the table; scroll to it first.
    const toggle = page.getByRole("button", { name: /Ustunlar/i });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();

    const panel = page.locator(".col-toggle-wrapper");
    await expect(panel).toBeVisible();

    // Drive "Barchasi" to checked regardless of its starting state, so the
    // test doesn't depend on a previous run's leftover state.
    const allCheckbox = page.getByRole("checkbox", { name: "Barchasi" }).first();
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
    await toggle.click();
    await expect(panel).toBeHidden();

    // Some columns (e.g. "Ishlab chiqarish") are grouped: a single top-level
    // <th colspan=N> spans N leaf sub-columns whose own header is a second
    // <tr> below it. Expanding by colspan gives the true leaf column list,
    // which lines up 1:1 with each data row's flat <td> cells.
    const grid = await page.evaluate(() => {
      const topRow = document.querySelector(".n-data-table-thead .n-data-table-tr");
      const topCells = Array.from(topRow?.children ?? []) as HTMLElement[];
      const leafLabels: string[] = [];
      for (const cell of topCells) {
        const label = (cell.textContent ?? "").trim();
        const colspan = Number(cell.getAttribute("colspan") ?? "1");
        for (let i = 0; i < colspan; i++) {
          leafLabels.push(colspan > 1 ? `${label} #${i + 1}` : label);
        }
      }

      const rows = Array.from(
        document.querySelectorAll(".n-data-table-tbody .n-data-table-tr")
      );
      const cells = rows.map((row) =>
        Array.from(row.querySelectorAll(".n-data-table-td")).map((td) => ({
          text: (td.textContent ?? "").trim(),
          hasButton: !!td.querySelector("button"),
        }))
      );
      return { leafLabels, cells };
    });

    expect(grid.leafLabels.length).toBeGreaterThan(20); // every hideable column applied
    expect(grid.cells.length).toBeGreaterThan(0);

    for (let col = 0; col < grid.leafLabels.length; col++) {
      const label = grid.leafLabels[col];

      if (label === "Amallar") {
        // Row actions render icon buttons, not text.
        const hasButton = grid.cells.some((row) => row[col]?.hasButton);
        expect(hasButton, `"${label}" column should render action buttons`).toBe(
          true
        );
        continue;
      }

      // Individual cells can legitimately be blank for a given organization,
      // so require a value in at least one visible row rather than every row.
      const hasValue = grid.cells.some((row) => (row[col]?.text.length ?? 0) > 0);
      expect(
        hasValue,
        `"${label}" column should have a value in at least one row`
      ).toBe(true);
    }
  });
});
