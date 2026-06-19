import { test, expect, type Page, type Locator } from "@playwright/test";
import { login } from "./helpers";

// ---------------------------------------------------------------------------
// Naive UI helpers — the PMI create-project form is Naive UI (Vue). Controls
// live inside `.n-form-item` blocks anchored by their label text. Selectors
// below were verified against the live testpmi.miit.uz create form.
//
// Note the two flavours of "select" on this form:
//   - regular n-select  → options are `.n-base-select-option`
//   - n-tree-select     → options are tree nodes `.n-tree-node-content`
//   - multiple n-select stays open after a pick, so we Escape to close it
// ---------------------------------------------------------------------------

/**
 * The `.n-form-item` matched by its LABEL text (not its selected value, which
 * could otherwise collide — e.g. the "Loyiha turi" value contains "Davlat").
 */
function formItem(page: Page, label: string): Locator {
  return page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: label }) })
    .first();
}

/** Pick a random country in the first *enabled* "Davlat" select. */
async function selectRandomDavlat(page: Page) {
  // Two "Davlat" fields exist; the top one is auto-derived/disabled, so target
  // the enabled selection.
  await page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: "Davlat" }) })
    .locator(".n-base-selection:not(.n-base-selection--disabled)")
    .first()
    .click();
  // Exclude the non-country "Aniqlanmoqda" placeholder option.
  const options = page
    .locator(".n-base-select-option")
    .filter({ hasNotText: "Aniqlanmoqda" });
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  await options.nth(Math.floor(Math.random() * count)).click();
}

/** Multiple-select: pick one option, then close the still-open menu. */
async function selectMultiOption(page: Page, label: string, optionText: string) {
  await formItem(page, label).locator(".n-base-selection").first().click();
  await page.locator(".n-base-select-option", { hasText: optionText }).first().click();
  await page.keyboard.press("Escape");
}

test.describe("PMI — Loyihalar CRUD", () => {
  test("creates a 'Davlat investitsiya dasturi' project and gets 200 on save", async ({
    page,
  }) => {
    await login(page);

    // ── Sidebar → Loyihalar (expands submenu) → Loyiha qo'shish (a link) ──
    await page.getByText("Loyihalar", { exact: true }).first().click();
    await page.getByRole("link", { name: "Loyiha qo'shish" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/create/);
    await expect(formItem(page, "Loyiha turi")).toBeVisible();

    // ── Loyiha turi (tree-select) → reveals the conditional fields ───────
    const fieldsBefore = await page.locator(".n-form-item").count();
    await formItem(page, "Loyiha turi").locator(".n-base-selection").first().click();
    await page
      .locator(".n-tree-node-content", {
        hasText: "Davlat investitsiya dasturiga kiritilgan loyihalar",
      })
      .first()
      .click();
    await expect
      .poll(() => page.locator(".n-form-item").count(), {
        message: "Expected extra fields to appear after choosing the project type",
      })
      .toBeGreaterThan(fieldsBefore);

    // ── Loyiha nomi (unique so reruns don't collide) ─────────────────────
    await formItem(page, "Loyiha nomi")
      .locator("input")
      .first()
      .fill(`Avtotest loyiha ${Date.now()}`);

    // ── Davlat: pick a random country ────────────────────────────────────
    await selectRandomDavlat(page);

    // ── Loyiha qiymati ───────────────────────────────────────────────────
    await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");

    // ── Viloyat → enables Tuman/Shahar (both multiple-selects) ───────────
    const tuman = formItem(page, "Tuman/Shahar").locator(".n-base-selection").first();
    await expect(tuman).toHaveClass(/n-base-selection--disabled/);
    await selectMultiOption(page, "Viloyat", "Andijon viloyati");
    await expect(tuman).not.toHaveClass(/n-base-selection--disabled/);
    await selectMultiOption(page, "Tuman/Shahar", "Asaka");

    // ── Toggle the "Aniqlanmoqda" switch next to "Mahalliy hamkor" ───────
    await formItem(page, "Mahalliy hamkor").locator(".n-switch").first().click();

    // ── Saqlash → expect a 200 from the create POST ──────────────────────
    const createResponse = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" && /(project|loyiha)/i.test(resp.url())
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();

    const response = await createResponse;
    expect(response.status()).toBe(200);
  });
});
