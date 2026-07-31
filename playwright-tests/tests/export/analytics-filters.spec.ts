import { test, expect, type Locator, type Page } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

// ---------------------------------------------------------------------------
// Analitika page — right-hand "Filtrlar" panel (export.miit.uz/analytics).
//
// Reached from the dashboard via the header control next to the "Xarita"
// toggle: "Asosiy sahifa" opens a 2-option dropdown (Analitika / Dashboard).
// The navigation itself is covered by the first test; the filter tests then
// go straight to /analytics so a header regression can't mask a filter one.
//
// The panel has three collapsible sections and ten controls. Every filter
// auto-applies (no "Apply" button) by re-issuing the /api/v1/companies/charts/*
// requests with a query parameter, so each test asserts on both signals:
// the outgoing request parameter and the resulting KPI values.
//
//   Section       Label            Control   Query parameter
//   ────────────────────────────────────────────────────────────
//   Qidirish      Oylar kesimida   select    months
//                 STIR             input     inn
//                 Korxona nomi     input     name
//                 Mahsulot         select    grouped_names
//                 TN VED           input     tnved
//   Joylashuv     Viloyat          select    region_ids
//                 Tuman            select    district_ids
//                 Davlat           select    country_ids
//   Bank va soha  Soha             select    sphere_ids
//                 Bank             select    bank_ids
//
// "Mahsulot" was a free-text input sending ?product_name until 2026-07-31,
// when the frontend team turned it into a product-catalog dropdown that sends
// ?grouped_names with the option's label. It is the one select that sends a
// name rather than a list of numeric ids — hence `valueKind` below.
// ---------------------------------------------------------------------------

test.use({
  // Reuse the session captured once by auth.setup.ts instead of logging in per test.
  storageState: AUTH_FILE,
  // The filter panel is a desktop-only sidebar — below ~1536px it collapses
  // behind a toggle and its controls are not reachable.
  viewport: { width: 1920, height: 1080 },
});

// The analytics page fans out ~10 chart requests on load and again on every
// filter change, so it needs more headroom than the 30s project default.
test.describe.configure({ timeout: 120000 });

const SECTIONS = ["Qidirish", "Joylashuv", "Bank va soha"] as const;

// `valueKind` says what the control puts in the query string: "ids" for a
// comma-separated list of numeric ids, "name" for the option's own label.
const SELECT_FILTERS = [
  { label: "Oylar kesimida", param: "months", valueKind: "ids" },
  { label: "Mahsulot", param: "grouped_names", valueKind: "name" },
  { label: "Viloyat", param: "region_ids", valueKind: "ids" },
  { label: "Tuman", param: "district_ids", valueKind: "ids" },
  { label: "Davlat", param: "country_ids", valueKind: "ids" },
  { label: "Soha", param: "sphere_ids", valueKind: "ids" },
  { label: "Bank", param: "bank_ids", valueKind: "ids" },
] as const;

const TEXT_FILTERS = [
  { label: "STIR", param: "inn", value: "200000000" },
  { label: "Korxona nomi", param: "name", value: "AGRO" },
  { label: "TN VED", param: "tnved", value: "5201" },
] as const;

// A product that exists in the Mahsulot catalog and has real export data —
// used by the end-to-end filter test at the bottom of this file.
const PRODUCT = "Benzin";

// Each field is a <label> followed by its sibling control. The panel's own
// classes are Tailwind utilities shared with the rest of the page and its only
// unique attribute is Vue's build-hash scope id, so anchoring on the label text
// is the one selector here that survives a restyle.
function filterSelect(page: Page, label: string): Locator {
  return page
    .locator(
      `xpath=//label[normalize-space()="${label}"]/following-sibling::*[contains(concat(" ",normalize-space(@class)," ")," n-select ")][1]`,
    )
    .first();
}

function filterInput(page: Page, label: string): Locator {
  return page
    .locator(`xpath=//label[normalize-space()="${label}"]/following-sibling::*[contains(@class,"n-input")][1]//input`)
    .first();
}

// Naive UI keeps every dropdown it has ever opened mounted in the DOM, so an
// unscoped ".n-base-select-option" also matches the options of previously
// closed menus (including the charts' own Line/Bar pickers). Always scope to
// the menu that is actually on screen.
function openMenuOptions(page: Page): Locator {
  return page.locator(".n-base-select-menu:visible").locator(".n-base-select-option");
}

// KPI header cards. Money values ("$ 7 944.0 mln", "$-15 859.0 mln") are the
// ones that react to filters; the two country-count badges next to them do not
// — see the documented backend bug at the bottom of this file.
function kpiValues(page: Page): Locator {
  return page.locator(".text-base.font-bold.leading-tight");
}

async function moneyStats(page: Page): Promise<string[]> {
  const texts = await kpiValues(page).allTextContents();
  return texts.map((t) => t.trim()).filter((t) => t.startsWith("$"));
}

// Stat values are ru-RU locale-formatted and use narrow/no-break spaces
// (U+00A0, U+202F, U+2009) as thousand separators with "," as decimal mark.
function parseLocaleNumber(text: string): number | null {
  const normalized = text.replace(/[   ]/g, " ");
  const match = normalized.match(/-?\d[\d ]*(?:[.,]\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/ /g, "").replace(",", "."));
  return Number.isNaN(num) ? null : num;
}

// The KPI cards render as "$0 mln" placeholders until their request resolves,
// so waiting for the money row to be non-zero is what makes "unfiltered" a
// trustworthy baseline to compare a filtered run against.
async function waitForBaselineStats(page: Page) {
  await expect(kpiValues(page).first()).toBeVisible({ timeout: 30000 });
  await expect
    .poll(
      async () => {
        const nums = (await moneyStats(page)).map(parseLocaleNumber).filter((n): n is number => n !== null);
        return nums.length > 0 && nums.every((n) => n !== 0);
      },
      { timeout: 60000, message: "Analitika KPI stats never finished loading as non-zero" },
    )
    .toBe(true);
}

async function gotoAnalytics(page: Page) {
  await page.goto(`${BASE_URL}/analytics`);
  await expect(page.getByRole("button", { name: "Tozalash" })).toBeVisible({ timeout: 30000 });
  await waitForBaselineStats(page);
}

// Runs `action` and returns the query parameters of the first chart request it
// triggers that actually carries `param` — proof the filter reached the API
// rather than only repainting the sidebar.
async function captureFilterRequest(page: Page, param: string, action: () => Promise<void>): Promise<URLSearchParams> {
  const pending = page.waitForRequest(
    (request) => {
      if (!request.url().includes("/api/v1/companies/")) return false;
      return new URL(request.url()).searchParams.has(param);
    },
    { timeout: 45000 },
  );
  await action();
  return new URL((await pending).url()).searchParams;
}

test.describe("Analitika — Filtrlar panel", () => {
  test("Header dropdown — 'Asosiy sahifa' offers Analitika and Dashboard, and opens Analitika", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    const navDropdown = page.locator(".nav-control--primary");
    await expect(navDropdown).toBeVisible({ timeout: 30000 });
    await expect(navDropdown).toContainText("Asosiy sahifa");

    await navDropdown.click();

    const options = page.locator(".n-dropdown-option");
    await expect(options).toHaveCount(2);
    await expect(options).toHaveText(["Analitika", "Dashboard"]);

    await options.filter({ hasText: "Analitika" }).click();

    await expect(page).toHaveURL(/\/analytics/, { timeout: 30000 });
    await expect(page.getByRole("button", { name: "Tozalash" })).toBeVisible({ timeout: 30000 });
  });

  test("Panel renders every section and filter field", async ({ page }) => {
    await gotoAnalytics(page);

    for (const section of SECTIONS) {
      await expect(page.getByRole("button", { name: section, exact: true })).toBeVisible();
    }

    for (const { label } of SELECT_FILTERS) {
      await expect(filterSelect(page, label), `"${label}" select should render`).toBeVisible();
    }

    for (const { label } of TEXT_FILTERS) {
      await expect(filterInput(page, label), `"${label}" input should render`).toBeVisible();
    }
  });

  test("Sections collapse and expand", async ({ page }) => {
    await gotoAnalytics(page);

    // One representative field per section proves the body actually toggled.
    const probes: Record<(typeof SECTIONS)[number], Locator> = {
      Qidirish: filterInput(page, "STIR"),
      Joylashuv: filterSelect(page, "Viloyat"),
      "Bank va soha": filterSelect(page, "Soha"),
    };

    for (const section of SECTIONS) {
      const header = page.getByRole("button", { name: section, exact: true });
      const probe = probes[section];

      await expect(probe, `"${section}" should start expanded`).toBeVisible();

      await header.click();
      await expect(probe, `"${section}" should collapse`).toBeHidden();

      await header.click();
      await expect(probe, `"${section}" should expand again`).toBeVisible();
    }
  });

  for (const { label, param, valueKind } of SELECT_FILTERS) {
    test(`Select filter "${label}" applies as ?${param}`, async ({ page }) => {
      await gotoAnalytics(page);

      const select = filterSelect(page, label);
      await select.scrollIntoViewIfNeeded();
      await select.click();

      const options = openMenuOptions(page);
      await expect(options.first()).toBeVisible({ timeout: 30000 });
      const optionCount = await options.count();
      expect(optionCount, `"${label}" should offer at least one option`).toBeGreaterThan(0);

      const chosen = ((await options.first().textContent()) ?? "").trim();
      expect(chosen.length, `"${label}" option should have a label`).toBeGreaterThan(0);

      const params = await captureFilterRequest(page, param, async () => {
        await options.first().click();
        // Multi-selects keep the menu open after a pick; Escape closes both kinds.
        await page.keyboard.press("Escape");
      });

      const value = params.get(param);
      expect(value, `"${label}" should send a non-empty ${param}`).toBeTruthy();
      if (valueKind === "ids") {
        expect(value, `${param} should be a numeric id list`).toMatch(/^\d+(,\d+)*$/);
      } else {
        expect(value, `${param} should carry the chosen option's label`).toBe(chosen);
      }

      // The control should also show what was picked.
      await expect(select).toContainText(chosen);
    });
  }

  for (const { label, param, value } of TEXT_FILTERS) {
    test(`Text filter "${label}" applies as ?${param}`, async ({ page }) => {
      await gotoAnalytics(page);

      const input = filterInput(page, label);
      await input.scrollIntoViewIfNeeded();

      const params = await captureFilterRequest(page, param, async () => {
        await input.fill(value);
      });

      expect(params.get(param), `"${label}" should send ${param}=${value}`).toBe(value);
      await expect(input).toHaveValue(value);
    });
  }

  test("Viloyat multi-select — two regions are sent as one comma-separated list", async ({ page }) => {
    await gotoAnalytics(page);

    const select = filterSelect(page, "Viloyat");
    await select.scrollIntoViewIfNeeded();
    await select.click();

    const options = openMenuOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 30000 });
    expect(await options.count(), "need at least two regions to test multi-select").toBeGreaterThan(1);

    const first = ((await options.nth(0).textContent()) ?? "").trim();
    const second = ((await options.nth(1).textContent()) ?? "").trim();

    await options.nth(0).click();
    const params = await captureFilterRequest(page, "region_ids", async () => {
      await options.nth(1).click();
      await page.keyboard.press("Escape");
    });

    const ids = (params.get("region_ids") ?? "").split(",").filter(Boolean);
    expect(ids, "both selected regions should be sent").toHaveLength(2);

    await expect(select).toContainText(first);
    await expect(select).toContainText(second);
  });

  test("Viloyat filter narrows the KPI totals", async ({ page }) => {
    await gotoAnalytics(page);

    const baseline = (await moneyStats(page)).map(parseLocaleNumber);
    const baselineExport = baseline[0];
    expect(baselineExport, "unfiltered export total should parse").not.toBeNull();

    const select = filterSelect(page, "Viloyat");
    await select.scrollIntoViewIfNeeded();
    await select.click();

    const options = openMenuOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 30000 });

    await captureFilterRequest(page, "region_ids", async () => {
      await options.first().click();
      await page.keyboard.press("Escape");
    });

    // A single region is a strict subset of the country, so its export total
    // must settle below the unfiltered one.
    await expect
      .poll(
        async () => {
          const filtered = parseLocaleNumber((await moneyStats(page))[0] ?? "");
          return filtered !== null && filtered < (baselineExport as number);
        },
        { timeout: 60000, message: "export total never dropped below the unfiltered baseline" },
      )
      .toBe(true);
  });

  test("Unmatched STIR zeroes out every KPI total", async ({ page }) => {
    await gotoAnalytics(page);

    // A syntactically valid TIN that belongs to no exporter.
    await captureFilterRequest(page, "inn", async () => {
      await filterInput(page, "STIR").fill("200000000");
    });

    await expect
      .poll(
        async () => {
          const nums = (await moneyStats(page)).map(parseLocaleNumber).filter((n): n is number => n !== null);
          return nums.length > 0 && nums.every((n) => n === 0);
        },
        { timeout: 60000, message: "KPI totals never settled at zero for an unmatched STIR" },
      )
      .toBe(true);
  });

  test("Tozalash clears the applied filters and restores the baseline totals", async ({ page }) => {
    await gotoAnalytics(page);

    const baseline = await moneyStats(page);

    const select = filterSelect(page, "Viloyat");
    await select.scrollIntoViewIfNeeded();
    await select.click();
    const options = openMenuOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 30000 });
    const chosen = ((await options.first().textContent()) ?? "").trim();

    await captureFilterRequest(page, "region_ids", async () => {
      await options.first().click();
      await page.keyboard.press("Escape");
    });
    await expect(select).toContainText(chosen);

    // Reset must re-request the charts without the region parameter.
    const cleared = page.waitForRequest(
      (request) =>
        request.url().includes("/api/v1/companies/charts/") && !new URL(request.url()).searchParams.has("region_ids"),
      { timeout: 45000 },
    );
    await page.getByRole("button", { name: "Tozalash" }).click();
    await cleared;

    await expect(select).toContainText("Tanlash");
    await expect.poll(async () => moneyStats(page), { timeout: 60000 }).toEqual(baseline);
  });

  test(`Mahsulot "${PRODUCT}" filters the whole Analitika page to that product`, async ({ page }) => {
    await gotoAnalytics(page);
    const baseline = await moneyStats(page);

    const select = filterSelect(page, "Mahsulot");
    await select.scrollIntoViewIfNeeded();
    await select.click();

    const options = openMenuOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 30000 });

    // The catalog runs to hundreds of products and the menu has no search box
    // of its own — the select itself is filterable, so type to narrow it.
    await page.keyboard.type(PRODUCT, { delay: 40 });
    const option = options.filter({ hasText: new RegExp(`^${PRODUCT}$`, "i") }).first();
    await expect(option, `"${PRODUCT}" should be offered in the Mahsulot catalog`).toBeVisible({
      timeout: 15000,
    });

    // Record every chart request the pick triggers. Waiting on a single one
    // only proves the filter reached the API; collecting them all is what
    // proves the whole page re-queried for this product.
    const chartUrls: string[] = [];
    const collect = (request: { url: () => string }) => {
      if (request.url().includes("/api/v1/companies/charts/")) chartUrls.push(request.url());
    };
    page.on("request", collect);

    const params = await captureFilterRequest(page, "grouped_names", async () => {
      await option.click();
      await page.keyboard.press("Escape");
    });

    // 1. The product reaches the API under its own key, by name.
    expect(params.get("grouped_names"), `Mahsulot should send grouped_names=${PRODUCT}`).toBe(PRODUCT);

    // 2. The control shows what was picked.
    await expect(select).toContainText(PRODUCT);

    // 3. Every chart on the page — not just the one we waited for — re-requested
    //    scoped to this product.
    await expect
      .poll(() => chartUrls.length, {
        timeout: 30000,
        message: "expected the Analitika charts to re-request after picking a product",
      })
      .toBeGreaterThanOrEqual(5);
    page.off("request", collect);

    const unscoped = chartUrls
      .filter((url) => new URL(url).searchParams.get("grouped_names") !== PRODUCT)
      .map((url) => new URL(url).pathname);
    expect([...new Set(unscoped)], `every chart request should carry grouped_names=${PRODUCT}`).toEqual([]);

    // 4. The page is showing real numbers for this product, not a blank or
    //    zeroed board — the totals move off the unfiltered baseline and stay
    //    non-zero.
    await expect
      .poll(async () => moneyStats(page), {
        timeout: 60000,
        message: `KPI totals never changed after filtering to ${PRODUCT}`,
      })
      .not.toEqual(baseline);

    const totals = (await moneyStats(page)).map(parseLocaleNumber).filter((n): n is number => n !== null);
    expect(totals.length, `expected KPI money totals for ${PRODUCT}`).toBeGreaterThan(0);
    expect(totals.every((n) => n !== 0), `every ${PRODUCT} KPI total should be non-zero`).toBe(true);
  });

  // ── Former product bugs, now regression guards ───────────────────────────
  // Both were recorded as test.fail() on 2026-07-27 to document a confirmed
  // defect without turning the suite red. Playwright reports "expected to fail
  // but passed" the moment a bug is fixed, which is the signal to delete the
  // annotation rather than the test — and that is what happened to both of
  // them on 2026-07-31.

  test("Tozalash should also clear the text inputs", async ({ page }) => {
    // FIXED 2026-07-31. This documented a frontend state-sync bug found
    // 2026-07-27: "Tozalash" reset the filter state — the charts re-requested
    // without `name`/`inn`/etc. and the KPI totals returned to their unfiltered
    // values — but the text boxes kept displaying the old terms, so the sidebar
    // showed filters that were not applied until a page reload.
    //
    // The fix went unnoticed for a few days because this test could not reach
    // its assertion: it filled every TEXT_FILTERS field, and "Mahsulot" was
    // still listed there after it had become a select, so the test timed out
    // on a locator that no longer existed.

    await gotoAnalytics(page);

    for (const { label, value } of TEXT_FILTERS) {
      await filterInput(page, label).fill(value);
    }
    await expect(filterInput(page, "STIR")).toHaveValue("200000000");

    await page.getByRole("button", { name: "Tozalash" }).click();

    for (const { label } of TEXT_FILTERS) {
      await expect(filterInput(page, label), `"${label}" should be empty after Tozalash`).toHaveValue("");
    }
  });

  test("Country-count badges should respond to the Davlat filter", async ({ page }) => {
    // FIXED 2026-07-31. This documented a backend bug found 2026-07-27:
    // GET /api/v1/companies/charts/countries-count ignored every filter
    // parameter, so filtering to a single country still answered
    // {"export_countries_count":117,"import_countries_count":151} while the
    // money totals on the same cards correctly dropped to $0. The endpoint now
    // respects the filters — the test reported "expected to fail, but passed",
    // so its test.fail() has been removed and this is a live regression guard.

    await gotoAnalytics(page);

    const countBadges = async () =>
      (await kpiValues(page).allTextContents()).map((t) => t.trim()).filter((t) => /^\d+$/.test(t));

    const before = await countBadges();
    expect(before.length, "expected the two country-count badges").toBeGreaterThan(0);

    const select = filterSelect(page, "Davlat");
    await select.scrollIntoViewIfNeeded();
    await select.click();
    const options = openMenuOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 30000 });

    await captureFilterRequest(page, "country_ids", async () => {
      await options.first().click();
      await page.keyboard.press("Escape");
    });

    await expect
      .poll(countBadges, { timeout: 45000, message: "country-count badges never changed" })
      .not.toEqual(before);
  });
});
