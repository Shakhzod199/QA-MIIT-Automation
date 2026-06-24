import { test, expect, type Page, type Locator } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// SEZ industrial-zones list filters
// (testsez2.miit.uz/dashboard/admin/projects/industrial-zones). One test for
// the toolbar search, one that exercises every filter in the right-hand
// "Filtr" drawer (region, district, directorate, territory boundary, zone
// category) and verifies clearing.
// ---------------------------------------------------------------------------

test.use({ storageState: AUTH_FILE });

async function waitForZonesTable(page: Page): Promise<Locator> {
  const table = page.locator(".n-data-table").first();
  await expect(table).toBeVisible({ timeout: 20000 });
  await expect(
    table.locator(".n-data-table-tbody .n-data-table-tr").first()
  ).toBeVisible({ timeout: 20000 });
  return table;
}

/**
 * Open a drawer n-select and pick its first option; skip if it has none.
 * Picking an option closes the select's own dropdown menu automatically —
 * unlike PMI's filter drawer, this one closes the whole NDrawer on Escape,
 * so we must not press Escape here to dismiss anything.
 */
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
  if (picked) {
    await option.click();
  } else {
    // No options to pick (empty state) — the menu is still open, so close it
    // by clicking a neutral point inside the drawer rather than pressing
    // Escape, which would close the drawer itself.
    await page.locator(".n-drawer-body-content-wrapper, .n-drawer").first().click({ position: { x: 10, y: 10 } });
  }
  await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0, { timeout: 5000 });
  return picked;
}

// Serial: both tests share the one cached session (see helpers.ts AUTH_FILE),
// and SEZ's account knocks a session out when it's used concurrently from two
// contexts at once — running one test at a time avoids that.
test.describe.configure({ mode: "serial" });

test.describe("SEZ — Sanoat zonalari filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/admin/projects/industrial-zones`);
  });

  test("Search — narrows the zones table and clearing restores it", async ({
    page,
  }) => {
    const table = await waitForZonesTable(page);
    const initialRowCount = await table
      .locator(".n-data-table-tbody .n-data-table-tr")
      .count();
    expect(initialRowCount).toBeGreaterThan(0);

    const search = page.getByPlaceholder("Qidirish");
    await expect(search).toBeVisible();

    // An unmatched term should empty the table.
    await search.fill("zzz_no_such_zone_zzz");
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
    await waitForZonesTable(page);

    // Open the right-hand "Kengaytirilgan filtrlar" drawer via the search
    // input's "Filtr" suffix button.
    await page.getByRole("button", { name: "Filtr" }).click();
    const drawer = page.locator(".n-drawer");
    await expect(drawer).toBeVisible();
    // Let the drawer finish animating and its selects initialise before driving them.
    await page.waitForTimeout(1200);

    // Apply the first option of every select filter in the side menu (Viloyat,
    // Tuman, Direksiya, Hudud chegarasi, Zona turi).
    const selects = drawer.locator(".n-base-selection");
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);
    let applied = 0;
    for (let i = 0; i < count; i++) {
      if (await applyFirstOption(page, selects.nth(i))) applied += 1;
      // Selecting a region/etc. can re-render sibling fields (e.g. "Tuman"
      // becoming enabled); let that settle before targeting the next select.
      await page.waitForTimeout(400);
    }
    expect(applied, "at least one side-menu filter should apply").toBeGreaterThan(0);

    // Close the drawer; applied filters should surface as removable tags.
    await drawer.getByRole("button", { name: "Yopish" }).click();
    await expect(drawer).toBeHidden();
    const tags = page.locator(".n-tag");
    await expect(tags.first()).toBeVisible({ timeout: 10000 });

    // Re-open the drawer and clear; all filter tags should disappear.
    await page.getByRole("button", { name: "Filtr" }).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Tozalash" }).click();
    await drawer.getByRole("button", { name: "Yopish" }).click();
    await expect(drawer).toBeHidden();

    await expect(tags).toHaveCount(0, { timeout: 10000 });
  });
});
