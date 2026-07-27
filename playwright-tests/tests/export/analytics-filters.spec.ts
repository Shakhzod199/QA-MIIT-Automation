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
//   Section       Label            Query parameter
//   ─────────────────────────────────────────────────
//   Qidirish      Oylar kesimida   months
//                 STIR             inn
//                 Korxona nomi     name
//                 Mahsulot         product_name
//                 TN VED           tnved
//   Joylashuv     Viloyat          region_ids
//                 Tuman            district_ids
//                 Davlat           country_ids
//   Bank va soha  Soha             sphere_ids
//                 Bank             bank_ids
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

const SELECT_FILTERS = [
  { label: "Oylar kesimida", param: "months" },
  { label: "Viloyat", param: "region_ids" },
  { label: "Tuman", param: "district_ids" },
  { label: "Davlat", param: "country_ids" },
  { label: "Soha", param: "sphere_ids" },
  { label: "Bank", param: "bank_ids" },
] as const;

const TEXT_FILTERS = [
  { label: "STIR", param: "inn", value: "200000000" },
  { label: "Korxona nomi", param: "name", value: "AGRO" },
  { label: "Mahsulot", param: "product_name", value: "paxta" },
  { label: "TN VED", param: "tnved", value: "5201" },
] as const;

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

  for (const { label, param } of SELECT_FILTERS) {
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
      expect(value, `${param} should be a numeric id list`).toMatch(/^\d+(,\d+)*$/);

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

  // ── Known product bugs ───────────────────────────────────────────────────
  // Both are marked test.fail(): they document confirmed defects without
  // turning the suite red, and Playwright will report "expected to fail but
  // passed" the moment either is fixed — which is the signal to delete the
  // annotation rather than the test.

  test("Tozalash should also clear the text inputs", async ({ page }) => {
    // BUG (found 2026-07-27): "Tozalash" resets the filter state — the charts
    // re-request without `name`/`inn`/etc. and the KPI totals return to their
    // unfiltered values — but the four text boxes keep displaying the old
    // terms. The sidebar then shows filters that are not applied, and only a
    // page reload clears them. Frontend state-sync bug, not a test bug.
    test.fail();

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
    // BUG (found 2026-07-27): GET /api/v1/companies/charts/countries-count
    // ignores every filter parameter. Filtering down to a single country still
    // answers {"export_countries_count":117,"import_countries_count":151}
    // while the money totals correctly drop to $0, so the cards contradict
    // themselves. Backend bug — the endpoint drops the filters server-side.
    test.fail();

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
