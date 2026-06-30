import { test, expect, type Page, type Locator } from "@playwright/test";
import { login, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// PMT organizations filters (testpmt.miit.uz/dashboard?showType=0). Mirrors
// the PMI filter spec: one test for the toolbar search, one that exercises
// every field in the "Filtr" drawer (STIR text input, the ant-select
// dropdowns, and the "Yillar kesimida" checkbox) and verifies clearing.
// ---------------------------------------------------------------------------

async function gotoOrganizations(page: Page): Promise<void> {
  // showType=0 is the organizations list; admins default to showType=3
  // (rating dashboard) otherwise, so this is forced explicitly.
  await page.goto(`${BASE_URL}/dashboard?type=1&showType=0`);
}

async function waitForOrganizationsTable(page: Page): Promise<Locator> {
  const table = page.locator(".project-table.n-data-table");
  await expect(table).toBeVisible({ timeout: 20000 });
  await expect(
    table.locator(".n-data-table-tbody .n-data-table-tr").first()
  ).toBeVisible({ timeout: 20000 });
  return table;
}

/**
 * Force-close any open ant-select dropdown by clicking an inert point inside
 * the drawer (the standard "click outside" dismissal). Neither Escape nor
 * picking an option reliably closes this app's dropdowns, and a leftover
 * overlay sits on top of the next field and intercepts its click.
 */
async function closeOpenDropdown(page: Page, drawer: Locator): Promise<void> {
  const openDropdown = page.locator(".ant-select-dropdown:visible").first();
  if (!(await openDropdown.count())) return;
  await drawer.click({ position: { x: 10, y: 10 }, force: true });
  await openDropdown.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
}

/** Open an ant-select dropdown and pick its first option; skip if disabled or empty. */
async function applyFirstAntOption(
  page: Page,
  drawer: Locator,
  select: Locator
): Promise<boolean> {
  const disabled = await select
    .evaluate((el) => el.classList.contains("ant-select-disabled"))
    .catch(() => true); // detached (re-rendered away) — treat as unusable
  if (disabled) return false;

  await select.scrollIntoViewIfNeeded();
  await select.click();

  // Options come from the API and render in a list; wait for either a real
  // option or the dropdown's empty state, generously (cold backend can be slow).
  const option = page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .first();
  const empty = page.locator(".ant-select-dropdown:visible .ant-empty");
  await Promise.race([
    option.waitFor({ state: "visible", timeout: 8000 }).catch(() => {}),
    empty.first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {}),
  ]);
  const picked = await option.isVisible().catch(() => false);
  if (picked) await option.click();
  await closeOpenDropdown(page, drawer);
  return picked;
}

test.describe("PMT — Korxonalar (organizations) filter", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await gotoOrganizations(page);
  });

  test("Search — narrows the organizations table and clearing restores it", async ({
    page,
  }) => {
    const table = await waitForOrganizationsTable(page);
    const initialRowCount = await table
      .locator(".n-data-table-tbody .n-data-table-tr")
      .count();
    expect(initialRowCount).toBeGreaterThan(0);

    const search = page.getByPlaceholder("Korxona nomi");
    await expect(search).toBeVisible();

    // An unmatched term should empty the table.
    await search.fill("zzz_no_such_organization_zzz");
    await expect(table.locator(".n-data-table-empty")).toBeVisible({
      timeout: 10000,
    });

    // Clearing restores the original rows.
    await search.fill("");
    await expect
      .poll(
        async () => table.locator(".n-data-table-tbody .n-data-table-tr").count(),
        { timeout: 10000 }
      )
      .toBe(initialRowCount);
  });

  test("Drawer — applies every filter field and clearing resets them", async ({
    page,
  }) => {
    await waitForOrganizationsTable(page);

    // Open the right-hand filter drawer.
    await page.getByRole("button", { name: "Filtr" }).click();
    const drawer = page.locator(".n-drawer").last();
    await expect(drawer).toBeVisible();
    // Let the drawer finish animating and its selects initialise before driving them.
    await page.waitForTimeout(1200);

    // STIR — free text field.
    await drawer.getByPlaceholder("STIR").fill("123456789");

    // Every ant-select in the drawer, in DOM order — Soha, Viloyat, Tuman,
    // Loyiha tashabbuskori (tarmoq/hudud), Tarmoq, Loyiha mavjudligi,
    // Korxona turi, Mavjud emas (yil). "Tuman" depends on "Viloyat" and is
    // disabled until it's picked, so processing in DOM order unlocks it
    // naturally instead of needing a hardcoded field order.
    const selects = drawer.locator(".ant-select");
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThan(0);
    let appliedSelects = 0;
    for (let i = 0; i < selectCount; i++) {
      if (await applyFirstAntOption(page, drawer, selects.nth(i))) appliedSelects += 1;
      // Selecting a region/etc. can re-render sibling fields (e.g. "Tuman"
      // becoming enabled); let that settle before targeting the next select.
      await page.waitForTimeout(400);
    }
    expect(
      appliedSelects,
      "at least one drawer select should apply"
    ).toBeGreaterThan(0);

    // "Yillar kesimida" — boolean checkbox.
    await drawer.getByText("Yillar kesimida").click();

    // Close the drawer; applied filters should surface as removable tags in
    // the toolbar (outside the drawer).
    await drawer.getByRole("button", { name: "Yopish" }).click();
    await expect(drawer).toBeHidden();

    const tags = page.locator("div.overflow-x-auto > .n-tag");
    await expect(tags.first()).toBeVisible({ timeout: 10000 });

    // Re-open the drawer and clear; all filter tags should disappear.
    await page.getByRole("button", { name: "Filtr" }).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Filtrlarni tozalash" }).click();
    await drawer.getByRole("button", { name: "Yopish" }).click();
    await expect(drawer).toBeHidden();

    await expect(tags).toHaveCount(0, { timeout: 10000 });
  });
});
