import { test, expect, type Locator } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./helpers";

test.use({
  // Reuse the session captured once by auth.setup.ts instead of logging in per test.
  storageState: AUTH_FILE,
  // Several KPI widgets (e.g. Transport's RouteSummaryStack) only render on desktop.
  viewport: { width: 1920, height: 1080 },
});

// Stat values are ru-RU locale-formatted, e.g. "$ 4 418,9 mln", "5 269 ta",
// "72,9 %", "-$1 054,0 mln". Note ICU uses narrow/no-break spaces (U+00A0,
// U+202F, U+2009) as thousand separators and "," as the decimal mark.
function parseLocaleNumber(text: string): number | null {
  const normalized = text.replace(/[   ]/g, " ");
  const match = normalized.match(/-?\d[\d ]*(?:[.,]\d+)?/);
  if (!match) return null;
  const raw = match[0].replace(/ /g, "").replace(",", ".");
  const num = parseFloat(raw);
  return Number.isNaN(num) ? null : num;
}

async function expectStatsNonZero(stats: Locator, label: string) {
  await expect(stats.first()).toBeVisible({ timeout: 15000 });

  // Widgets briefly render 0/placeholder values until their API call resolves.
  // Wait (web-first, no networkidle) until every numeric stat has loaded non-zero.
  await expect
    .poll(
      async () => {
        const nums = (await stats.allTextContents()).map(parseLocaleNumber).filter((n): n is number => n !== null);
        return nums.length > 0 && nums.every((n) => n !== 0);
      },
      { timeout: 20000, message: `${label} stats never finished loading as non-zero` },
    )
    .toBe(true);

  // Re-read and assert explicitly so a persistently-zero value names itself, and
  // guard that we actually parsed something (a stale selector must not pass silently).
  const texts = await stats.allTextContents();
  let checked = 0;
  for (const text of texts) {
    const value = parseLocaleNumber(text);
    if (value === null) continue;
    expect(value, `${label} stat "${text.trim()}" should not be 0`).not.toBe(0);
    checked += 1;
  }
  expect(checked, `no numeric "${label}" stats were parsed — selector may be stale`).toBeGreaterThan(0);
}

test.describe("Stat numbers are non-zero - export.miit.uz", () => {
  test("Export page header stats are non-zero", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expectStatsNonZero(page.locator(".export-header-stats .leading-none"), "Export header");
  });

  test("Import page summary stats are non-zero", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/import`);
    await expectStatsNonZero(page.locator(".leading-none.tracking-tight"), "Import summary");
  });

  test("Devitorka (debts) page summary stats are non-zero", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/debts`);
    await expectStatsNonZero(page.locator(".leading-none.tracking-tight"), "Devitorka summary");
  });

  test("Transport page route summary stats are non-zero", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/transport`);
    await expectStatsNonZero(page.locator(".min-w-60 .text-lg.font-semibold"), "Transport route summary");
  });

  test("Dashboard preview stats are non-zero", async ({ page }) => {
    await page.goto(`${BASE_URL}/app/dashboard`);
    await expectStatsNonZero(page.locator(".text-blue-500.font-bold"), "Dashboard preview");
  });

  test("Analitika (analytics) KPI cards are non-zero", async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`);
    await expectStatsNonZero(page.locator(".text-lg.font-bold"), "Analitika KPI");
  });
});
