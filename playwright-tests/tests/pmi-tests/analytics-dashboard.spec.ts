import { test, expect, type Page, type BrowserContext, type Request } from "@playwright/test";
import { login } from "./helpers";

// ---------------------------------------------------------------------------
// PMI "Dashbord" (main page -> /app/analytics).
//
// Every number on this page is sourced from the PMT-MIIT integration — PMI
// itself contributes no data here. Four endpoints feed the whole screen:
//
//   .../project/pmt-miit/statistics/by-content    -> the KPI tiles
//   .../project/pmt-miit/statistics/indicators    -> the 12 block headlines
//   .../project/pmt-miit/statistics/by-initiator  -> each block's "Tashabbuskor" table
//   .../project/pmt-miit/statistics/by-region     -> each block's "Hudud" table
//
// So this spec does two things: prove the data really does all come from that
// integration (nothing is quietly served from PMI's own tables), and prove the
// page renders every value the integration returned, unmangled.
//
// The whole screen is captured once in beforeAll — one login, one navigation —
// and the individual tests are then pure assertions over that capture. Hence
// serial mode: they share a page, and if the capture fails they should all fail.
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

const ENDPOINTS = {
  byContent: "/project/pmt-miit/statistics/by-content",
  indicators: "/project/pmt-miit/statistics/indicators",
  byInitiator: "/project/pmt-miit/statistics/by-initiator",
  byRegion: "/project/pmt-miit/statistics/by-region",
} as const;

/**
 * Session/infra traffic that can fire at any moment (token refresh, the
 * notification poll, icon chunks). Not data, so it must not count against the
 * "everything comes from pmt-miit" assertion.
 */
const NON_DATA_TRAFFIC = [
  /\/test\/refresh\b/,
  /\/test\/login\b/,
  /\/v2\/user\/me\b/,
  /\/notification\/list\b/,
  /\/sso\/devices\b/,
  /\/_nuxt_icon\//,
];

/** by-content key -> the Uzbek label its KPI tile is rendered under. */
const TILE_LABELS: Record<string, string> = {
  total: "Korxona soni",
  projects: "Loyihalar soni",
  power: "Yillik quvvat",
  manufacture: "Ishlab chiqarish",
  workspace: "Ish o'rni",
  export: "Eksport",
  budget: "Byudjetga tushum",
  // NB: `amount` is deliberately missing — the page renders no tile for it.
  // See "every by-content statistic has a KPI tile" below.
};

/**
 * The 12 metric blocks, in the order `indicators` returns them (the page
 * renders them in exactly that order). `title` guards against a silent
 * reorder; `rowKey` exists because the two endpoints disagree on one name —
 * `indicators` calls it "ipjc" while the table rows call it "ip".
 */
const BLOCKS: { key: string; rowKey?: string; title: string | RegExp; fourColumn?: true }[] = [
  { key: "manufacture", title: "Ishlab chiqarish", fourColumn: true },
  { key: "export", title: "Eksport", fourColumn: true },
  { key: "workspace", title: "Ish o'rni", fourColumn: true },
  { key: "budget", title: "Byudjetga tushumlar", fourColumn: true },
  { key: "icor", title: /\(ICOR\)/ },
  { key: "ee", title: /\(EE\)/ },
  { key: "gva", title: /\(GVA\)/ },
  { key: "ipjc", rowKey: "ip", title: /\(IPJC\)/ },
  { key: "pp", title: /\(PP\)/ },
  { key: "ep", title: /\(EP\)/ },
  { key: "ic", title: /\(IC\)/ },
  { key: "va", title: /VA Share/ },
];

const FOUR_COLUMN_KEYS = new Set(BLOCKS.filter((b) => b.fourColumn).map((b) => b.key));

const ALL_KEYS = BLOCKS.map((b) => b.key);

/**
 * Blocks are keyed by their heading rather than their position, so that a
 * reordered or missing block fails the block-presence tests directly instead
 * of silently shifting every index after it.
 */
function keyBlocksByMetric(blocks: BlockCapture[]): Map<string, BlockCapture> {
  const keyed = new Map<string, BlockCapture>();
  for (const captured of blocks) {
    const def = BLOCKS.find((b) =>
      typeof b.title === "string" ? captured.title === b.title : b.title.test(captured.title)
    );
    expect(def, `block "${captured.title}" does not match any known metric`).toBeTruthy();
    keyed.set(def!.key, captured);
  }
  return keyed;
}

interface Amount {
  plan: number;
  fact: number;
  value: number;
}
interface StatRow {
  name: string;
  powerValue: number;
  [metric: string]: Amount | number | string | unknown;
}
interface BlockCapture {
  title: string;
  activeTab: string;
  summary: string;
  rows: Record<string, string>[];
}

/** Numbers render with space thousands separators (regular, NBSP or narrow NBSP). */
function toNumber(text: string): number {
  return parseFloat(text.replace(/[\s  ]/g, "").replace(",", "."));
}

/** Pulls the first number out of a formatted fragment like "$ 210 ming" or "2 024 mln $". */
function firstNumber(text: string): number {
  const match = text.match(/-?\d[\d\s  ]*(?:[.,]\d+)?/);
  expect(match, `no number found in ${JSON.stringify(text)}`).not.toBeNull();
  return toNumber(match![0]);
}

/**
 * Block headlines come in two shapes:
 *   plan/fact blocks -> "2025 yil 331 trln. so'm2026 yil 384 trln. so'm"
 *   ratio blocks     -> "Ko'rsatkich 303 so'm/MJ"  (fact only)
 * The year labels are dynamic, so split on them rather than hardcoding.
 */
function parseSummary(summary: string): number[] {
  const parts = summary
    .split(/20\d{2}\s*yil/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return [firstNumber(parts[0]), firstNumber(parts[1])];
  return [firstNumber(summary.replace(/^Ko['’ʻ]rsatkich/, ""))];
}

function readDashboard(page: Page): Promise<{ tiles: { label: string; value: string; unit: string }[]; blocks: BlockCapture[] }> {
  return page.evaluate(() => {
    const txt = (n: Element | null | undefined) => (n?.textContent ?? "").replace(/\s+/g, " ").trim();

    // The metric blocks live in swiper slides too, so match on a slide's
    // contents rather than on the slide class alone.
    const tiles = Array.from(document.querySelectorAll(".swiper-slide"))
      .filter((s) => s.querySelector("span.text-toned") && s.querySelector("span.tabular-nums"))
      .map((s) => ({
        label: txt(s.querySelector("span.text-toned")),
        value: txt(s.querySelector("span.tabular-nums")),
        unit: txt(s.querySelector("span.tabular-nums span")),
      }));

    // A metric block with no data for the period renders "Bu chorak bo'yicha
    // ma'lumot shakillanmagan" and no <tbody> at all. It is still a block, so
    // match on the tabs alone and let `rows` come back empty — filtering on
    // tbody here would make an empty block indistinguishable from a missing one.
    const blocks = Array.from(document.querySelectorAll(".n-card"))
      .filter((c) => c.querySelector(".n-tabs"))
      .map((b) => ({
        title: txt(b.querySelector(".n-card-header__main")).replace(/Tashabbuskor\s*Hudud\s*$/, "").trim(),
        activeTab: txt(b.querySelector(".n-tabs-tab--active")),
        summary: txt(b.querySelector(".n-card-content")).split("T/r")[0],
        rows: Array.from(b.querySelectorAll("tbody tr"))
          .map((tr) => {
            const cells: Record<string, string> = {};
            tr.querySelectorAll("td[data-col-key]").forEach((td) => {
              cells[td.getAttribute("data-col-key")!] = txt(td);
            });
            return cells;
          })
          .filter((cells) => cells.name),
      }));

    return { tiles, blocks };
  });
}

// --- captured once in beforeAll -------------------------------------------
let context: BrowserContext;
let page: Page;
let landedUrl: string;
let dataCallUrls: string[];
let byContent: { statistics: { key: string; measurement: string; amount: Amount }[] };
let indicators: { statistics: { key: string; measurement: string; plan: number; fact: number }[] };
let byInitiator: { results: StatRow[] };
let byRegion: { results: StatRow[] };
let byRegionRequest: Request;
let selectedYear: string;
let byRegionYear: string;
let tashabbuskor: BlockCapture[];
let hudud: BlockCapture[];
let tiles: { label: string; value: string; unit: string }[];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);

  context = await browser.newContext();
  page = await context.newPage();

  await login(page);
  // Let the main page finish its own fetches (project list, the country map,
  // ...) before we start recording. Navigating to the dashboard is a
  // client-side route change, so those requests are not cancelled and would
  // otherwise land after the click and look like dashboard traffic.
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});

  const requestedUrls: string[] = [];
  const waitFor = (fragment: string) =>
    page.waitForResponse((r) => r.url().includes(fragment) && r.request().method() === "GET", { timeout: 90_000 });

  const pending = {
    byContent: waitFor(ENDPOINTS.byContent),
    indicators: waitFor(ENDPOINTS.indicators),
    byInitiator: waitFor(ENDPOINTS.byInitiator),
    byRegion: waitFor(ENDPOINTS.byRegion),
  };

  // Only count traffic from the click onward — the main page legitimately
  // calls PMI's own endpoints before we ever navigate to the dashboard.
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requestedUrls.push(r.url());
  });

  await page.getByRole("button", { name: "Dashbord", exact: true }).first().click();

  const responses = {
    byContent: await pending.byContent,
    indicators: await pending.indicators,
    byInitiator: await pending.byInitiator,
    byRegion: await pending.byRegion,
  };
  for (const [name, res] of Object.entries(responses)) {
    expect(res.status(), `${name} should return 200`).toBe(200);
  }

  landedUrl = page.url();
  byContent = (await responses.byContent.json()).data;
  indicators = (await responses.indicators.json()).data;
  byInitiator = (await responses.byInitiator.json()).data;
  byRegion = (await responses.byRegion.json()).data;
  byRegionRequest = responses.byRegion.request();

  selectedYear = new URL(responses.byInitiator.url()).searchParams.get("year") ?? "";
  byRegionYear = new URL(responses.byRegion.url()).searchParams.get("year") ?? "";

  // Blocks lazy-mount on scroll.
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(500);
  }
  await expect(page.locator(".n-card").filter({ has: page.locator(".n-tabs") })).toHaveCount(
    indicators.statistics.length,
    { timeout: 30_000 }
  );

  const captured = await readDashboard(page);
  tashabbuskor = captured.blocks;
  tiles = captured.tiles;
  dataCallUrls = requestedUrls.filter((u) => !NON_DATA_TRAFFIC.some((re) => re.test(u)));

  // Switch every block to its "Hudud" tab. This fires no refetch — by-region
  // is already loaded — so the tables repaint from the payload we captured.
  // Blocks are re-resolved on each iteration rather than indexed up front, so
  // that any reordering or remounting on tab switch cannot shift cached indices.
  expect(await page.locator(".n-tabs-tab", { hasText: /^Hudud$/ }).count()).toBe(indicators.statistics.length);
  const stillOnInitiator = () =>
    page.locator(".n-card").filter({ has: page.locator(".n-tabs-tab--active", { hasText: /^Tashabbuskor$/ }) });
  for (let guard = 0; guard <= indicators.statistics.length; guard++) {
    if ((await stillOnInitiator().count()) === 0) break;
    await stillOnInitiator().first().locator(".n-tabs-tab", { hasText: /^Hudud$/ }).click();
  }
  await expect(stillOnInitiator()).toHaveCount(0, { timeout: 15_000 });
  hudud = (await readDashboard(page)).blocks;
});

test.afterAll(async () => {
  await context?.close();
});

// --- navigation & provenance ----------------------------------------------

test("the Dashbord button lands on /app/analytics", async () => {
  expect(landedUrl).toContain("/app/analytics");
});

test("every data call on the dashboard goes to the pmt-miit integration", async () => {
  const strays = dataCallUrls.filter((u) => !u.includes("/project/pmt-miit/"));
  expect(strays, `these are not pmt-miit calls:\n${strays.join("\n")}`).toEqual([]);

  const called = new Set(dataCallUrls.map((u) => new URL(u).pathname));
  for (const fragment of Object.values(ENDPOINTS)) {
    expect([...called].some((p) => p.includes(fragment)), `${fragment} was never called`).toBe(true);
  }
});

test("each pmt-miit endpoint returns a populated payload", async () => {
  expect(byContent.statistics.length).toBeGreaterThan(0);
  expect(indicators.statistics.length).toBe(BLOCKS.length);
  expect(byInitiator.results.length).toBeGreaterThan(0);
  expect(byRegion.results.length).toBeGreaterThan(0);
});

// --- KPI tiles -------------------------------------------------------------

test("KPI tiles render the values by-content returned", async () => {
  for (const stat of byContent.statistics) {
    const label = TILE_LABELS[stat.key];
    if (!label) continue; // `amount` — covered by the test below

    const match = tiles.find((t) => t.label === label);
    expect(match, `no KPI tile labelled "${label}" (key "${stat.key}")`).toBeTruthy();
    // Tiles round to whole numbers (e.g. budget 4.5 renders as "5"), so allow
    // half a unit rather than replicating the frontend's rounding mode.
    expect(
      Math.abs(firstNumber(match!.value) - stat.amount.fact),
      `tile "${label}" shows ${match!.value}, by-content says ${stat.amount.fact}`
    ).toBeLessThanOrEqual(0.5);
    expect(match!.unit).toBe(stat.measurement);
  }
});

// KNOWN BUG: by-content returns 8 statistics but the page renders only 7 KPI
// tiles — `amount` (total investment volume, ~70.5 mlrd $) is dropped and
// appears nowhere on the dashboard. Asserting the correct behaviour so this
// goes green by itself once a tile is added.
test.fail("every by-content statistic has a KPI tile", async () => {
  expect(tiles.length).toBe(byContent.statistics.length);
});

// --- metric blocks ---------------------------------------------------------

test("the 12 metric blocks render in the order indicators returns them", async () => {
  expect(tashabbuskor.length).toBe(BLOCKS.length);
  BLOCKS.forEach((block, i) => {
    expect(indicators.statistics[i].key, `indicators[${i}] should be "${block.key}"`).toBe(block.key);
    if (typeof block.title === "string") {
      expect(tashabbuskor[i].title).toBe(block.title);
    } else {
      expect(tashabbuskor[i].title).toMatch(block.title);
    }
  });
});

test("block headlines render the values indicators returned", async () => {
  BLOCKS.forEach((block, i) => {
    const stat = indicators.statistics[i];
    const numbers = parseSummary(tashabbuskor[i].summary);
    const expected = block.fourColumn ? [stat.plan, stat.fact] : [stat.fact];
    expect(numbers.length, `block "${block.key}" headline: ${tashabbuskor[i].summary}`).toBe(expected.length);
    numbers.forEach((actual, j) => {
      // Headlines round like the tiles do (icor keeps a decimal, pp does not).
      expect(
        Math.abs(actual - expected[j]),
        `block "${block.key}" headline shows ${actual}, indicators says ${expected[j]}`
      ).toBeLessThanOrEqual(0.5);
    });
  });
});

test("the Tashabbuskor view shows a block for all 12 metrics", async () => {
  expect([...keyBlocksByMetric(tashabbuskor).keys()].sort()).toEqual([...ALL_KEYS].sort());
});

test("Tashabbuskor tables match by-initiator row for row", async () => {
  assertValues(keyBlocksByMetric(tashabbuskor), byInitiator.results, "Tashabbuskor");
});

// GVA used to be carved out here as a known bug: the block dropped two
// initiators ("Olmaliq KMK AJ" and the Qizilmiya... uyushmasi) that had a
// non-zero gva.fact, so its totals could not be reconciled against its rows.
// by-initiator now returns gva as 0 for every initiator, so the block renders
// its empty state and the bug is not observable. It is folded back into the
// assertion below rather than left as a test.fail that cannot fail — if the
// drop returns once GVA has data again, this test reports it directly.
test("Tashabbuskor tables list every initiator that has data for the metric", async () => {
  assertRowSets(keyBlocksByMetric(tashabbuskor), byInitiator.results, "Tashabbuskor");
});

// --- Hudud ----------------------------------------------------------------

test("Hudud tables faithfully render the by-region payload the page fetched", async () => {
  hudud.forEach((block) => expect(block.activeTab, `block "${block.title}"`).toBe("Hudud"));
  const keyed = keyBlocksByMetric(hudud);
  assertValues(keyed, byRegion.results, "Hudud");
  assertRowSets(keyed, byRegion.results, "Hudud");
});

// All 12 blocks survive the switch to Hudud. They do not all show a table:
// at year=2025 by-region returns ee and ip as 0 for all 14 regions, so those
// two render their empty state — a visible consequence of the wrong-year
// fetch asserted below, not a missing block. (This was previously marked as a
// known bug claiming the blocks vanished; they never did. The spec's own
// capture filtered out any block without a <tbody>, which made an empty block
// look like a deleted one.)
test("the Hudud view shows a block for all 12 metrics", async () => {
  expect([...keyBlocksByMetric(hudud).keys()].sort()).toEqual([...ALL_KEYS].sort());
});

// KNOWN BUG: the page requests by-region with year=2025 while the period
// selector — and every other call on the screen — is on 2026. So every Hudud
// table shows last year's figures under a "2026 yil" header, and disagrees
// with the Tashabbuskor tab of the very same block.
test.fail("Hudud tables are fetched for the period the dashboard is showing", async () => {
  expect(byRegionYear, `by-initiator used year=${selectedYear}, by-region used year=${byRegionYear}`).toBe(
    selectedYear
  );
});

// Same bug, asserted on the rendered values rather than the query string:
// re-fetch by-region for the period actually selected and expect the tables
// to match that instead of the 2025 payload they currently show.
test.fail("Hudud tables match by-region for the selected period", async () => {
  const url = new URL(byRegionRequest.url());
  url.searchParams.set("year", selectedYear);
  const headers = await byRegionRequest.allHeaders();
  const res = await page.request.get(url.toString(), {
    headers: headers.authorization ? { authorization: headers.authorization } : undefined,
  });
  expect(res.status()).toBe(200);
  const expected = (await res.json()).data as { results: StatRow[] };
  assertValues(keyBlocksByMetric(hudud), expected.results, "Hudud");
});

// --- shared table assertion ------------------------------------------------

/**
 * The rows a block should list: those that have any data for its metric, i.e.
 * a non-zero plan or fact. Ishlab chiqarish is the exception — it is keyed on
 * the row's annual capacity (powerValue), the same value its first column
 * binds (see assertValues below), so its table lists every row with a capacity
 * even when this period's output is still 0.
 */
function rowsWithData(results: StatRow[], block: (typeof BLOCKS)[number]): string[] {
  const rowKey = block.rowKey ?? block.key;
  return results
    .filter((r) => {
      if (block.key === "manufacture") return r.powerValue !== 0;
      const metric = r[rowKey] as Amount;
      return metric.plan !== 0 || metric.fact !== 0;
    })
    .map((r) => r.name);
}

/**
 * Tables are filtered: a block lists exactly the rows that have data for its
 * own metric. Asserting that set catches rows the page drops silently — this
 * is what caught the GVA block dropping two initiators that had a non-zero
 * fact. Kept separate from the value check so one buggy block does not mask
 * value regressions in the other eleven.
 */
function assertRowSets(blocks: Map<string, BlockCapture>, results: StatRow[], tab: string) {
  BLOCKS.forEach((block) => {
    const captured = blocks.get(block.key);
    if (!captured) return; // presence is asserted separately
    expect(
      new Set(captured.rows.map((r) => r.name)),
      `${tab} / ${block.key}: rendered rows differ from the rows that have data`
    ).toEqual(new Set(rowsWithData(results, block)));
  });
}

/**
 * Compares every rendered cell against its payload row, matched by name.
 *
 * Column shapes differ. The four plan/fact blocks render `powerValue` + `fact`
 * columns; the eight ratio blocks render a single `value` column.
 */
function assertValues(blocks: Map<string, BlockCapture>, results: StatRow[], tab: string) {
  const byName = new Map(results.map((r) => [r.name, r]));

  BLOCKS.forEach((block) => {
    const captured = blocks.get(block.key);
    if (!captured) return; // presence is asserted separately
    const rowKey = block.rowKey ?? block.key;
    const rendered = captured.rows;
    const label = `${tab} / ${block.key}`;

    if (rendered.length === 0) {
      // The block rendered its empty state. That is only correct if the
      // payload really has nothing for this metric this period.
      expect(
        rowsWithData(results, block),
        `${label}: table is empty but the payload has rows for this metric`
      ).toEqual([]);
      return;
    }

    for (const row of rendered) {
      const payload = byName.get(row.name);
      expect(payload, `${label}: "${row.name}" is not in the payload at all`).toBeTruthy();
      const metric = payload![rowKey] as Amount;

      if (FOUR_COLUMN_KEYS.has(block.key)) {
        // The first column is the metric's plan everywhere except Ishlab
        // chiqarish, which binds the row's annual capacity (powerValue)
        // instead. Its header still reads "2025 yil" — that label looks
        // wrong, but the value is a deliberate capacity-vs-output comparison,
        // so it is asserted as-is. Worth confirming with the product owner.
        const expectedFirst = block.key === "manufacture" ? payload!.powerValue : metric.plan;
        expect(toNumber(row.powerValue), `${label} / ${row.name}: first column`).toBe(expectedFirst);
        expect(toNumber(row.fact), `${label} / ${row.name}: second column`).toBe(metric.fact);
      } else {
        // Ratio blocks show the pre-computed `value`, falling back to `fact`
        // when the backend leaves `value` at 0 (e.g. ep / Energetika
        // vazirligi: value 0, fact 11.2 -> the table shows 11.2).
        expect(toNumber(row.value), `${label} / ${row.name}: value column`).toBe(metric.value || metric.fact);
      }
    }
  });
}
