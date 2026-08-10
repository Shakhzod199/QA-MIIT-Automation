import { test, expect, type Page, type Locator } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMI projects-list filters (testpmi.miit.uz/app/projects). Mirrors the export
// filter spec: one test for the toolbar search, one that exercises every filter
// in the right-hand "Filtr" drawer (side menu) and verifies clearing.
// ---------------------------------------------------------------------------

async function waitForProjectsTable(page: Page): Promise<Locator> {
  const table = page.locator(".n-data-table").first();
  await expect(table).toBeVisible({ timeout: 20000 });
  await expect(
    table.locator(".n-data-table-tbody .n-data-table-tr").first()
  ).toBeVisible({ timeout: 20000 });
  return table;
}

/** Open a drawer n-select and pick its first option; skip if it has none. */
async function applyFirstOption(page: Page, selection: Locator): Promise<boolean> {
  await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0);
  await selection.scrollIntoViewIfNeeded();
  await selection.click();
  // Options come from the API and render in a virtual list; wait for either a
  // real option or the menu's empty state, generously (cold backend can be slow).
  const option = page
    .locator(".n-base-select-menu:visible .n-base-select-option")
    .first();
  const empty = page.locator(".n-base-select-menu:visible .n-empty, .n-base-select-menu:visible .n-base-select-menu__empty");
  await Promise.race([
    option.waitFor({ state: "visible", timeout: 12000 }).catch(() => {}),
    empty.first().waitFor({ state: "visible", timeout: 12000 }).catch(() => {}),
  ]);
  const picked = await option.isVisible().catch(() => false);
  if (picked) await option.click();
  await page.keyboard.press("Escape");
  return picked;
}

test.describe("PMI — Loyihalar filter", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/app/projects`);
  });

  test("Search — narrows the projects table and clearing restores it", async ({
    page,
  }) => {
    const table = await waitForProjectsTable(page);
    const initialRowCount = await table
      .locator(".n-data-table-tbody .n-data-table-tr")
      .count();
    expect(initialRowCount).toBeGreaterThan(0);

    const search = page.getByPlaceholder("ID yoki Loyiha nomi");
    await expect(search).toBeVisible();

    // An unmatched term should empty the table.
    await search.fill("zzz_no_such_project_zzz");
    await expect(table.locator(".n-data-table-empty")).toBeVisible({ timeout: 10000 });

    // Clearing restores the original rows.
    await search.fill("");
    await expect
      .poll(
        async () => table.locator(".n-data-table-tbody .n-data-table-tr").count(),
        { timeout: 10000 }
      )
      .toBe(initialRowCount);
  });

  test("Drawer — applies every side-menu filter and clearing resets them", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await waitForProjectsTable(page);

    // The toolbar always carries a reporting-period chip ("Yanvar-Iyul"), and
    // it is an .n-tag sitting in the very same swiper container as the filter
    // chips — there is no container or class that separates the two. It is
    // also not a filter: the drawer has no period field, and "Tozalash"
    // deliberately leaves it alone because a report period always has a value.
    // So snapshot whatever the toolbar starts with and assert relative to that
    // baseline rather than expecting a bare count of 0.
    const tags = page.locator(".n-tag");
    const rawTagTexts = async () =>
      (await tags.allTextContents()).map((t) => t.trim());
    const tagTexts = async () => (await rawTagTexts()).sort();
    const baselineTags = await tagTexts();

    // Open the right-hand filter drawer.
    await page.getByRole("button", { name: "Filtr" }).click();
    const drawer = page.locator(".n-drawer");
    await expect(drawer).toBeVisible();
    // Let the drawer finish animating and its selects initialise before driving them.
    await page.waitForTimeout(1200);

    // Apply the first option of every select filter in the side menu.
    const selects = drawer.locator(".n-base-selection");
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);
    let applied = 0;
    for (let i = 0; i < count; i++) {
      if (await applyFirstOption(page, selects.nth(i))) applied += 1;
    }
    expect(applied, "at least one side-menu filter should apply").toBeGreaterThan(0);

    // Close the drawer; applied filters should surface as removable tags on
    // top of the baseline ones.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect
      .poll(async () => tags.count(), { timeout: 10000 })
      .toBeGreaterThan(baselineTags.length);

    // Clearing should remove every filter tag the drawer added, leaving the
    // toolbar exactly as it was found.
    const clear = page.getByRole("button", { name: /Tozalash|Tarozala|Clear|Filtrni tozalash/i });
    if (await clear.count()) {
      await clear.first().click();
    } else {
      // Fall back to removing each added tag individually. Baseline tags are
      // skipped — closing the period chip only resets it to another period,
      // so looping until the count hits 0 would never terminate.
      for (let guard = 0; guard < 20; guard++) {
        const index = (await rawTagTexts()).findIndex(
          (text) => !baselineTags.includes(text)
        );
        if (index < 0) break;
        await tags.nth(index).locator(".n-tag__close").click();
      }
    }
    await expect.poll(tagTexts, { timeout: 10000 }).toEqual(baselineTags);
  });
});
