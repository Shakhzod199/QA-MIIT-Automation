import { test, expect, type Page, type Locator } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// SEZ — Investitsiya loyihalari (create an investment project).
// Opens the side-menu "Investitsiya loyihalari" list, clicks "Yaratish", and
// fills the Pasport tab fields step by step: Investor, Loyiha nomi, Soha,
// Viloyat, Tuman, Sanoat zonasi nomi, Mas'ul direksiya, Direksiyadan mas'ul
// shaxs (+ kontakti), Yuridik shaxs - INN. Fields that auto-populate from
// these (Davlat, ixtisoslashuvi, Mahalliy hamkor, Ro'yxatdan o'tgan sana,
// Rahbar F.I.Sh., JSHSHIR, Telefon raqami, Manzil, Bank) are left untouched.
// Then switches to "Loyiha obyekti joylashuvi va fotosi" and, if the chosen
// zone has a lot with "Bo'sh" (available) status drawn on its map, attaches
// it to the project. Finally saves the whole form.
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
 * Opens a tree-select field and picks the first selectable (non-disabled)
 * node, if any. Returns false without touching the field when no selectable
 * node exists — "Sanoat zonasi nomi" only offers zones that already exist
 * under the chosen Viloyat/Tuman, so an empty result is expected for some
 * region/district combos.
 */
async function selectFirstTreeNodeIfAny(page: Page, label: string): Promise<boolean> {
  await formItem(page, label).locator(".n-base-selection").first().click();
  const menu = page.locator(".n-tree-select-menu:visible");
  await expect(menu).toBeVisible({ timeout: 10000 });
  const candidates = menu.locator(".n-tree-node:not(.n-tree-node--disabled) .n-tree-node-content");
  const hasOption = (await candidates.count()) > 0;
  if (hasOption) {
    await candidates.first().click();
    await expect(menu).toBeHidden({ timeout: 5000 });
  } else {
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden({ timeout: 5000 });
  }
  return hasOption;
}

/**
 * Tries every clickable polygon on the Leaflet map until one opens a popover
 * for a "Bo'sh" (available) lot with a "Qo'shish" (add) button, then attaches
 * it. Returns false without failing the test if no such lot is found — the
 * zone may have no lots drawn, or all of them may already be occupied.
 */
async function attachAvailableLotIfAny(page: Page): Promise<boolean> {
  const polygons = page.locator(".leaflet-container .leaflet-interactive");
  const count = await polygons.count();
  const popover = page.locator(".map-popover");

  for (let i = 0; i < count; i++) {
    await polygons.nth(i).click({ force: true });
    if (!(await popover.isVisible().catch(() => false))) continue;

    const addButton = popover.getByRole("button", { name: "Qo'shish" });
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      return true;
    }

    await popover.locator("button").last().click({ force: true });
    await expect(popover).toBeHidden({ timeout: 5000 });
  }
  return false;
}

test.describe("SEZ — Investitsiya loyihalari", () => {
  test("creates a new investment project filling the Pasport tab step by step", async ({
    page,
  }) => {
    test.setTimeout(120000);

    await page.goto(`${BASE_URL}/dashboard/admin/projects/investment-applications`);
    await page.getByRole("button", { name: "Yaratish", exact: true }).click();
    await expect(page).toHaveURL(/\/investment-applications\/create/, { timeout: 15000 });

    // ── Pasport tab (default tab) — fill step by step ────────────────────
    await selectOption(page, "Investor");
    // "Davlat" auto-fills from the chosen Investor — left untouched.

    await formItem(page, "Loyiha nomi")
      .locator("input")
      .first()
      .fill(`Avtotest loyiha ${Date.now()}`);

    await selectOption(page, "Soha");

    // "Qoraqalpog'iston Respublikasi" is a known-good region: the SEZ create-
    // zone test (create-zone.spec.ts) repeatedly creates industrial zones
    // there with the NUKUS directorate, so it's the region most likely to
    // have a zone with an available lot for the location-tab step below.
    await selectOption(page, "Viloyat", "Qoraqalpog'iston Respublikasi");
    await selectOption(page, "Tuman");

    const zoneSelected = await selectFirstTreeNodeIfAny(page, "Sanoat zonasi nomi");
    // "Iqtisodiy va sanoat zonasi ixtisoslashuvi" auto-fills from the chosen
    // zone's passport — left untouched.

    await selectOption(page, "Mas'ul direksiya");
    await formItem(page, "Direksiyadan mas'ul shaxs").locator("input").first().fill("Avtotest mas'ul shaxs");
    await formItem(page, "Direksiyadan mas'ul shaxs kontakti")
      .locator("input")
      .first()
      .fill("+998901234567");

    await formItem(page, "Yuridik shaxs - INN").locator("input").first().fill("123456789");
    // Mahalliy hamkor, Ro'yxatdan o'tgan sana, Rahbar F.I.Sh., JSHSHIR,
    // Telefon raqami, Manzil, Bank all auto-fill from a real INN match and
    // are left untouched — this dummy INN won't resolve to a counterparty.

    // ── "Loyiha obyekti joylashuvi va fotosi" tab ────────────────────────
    await page
      .getByRole("button", { name: "Loyiha obyekti joylashuvi va fotosi", exact: true })
      .click();

    if (zoneSelected) {
      await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 15000 });
      await attachAvailableLotIfAny(page);
    } else {
      await expect(
        page.getByText("Birinchi sifatida sanoat zonasini tanlang", { exact: true })
      ).toBeVisible({ timeout: 10000 });
    }

    // ── Save the whole form ───────────────────────────────────────────────
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();
    await expect(page).toHaveURL(/\/investment-applications(\?.*)?$/, { timeout: 20000 });
  });
});
