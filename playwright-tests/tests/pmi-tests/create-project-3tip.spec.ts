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
//
// This spec covers the "Yangi (Istiqbolli) loyihalar" project type. Only the
// fields listed below are filled.
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
  // Davlat is a *multiple* select: its menu stays open after a pick. Close it
  // so the lingering menu's options don't shadow the next field's dropdown.
  await page.keyboard.press("Escape");
}

/**
 * Multiple-select: pick one option, then close the still-open menu. The
 * option list is fetched from the backend (e.g. districts for a region) and
 * can be slow to resolve, so the visibility wait gets a generous timeout
 * instead of relying on the default 5s expect timeout.
 */
async function selectMultiOption(page: Page, label: string, optionText: string) {
  await formItem(page, label).locator(".n-base-selection").first().click();
  const option = page.locator(".n-base-select-option", { hasText: optionText }).first();
  await expect(option).toBeVisible({ timeout: 25000 });
  await option.click();
  await page.keyboard.press("Escape");
}

/**
 * Single n-select: open the field and pick the FIRST real option. Skips the
 * "Aniqlanmoqda" placeholder. Returns false (without failing) when the field
 * has no *enabled* selection — e.g. Investor stays disabled until upstream
 * fields are set — so the caller can move on.
 */
async function selectFirstOption(page: Page, label: string): Promise<boolean> {
  const selection = formItem(page, label)
    .locator(".n-base-selection:not(.n-base-selection--disabled)")
    .first();
  if ((await selection.count()) === 0) return false;

  // Wait for any previous dropdown to finish closing. A still-animating menu
  // stays `:visible` briefly, and (being earlier in the DOM) its options would
  // otherwise be matched as our "first" option, then vanish mid-click.
  await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0);
  // Bring the field fully into view *before* opening it. Naive UI teleports the
  // menu to <body> and repositions/closes it if the page scrolls mid-click, so
  // any scrolling must happen now — not while clicking an option.
  await selection.scrollIntoViewIfNeeded();
  await selection.click();
  // Scope to the dropdown that just opened (the only *visible* select menu) so
  // a stale/closing menu from a previous field can't be matched first.
  const options = page
    .locator(".n-base-select-menu:visible .n-base-select-option")
    .filter({ hasNotText: "Aniqlanmoqda" });
  // Options load from the backend and can be slow — wait longer than the
  // default 5s before giving up.
  await expect(options.first()).toBeVisible({ timeout: 25000 });
  await options.first().click();
  // Harmless for single-selects; required if the control turns out multiple.
  await page.keyboard.press("Escape");
  return true;
}

test.describe("PMI — Loyihalar CRUD", () => {
  test("creates a 'Yangi (Istiqbolli)' project and gets 200 on save", async ({
    page,
  }) => {
    // Backend-driven dropdown options (e.g. districts) can be slow to load —
    // give the whole flow more room than the 30s default.
    test.setTimeout(60000);

    await login(page);

    // ── Sidebar → Loyihalar (expands submenu) → Loyiha qo'shish (a link) ──
    await page.getByText("Loyihalar", { exact: true }).first().click();
    await page.getByRole("link", { name: "Loyiha qo'shish" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/create/, { timeout: 15000 });
    await expect(formItem(page, "Loyiha turi")).toBeVisible();

    // ── Loyiha turi (tree-select) → reveals the conditional fields ───────
    const fieldsBefore = await page.locator(".n-form-item").count();
    await formItem(page, "Loyiha turi").locator(".n-base-selection").first().click();
    await page
      .locator(".n-tree-node-content", {
        hasText: "Yangi (Istiqbolli) loyihalar",
      })
      .first()
      .click();
    await expect
      .poll(() => page.locator(".n-form-item").count(), {
        message: "Expected extra fields to appear after choosing the project type",
      })
      .toBeGreaterThan(fieldsBefore);

    // ── 1. Loyiha nomi (unique so reruns don't collide) ──────────────────
    await formItem(page, "Loyiha nomi")
      .locator("input")
      .first()
      .fill(`Avtotest loyiha ${Date.now()}`);

    // ── 2. Davlat: pick a random country ─────────────────────────────────
    await selectRandomDavlat(page);

    // ── 3. Investor: first option (skipped automatically if still disabled)
    await selectFirstOption(page, "Investor");

    // ── 4. Loyiha qiymati ────────────────────────────────────────────────
    await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");

    // ── 5. Soha guruhi: first option (drives the Soha list) ──────────────
    await selectFirstOption(page, "Soha guruhi");

    // ── 6. Soha: first option ────────────────────────────────────────────
    await selectFirstOption(page, "Soha");

    // ── 7. Viloyat → enables Tuman/Shahar (both multiple-selects) ────────
    const tuman = formItem(page, "Tuman/Shahar").locator(".n-base-selection").first();
    await expect(tuman).toHaveClass(/n-base-selection--disabled/);
    await selectMultiOption(page, "Viloyat", "Andijon viloyati");
    await expect(tuman).not.toHaveClass(/n-base-selection--disabled/);

    // ── 8. Tuman/Shahar ──────────────────────────────────────────────────
    await selectMultiOption(page, "Tuman/Shahar", "Asaka");

    // ── 9. ISSV mas'ul departament: first option ─────────────────────────
    await selectFirstOption(page, "ISSV mas'ul departament");

    // ── 10. ISSV mas'ul xodim: first option ──────────────────────────────
    await selectFirstOption(page, "ISSV mas'ul xodim");

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
