import { test, expect, type Page, type Locator } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// SEZ — Iqtisodiy va sanoat zonalarini yaratish (create an industrial zone).
// Fills the 7 required passport fields, draws a zone polygon and a lot
// polygon on the map tab, confirms the lot shows up in the "Yer holati" tab's
// "Kartadagi lotlar" table, then saves the whole form.
// ---------------------------------------------------------------------------

test.use({ storageState: AUTH_FILE });

/** The `.n-form-item` matched by its LABEL text. */
function formItem(page: Page, label: string): Locator {
  return page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: label }) })
    .first();
}

/**
 * Open an n-select field and pick an option. With no `optionText`, picks the
 * first real option; otherwise picks the first option whose text contains
 * `optionText`.
 */
async function selectOption(page: Page, label: string, optionText?: string): Promise<void> {
  await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0);
  await formItem(page, label).locator(".n-base-selection").first().click();
  let options = page
    .locator(".n-base-select-menu:visible .n-base-select-option")
    .filter({ hasNotText: "Aniqlanmoqda" });
  if (optionText) options = options.filter({ hasText: optionText });
  await expect(options.first()).toBeVisible({ timeout: 20000 });
  await options.first().click();
  await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0, { timeout: 5000 });
}

/**
 * Draws a triangle on the Leaflet map and finishes it. Clicking back on the
 * first point does not reliably auto-close the polygon under automation —
 * the draw toolbar's own "Finish drawing" action does, regardless of how
 * many points were placed (3 is the minimum for a polygon).
 */
async function drawTriangle(
  page: Page,
  center: { x: number; y: number },
  radius: { x: number; y: number }
): Promise<void> {
  const p1 = { x: center.x - radius.x, y: center.y - radius.y };
  const p2 = { x: center.x + radius.x, y: center.y - radius.y };
  const p3 = { x: center.x, y: center.y + radius.y };

  // Matched by Leaflet.draw's stable CSS class rather than its title/text,
  // which is translated (was Russian "Нарисовать зону или лот", now Uzbek
  // "Zona yoki lot chizish") and broke this locator once already.
  await page.locator("a.leaflet-draw-draw-polygon").click();
  await page.mouse.click(p1.x, p1.y);
  await page.waitForTimeout(200);
  await page.mouse.click(p2.x, p2.y);
  await page.waitForTimeout(200);
  await page.mouse.click(p3.x, p3.y);
  await page.waitForTimeout(200);
  await page.locator('a[title="Finish drawing"]').first().click();
}

test.describe("SEZ — Iqtisodiy va sanoat zonalarini yaratish", () => {
  test("creates a new industrial zone with a zone and a lot drawn on the map", async ({
    page,
  }) => {
    test.setTimeout(120000);

    await page.goto(`${BASE_URL}/dashboard/admin/projects/industrial-zones`);
    await page.getByRole("button", { name: "Yaratish", exact: true }).click();
    await expect(page).toHaveURL(/\/industrial-zones\/create/, { timeout: 15000 });

    // ── Passport tab: 7 required fields ──────────────────────────────────
    await formItem(page, "Nomi").locator("input").first().fill(`Avtotest zona ${Date.now()}`);

    // "Zonani tanlang" only offers options that already have a top-level zone
    // under the chosen region+directorate — most random combos show "No
    // Data". "Qoraqalpog'iston Respublikasi" + the "NUKUS" directorate is a
    // known-good pair (verified against the live data).
    await selectOption(page, "Viloyat", "Qoraqalpog'iston Respublikasi");
    await selectOption(page, "Tuman");
    await selectOption(page, "Direksiya", "NUKUS");
    await selectOption(page, "Zonani tanlang");
    // "Iqtisodiy va sanoat zonasi ixtisoslashuvi" is zone_type_id — a plain select.
    await selectOption(page, "Iqtisodiy va sanoat zonasi ixtisoslashuvi");

    // "MIZ va SZ turi" is zone_category_id — a tree-select. Its children are
    // rendered already-expanded (default-expand-all), so the leaf node is
    // clickable directly with no need to expand a parent first.
    await formItem(page, "MIZ va SZ turi").locator(".n-base-selection").first().click();
    const leafNode = page.locator(".n-tree-node-content", { hasText: "Maxsus sanoat zonasi" }).first();
    await expect(leafNode).toBeVisible({ timeout: 10000 });
    await leafNode.click();
    await expect(page.locator(".n-tree-select-menu:visible")).toHaveCount(0, { timeout: 5000 });

    // ── Map tab: draw the zone, then a lot inside it ─────────────────────
    await page.getByRole("button", { name: "Xarita", exact: true }).click();
    await page.waitForTimeout(2000);

    const mapContainer = page.locator(".leaflet-container").first();
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
    const mapBox = (await mapContainer.boundingBox())!;
    const center = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };

    const modal = page.locator(".n-modal:visible");

    // ── Draw the zone (first polygon — type defaults to "Hudud") ─────────
    await drawTriangle(page, center, { x: 80, y: 60 });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText("Hudud", { exact: true })).toBeVisible();
    await modal.getByRole("button", { name: "Saqlash", exact: true }).click();
    await expect(modal).toBeHidden();

    // ── Draw the lot inside the zone (second polygon — type defaults to "Lot") ─
    // This modal (PolygonPropertiesForm) uses plain <div><label> blocks, not
    // .n-form-item, so the field is matched by its label text directly.
    await drawTriangle(page, center, { x: 25, y: 18 });
    await expect(modal).toBeVisible({ timeout: 5000 });
    const slotNumberField = modal.locator("label", { hasText: "Lot raqami" }).locator("xpath=..");
    await slotNumberField.locator("input").fill("1");
    await modal.getByRole("button", { name: "Saqlash", exact: true }).click();
    await expect(modal).toBeHidden();

    // ── "Yer holati" tab: the lot should already show up in "Kartadagi lotlar" ─
    await page.getByRole("button", { name: "Yer holati", exact: true }).click();
    await expect(page.getByText("Kartadagi lotlar", { exact: true })).toBeVisible({ timeout: 10000 });
    const lotsTable = page.locator(".n-data-table").first();
    await expect(lotsTable.locator(".n-data-table-tbody .n-data-table-tr").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(lotsTable.locator(".n-data-table-tbody")).toContainText("1");

    // ── Save the whole form ───────────────────────────────────────────────
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await expect(page).toHaveURL(/\/industrial-zones(\?.*)?$/, { timeout: 20000 });
  });
});
