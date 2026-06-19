import { test, expect, type Page, type Locator } from "@playwright/test";
import { login } from "./helpers";

// ---------------------------------------------------------------------------
// Naive UI helpers
//
// The PMI app is built with Naive UI (Vue), so every control lives inside a
// `.n-form-item` whose label text we can anchor on. Dropdown options are
// teleported to <body>, so we query `.n-base-select-option` on the page, not
// inside the form item.
//
// NOTE: a handful of these selectors are best-effort against the standard
// Naive UI DOM. If a step can't find its target on the live app, the label
// text or the option class is the thing to adjust — the flow itself is correct.
// ---------------------------------------------------------------------------

/** The `.n-form-item` whose label contains `label`. */
function formItem(page: Page, label: string): Locator {
  return page.locator(".n-form-item", { hasText: label }).first();
}

/** Open a Naive UI select (by form-item label) and pick the option by text. */
async function selectOption(page: Page, label: string, optionText: string) {
  await formItem(page, label).locator(".n-base-selection").first().click();
  await page
    .locator(".n-base-select-option", { hasText: optionText })
    .first()
    .click();
}

/** Open a Naive UI select and pick a random option from the menu. */
async function selectRandomOption(page: Page, label: string): Promise<string> {
  await formItem(page, label).locator(".n-base-selection").first().click();
  const options = page.locator(".n-base-select-option");
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  const index = Math.floor(Math.random() * count);
  const chosen = options.nth(index);
  const text = (await chosen.textContent())?.trim() ?? "";
  await chosen.click();
  return text;
}

/** Whether a select (by form-item label) is currently disabled. */
async function isSelectDisabled(page: Page, label: string): Promise<boolean> {
  const selection = formItem(page, label).locator(".n-base-selection").first();
  const cls = (await selection.getAttribute("class")) ?? "";
  return cls.includes("n-base-selection--disabled");
}

test.describe("PMI — Loyihalar CRUD", () => {
  test("creates a 'Davlat investisiya dasturi' project and gets 200 on save", async ({
    page,
  }) => {
    await login(page);

    // ── Sidebar → Loyihalar → Loyiha qo'shish ────────────────────────────
    await page.getByRole("link", { name: "Loyihalar" }).first().click();
    await page.getByRole("button", { name: /Loyiha qo'?shish/ }).click();

    // The create form should be open now.
    const loyihaTuri = formItem(page, "Loyiha turi");
    await expect(loyihaTuri).toBeVisible();

    // ── Select "Loyiha turi" and verify conditional fields appear ─────────
    const fieldsBefore = await page.locator(".n-form-item").count();
    await selectOption(
      page,
      "Loyiha turi",
      "Davlat investisiya dasturiga kiritilgan loyihalar"
    );
    // Selecting this type should reveal additional conditional fields.
    await expect
      .poll(async () => page.locator(".n-form-item").count(), {
        message:
          "Expected extra fields to appear after choosing the project type",
      })
      .toBeGreaterThan(fieldsBefore);

    // ── Loyiha nomi (unique so reruns don't collide) ─────────────────────
    const projectName = `Avtotest loyiha ${Date.now()}`;
    await formItem(page, "Loyiha nomi").locator("input").first().fill(projectName);

    // ── Davlat: pick a random country ────────────────────────────────────
    await selectRandomOption(page, "Davlat");

    // ── Loyiha qiymati ───────────────────────────────────────────────────
    await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");

    // ── Viloyat → enables Tuman/Shahar ───────────────────────────────────
    // Tuman/Shahar must be disabled until a region is chosen.
    expect(await isSelectDisabled(page, "Tuman")).toBe(true);
    await selectOption(page, "Viloyat", "Andijon");
    expect(await isSelectDisabled(page, "Tuman")).toBe(false);
    await selectOption(page, "Tuman", "Asaka");

    // ── Toggle the "aniqlanmoqda" switch next to "Mahalliy hamkor" ───────
    await formItem(page, "Mahalliy hamkor").locator(".n-switch").first().click();

    // ── Saqlash → expect a 200 from the create POST ──────────────────────
    // Matches any POST whose path mentions "project"/"loyiha". Tighten this
    // to the exact create endpoint once we confirm it from the network tab.
    const createResponse = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" &&
        /(project|loyiha)/i.test(resp.url())
    );
    await page.getByRole("button", { name: "Saqlash", exact: true }).click();

    const response = await createResponse;
    expect(response.status()).toBe(200);
  });
});
