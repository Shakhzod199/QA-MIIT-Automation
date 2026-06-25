import { expect, type Page, type Locator } from "@playwright/test";
import { login } from "./helpers";

// ---------------------------------------------------------------------------
// Shared Naive UI helpers for the PMI project forms (create + update). The
// create-project-*.spec.ts files keep their own inline copies; the update spec
// reuses these so it can build a project to update without duplicating the
// whole create flow.
// ---------------------------------------------------------------------------

/** The `.n-form-item` matched by its LABEL text. */
export function formItem(page: Page, label: string): Locator {
  return page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: label }) })
    .first();
}

/** Pick a random country in the first *enabled* "Davlat" select. */
export async function selectRandomDavlat(page: Page) {
  await page
    .locator(".n-form-item")
    .filter({ has: page.locator(".n-form-item-label", { hasText: "Davlat" }) })
    .locator(".n-base-selection:not(.n-base-selection--disabled)")
    .first()
    .click();
  const options = page
    .locator(".n-base-select-option")
    .filter({ hasNotText: "Aniqlanmoqda" });
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  await options.nth(Math.floor(Math.random() * count)).click();
  await page.keyboard.press("Escape");
}

/**
 * Multiple-select: pick one option, then close the still-open menu. The
 * option list is fetched from the backend (e.g. districts for a region) and
 * can be slow to resolve, so the visibility wait gets a generous timeout
 * instead of relying on the default 5s expect timeout.
 */
export async function selectMultiOption(page: Page, label: string, optionText: string) {
  await formItem(page, label).locator(".n-base-selection").first().click();
  const option = page.locator(".n-base-select-option", { hasText: optionText }).first();
  await expect(option).toBeVisible({ timeout: 25000 });
  await option.click();
  await page.keyboard.press("Escape");
}

/** Single n-select: open and pick the first real option. Skips disabled fields. */
export async function selectFirstOption(page: Page, label: string): Promise<boolean> {
  const selection = formItem(page, label)
    .locator(".n-base-selection:not(.n-base-selection--disabled)")
    .first();
  if ((await selection.count()) === 0) return false;

  await expect(page.locator(".n-base-select-menu:visible")).toHaveCount(0);
  await selection.scrollIntoViewIfNeeded();
  await selection.click();
  const options = page
    .locator(".n-base-select-menu:visible .n-base-select-option")
    .filter({ hasNotText: "Aniqlanmoqda" });
  // Options load from the backend and can be slow — wait longer than the
  // default 5s before giving up.
  await expect(options.first()).toBeVisible({ timeout: 25000 });
  await options.first().click();
  await page.keyboard.press("Escape");
  return true;
}

/**
 * Naive UI n-date-picker. The live form's picker only accepts `dd.MM.yyyy`, so
 * a `yyyy-MM-dd` argument is converted before typing — otherwise the input is
 * rejected and silently cleared (a no-op).
 */
export async function fillDate(page: Page, label: string, dateStr: string) {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const value = m ? `${m[3]}.${m[2]}.${m[1]}` : dateStr;
  const input = formItem(page, label).locator("input").first();
  await input.click();
  await input.fill(value);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  // Guard against a future format change silently clearing the value again.
  await expect(input).not.toHaveValue("");
}

/** Identifies a created project from the post-save update URL. */
export type CreatedProject = { year: string; id: string };

/**
 * Runs the full "Davlat investitsiya dasturi" (1-tip) create flow and saves.
 * After save the app redirects to /app/projects/update/{year}/{id}; we wait for
 * that and return the parsed ids so callers (the update test) can continue.
 */
export async function createProject1tip(page: Page): Promise<CreatedProject> {
  await login(page);

  await page.getByText("Loyihalar", { exact: true }).first().click();
  await page.getByRole("link", { name: "Loyiha qo'shish" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/create/, { timeout: 15000 });
  await expect(formItem(page, "Loyiha turi")).toBeVisible();

  const fieldsBefore = await page.locator(".n-form-item").count();
  await formItem(page, "Loyiha turi").locator(".n-base-selection").first().click();
  await page
    .locator(".n-tree-node-content", {
      hasText: "Davlat investitsiya dasturiga kiritilgan loyihalar",
    })
    .first()
    .click();
  await expect
    .poll(() => page.locator(".n-form-item").count())
    .toBeGreaterThan(fieldsBefore);

  await formItem(page, "Loyiha nomi")
    .locator("input")
    .first()
    .fill(`Avtotest loyiha ${Date.now()}`);

  await selectRandomDavlat(page);
  await selectFirstOption(page, "Investor");
  await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");
  await selectFirstOption(page, "Soha");

  const tuman = formItem(page, "Tuman/Shahar").locator(".n-base-selection").first();
  await expect(tuman).toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Viloyat", "Andijon viloyati");
  await expect(tuman).not.toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Tuman/Shahar", "Asaka");

  await formItem(page, "INN").locator("input").first().fill("310161998");
  await formItem(page, "Mahalliy hamkor").locator(".n-switch").first().click();

  await selectFirstOption(page, "Biriktirilgan mas'ul rahbarlar");
  await selectFirstOption(page, "Tashabbuskor");
  await selectFirstOption(page, "ISSV mas'ul departament");
  await selectFirstOption(page, "ISSV mas'ul o'rinbosari");
  await selectFirstOption(page, "ISSV mas'ul xodim");

  await fillDate(page, "Boshlanish sanasi", "2026-06-23");
  await fillDate(page, "Tugallanish sanasi", "2027-06-23");

  const createResponse = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" && /(project|loyiha)/i.test(resp.url())
  );
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  expect((await createResponse).status()).toBe(200);

  return awaitCreatedProject(page);
}

/**
 * Runs the full "Yo‘l xaritasiga kiritilgan" (2-tip) create flow and saves.
 * Differs from 1-tip by the project type and the extra "Soha guruhi" select;
 * it has no start/end date fields. Returns the new project's {year, id}.
 */
export async function createProject2tip(page: Page): Promise<CreatedProject> {
  await login(page);

  await page.getByText("Loyihalar", { exact: true }).first().click();
  await page.getByRole("link", { name: "Loyiha qo'shish" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/create/, { timeout: 15000 });
  await expect(formItem(page, "Loyiha turi")).toBeVisible();

  const fieldsBefore = await page.locator(".n-form-item").count();
  await formItem(page, "Loyiha turi").locator(".n-base-selection").first().click();
  await page
    .locator(".n-tree-node-content", { hasText: "xaritaga kiritilgan loyihalar" })
    .first()
    .click();
  await expect
    .poll(() => page.locator(".n-form-item").count())
    .toBeGreaterThan(fieldsBefore);

  await formItem(page, "Loyiha nomi")
    .locator("input")
    .first()
    .fill(`Avtotest loyiha ${Date.now()}`);

  await selectRandomDavlat(page);
  await selectFirstOption(page, "Investor");
  await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");
  expect(await selectFirstOption(page, "Soha guruhi")).toBe(true);
  await selectFirstOption(page, "Soha");

  const tuman = formItem(page, "Tuman/Shahar").locator(".n-base-selection").first();
  await expect(tuman).toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Viloyat", "Andijon viloyati");
  await expect(tuman).not.toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Tuman/Shahar", "Asaka");

  await formItem(page, "INN").locator("input").first().fill("310161998");
  await formItem(page, "Mahalliy hamkor").locator(".n-switch").first().click();

  await selectFirstOption(page, "Biriktirilgan mas'ul rahbarlar");
  await selectFirstOption(page, "Tashabbuskor");
  await selectFirstOption(page, "ISSV mas'ul departament");
  await selectFirstOption(page, "ISSV mas'ul o'rinbosari");
  await selectFirstOption(page, "ISSV mas'ul xodim");

  const createResponse = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" && /(project|loyiha)/i.test(resp.url())
  );
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  expect((await createResponse).status()).toBe(200);

  return awaitCreatedProject(page);
}

/**
 * Runs the full "Yangi (Istiqbolli)" (3-tip) create flow and saves. Fills only
 * the fields that type has (no INN / Mahalliy hamkor / dates / Tashabbuskor /
 * mas'ul rahbarlar / o'rinbosari). Returns the new project's {year, id}.
 */
export async function createProject3tip(page: Page): Promise<CreatedProject> {
  await login(page);

  await page.getByText("Loyihalar", { exact: true }).first().click();
  await page.getByRole("link", { name: "Loyiha qo'shish" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/create/, { timeout: 15000 });
  await expect(formItem(page, "Loyiha turi")).toBeVisible();

  const fieldsBefore = await page.locator(".n-form-item").count();
  await formItem(page, "Loyiha turi").locator(".n-base-selection").first().click();
  await page
    .locator(".n-tree-node-content", { hasText: "Yangi (Istiqbolli) loyihalar" })
    .first()
    .click();
  await expect
    .poll(() => page.locator(".n-form-item").count())
    .toBeGreaterThan(fieldsBefore);

  await formItem(page, "Loyiha nomi")
    .locator("input")
    .first()
    .fill(`Avtotest loyiha ${Date.now()}`);

  await selectRandomDavlat(page);
  await selectFirstOption(page, "Investor");
  await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");
  await selectFirstOption(page, "Soha guruhi");
  await selectFirstOption(page, "Soha");

  const tuman = formItem(page, "Tuman/Shahar").locator(".n-base-selection").first();
  await expect(tuman).toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Viloyat", "Andijon viloyati");
  await expect(tuman).not.toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Tuman/Shahar", "Asaka");

  await selectFirstOption(page, "ISSV mas'ul departament");
  await selectFirstOption(page, "ISSV mas'ul xodim");

  const createResponse = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" && /(project|loyiha)/i.test(resp.url())
  );
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  expect((await createResponse).status()).toBe(200);

  return awaitCreatedProject(page);
}

/**
 * Runs the full "Qo‘shimcha loyiha" (4-tip) create flow and saves. This sub-type
 * is a CHILD node nested under "Davlat investitsiya..." in the Loyiha turi tree,
 * so the parent is expanded first. No Investor / Soha guruhi / dates. Returns
 * the new project's {year, id}.
 */
export async function createProject4tip(page: Page): Promise<CreatedProject> {
  await login(page);

  await page.getByText("Loyihalar", { exact: true }).first().click();
  await page.getByRole("link", { name: "Loyiha qo'shish" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/create/, { timeout: 15000 });
  await expect(formItem(page, "Loyiha turi")).toBeVisible();

  const fieldsBefore = await page.locator(".n-form-item").count();
  await formItem(page, "Loyiha turi").locator(".n-base-selection").first().click();
  // Expand the parent via its switcher (not its label) to reveal sub-options.
  const parentNode = page
    .locator(".n-tree-node")
    .filter({
      has: page.locator(".n-tree-node-content", {
        hasText: "Davlat investitsiya dasturiga kiritilgan loyihalar",
      }),
    })
    .first();
  await parentNode.locator(".n-tree-node-switcher").click();
  await page
    .locator(".n-tree-node-content", { hasText: "shimcha loyiha" })
    .first()
    .click();
  await expect
    .poll(() => page.locator(".n-form-item").count())
    .toBeGreaterThan(fieldsBefore);

  await formItem(page, "Loyiha nomi")
    .locator("input")
    .first()
    .fill(`Avtotest loyiha ${Date.now()}`);

  await selectRandomDavlat(page);
  await formItem(page, "Loyiha qiymati").locator("input").first().fill("1.2");
  await selectFirstOption(page, "Soha");

  const tuman = formItem(page, "Tuman/Shahar").locator(".n-base-selection").first();
  await expect(tuman).toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Viloyat", "Andijon viloyati");
  await expect(tuman).not.toHaveClass(/n-base-selection--disabled/);
  await selectMultiOption(page, "Tuman/Shahar", "Asaka");

  await formItem(page, "INN").locator("input").first().fill("310161998");

  await selectFirstOption(page, "Biriktirilgan mas'ul rahbarlar");
  await selectFirstOption(page, "Tashabbuskor");
  await selectFirstOption(page, "ISSV mas'ul departament");
  await selectFirstOption(page, "ISSV mas'ul o'rinbosari");
  await selectFirstOption(page, "ISSV mas'ul xodim");

  const createResponse = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" && /(project|loyiha)/i.test(resp.url())
  );
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  expect((await createResponse).status()).toBe(200);

  return awaitCreatedProject(page);
}

/** Waits for the post-create update URL and parses {year, id} from it. */
async function awaitCreatedProject(page: Page): Promise<CreatedProject> {
  await page.waitForURL(/\/app\/projects\/update\/\d+\/\d+/, { timeout: 25000 });
  const match = page.url().match(/\/app\/projects\/update\/(\d+)\/(\d+)/);
  if (!match) throw new Error(`Unexpected post-create URL: ${page.url()}`);
  return { year: match[1], id: match[2] };
}
