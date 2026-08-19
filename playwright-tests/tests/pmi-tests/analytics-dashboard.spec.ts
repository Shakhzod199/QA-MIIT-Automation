import { test, expect, type Page, type BrowserContext, type Request } from "@playwright/test";
import { AUTH_FILE, gotoDashboard } from "./helpers";

// ---------------------------------------------------------------------------
// PMI "Dashbord" -> Loyiha boshqaruvi -> "Yakunlangan loyihalar"
// (/app/analytics?tab=completed_projects).
//
// This screen moved twice in one redesign, so the navigation is spelled out
// here. "Dashbord" used to be a plain button that navigated straight to
// /app/analytics; it is now a dropdown offering "Loyiha boshqaruvi"
// (-> /app/analytics) and "Umumiy dashboard" (-> /app/pms, a different page
// entirely). /app/analytics then defaults to a PMI-native portfolio view, and
// the PMT-MIIT dashboard this spec covers is behind its "Yakunlangan
// loyihalar" tab.
//
// Every number on that tab is sourced from the PMT-MIIT integration — PMI
// itself contributes no data here. These endpoints feed the screen:
//
//   .../project/pmt-miit/statistics/by-content    -> the KPI tiles
//   .../project/pmt-miit/statistics/indicators    -> the 12 block headlines
//   .../project/pmt-miit/statistics/by-network    -> each block's "Tarmoq" table
//   .../project/pmt-miit/statistics/by-region     -> each block's "Hudud" table
//   .../project/pmt-miit/statistics/by-initiator  -> the TOP-5 rating card
//
// The per-block tabs used to be "Tashabbuskor"/"Hudud" fed by by-initiator and
// by-region. They are now "Tarmoq"/"Hudud" fed by by-network and by-region;
// by-initiator is still fetched, but only for a rating card this spec does not
// assert over, so it is checked for provenance and payload only.
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

// NB: byRegion does not collide with the roadmap card's
// /project/pmt-miit/roadmap/statistics/by-region-organization — the "roadmap/"
// segment sits between the prefix and the fragment, so the substring match
// below cannot confuse the two.
const ENDPOINTS = {
  byContent: "/project/pmt-miit/statistics/by-content",
  indicators: "/project/pmt-miit/statistics/indicators",
  byInitiator: "/project/pmt-miit/statistics/by-initiator",
  byRegion: "/project/pmt-miit/statistics/by-region",
  byNetwork: "/project/pmt-miit/statistics/by-network",
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

/** An /api/ call that carries page data, as opposed to session/infra noise. */
function isDataCall(url: string): boolean {
  return url.includes("/api/") && !NON_DATA_TRAFFIC.some((re) => re.test(url));
}

/**
 * Resolves once the page has issued no data call for `quietMs`.
 *
 * This exists because waitForLoadState("networkidle") cannot do the job here:
 * login() lands on /app/dashboard via a client-side route change, so the last
 * *document* load is still /auth — long finished — and networkidle returns in
 * about 1ms without waiting for the dashboard's own XHRs. Those then fire a
 * few ms later, land inside the recording window, and get counted as dashboard
 * traffic, which failed the pmt-miit provenance assertion with four strays
 * (general/statistics, project/list, additional/statistics,
 * countries-map-statistics) that belong to the main page.
 */
async function waitForDataQuiet(page: Page, quietMs = 2000, timeoutMs = 60_000): Promise<void> {
  let lastCall = Date.now();
  const bump = (r: Request) => {
    if (isDataCall(r.url())) lastCall = Date.now();
  };
  page.on("request", bump);
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && Date.now() - lastCall < quietMs) {
      await page.waitForTimeout(100);
    }
  } finally {
    page.off("request", bump);
  }
}

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
        title: txt(b.querySelector(".n-card-header__main")).replace(/Tarmoq\s*Hudud\s*$/, "").trim(),
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
let byNetwork: { results: StatRow[] };
let tarmoq: BlockCapture[];
let hudud: BlockCapture[];
let tiles: { label: string; value: string; unit: string }[];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);

  // This spec drives its own context rather than the per-test `page` fixture,
  // so the project-level storageState does not apply automatically — load the
  // cached session explicitly.
  context = await browser.newContext({ storageState: AUTH_FILE });
  page = await context.newPage();

  await gotoDashboard(page);
  // Let the main page finish its own fetches (project list, the country map,
  // ...) before we start recording. Navigating to the dashboard is a
  // client-side route change, so those requests are not cancelled and would
  // otherwise land after the click and look like dashboard traffic.
  await waitForDataQuiet(page);

  // Step 1: the Dashbord dropdown -> Loyiha boshqaruvi -> /app/analytics.
  // Clicking "Dashbord" no longer navigates; it opens a menu.
  await page.getByRole("button", { name: "Dashbord", exact: true }).first().click();
  await page.getByText("Loyiha boshqaruvi", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/app\/analytics/, { timeout: 30_000 });

  // /app/analytics opens on its own PMI-native portfolio view, which issues
  // PMI endpoints (general/statistics, step/statistics, dashboard/region-
  // statistics). Let those finish BEFORE recording, so they are not counted
  // against the "everything on this tab comes from pmt-miit" assertion.
  await waitForDataQuiet(page);

  const requestedUrls: string[] = [];
  const waitFor = (fragment: string) =>
    page.waitForResponse((r) => r.url().includes(fragment) && r.request().method() === "GET", { timeout: 90_000 });

  const pending = {
    byContent: waitFor(ENDPOINTS.byContent),
    indicators: waitFor(ENDPOINTS.indicators),
    byInitiator: waitFor(ENDPOINTS.byInitiator),
    byRegion: waitFor(ENDPOINTS.byRegion),
    byNetwork: waitFor(ENDPOINTS.byNetwork),
  };

  // Attribute each call to the tab that was active when it was ISSUED rather
  // than to a window of wall-clock time: only record once the URL carries
  // tab=completed_projects, so a late-firing call from the portfolio view
  // cannot be misread as a stray on this tab.
  page.on("request", (r) => {
    if (r.url().includes("/api/") && page.url().includes("tab=completed_projects")) {
      requestedUrls.push(r.url());
    }
  });

  // Step 2: open the "Yakunlangan loyihalar" tab — the PMT-MIIT dashboard.
  await page.getByRole("button", { name: "Yakunlangan loyihalar", exact: true }).click();

  const responses = {
    byContent: await pending.byContent,
    indicators: await pending.indicators,
    byInitiator: await pending.byInitiator,
    byRegion: await pending.byRegion,
    byNetwork: await pending.byNetwork,
  };
  for (const [name, res] of Object.entries(responses)) {
    expect(res.status(), `${name} should return 200`).toBe(200);
  }

  landedUrl = page.url();
  byContent = (await responses.byContent.json()).data;
  indicators = (await responses.indicators.json()).data;
  byInitiator = (await responses.byInitiator.json()).data;
  byRegion = (await responses.byRegion.json()).data;
  byNetwork = (await responses.byNetwork.json()).data;

  // Step 3: the "Yakunlangan loyihalar" tab opens on its "Korxonalar reytingi"
  // sub-view (TOP-5 rating, active/inactive enterprise cards). The 12 metric
  // blocks belong to the sibling "Loyihalar natijalari" sub-view: they mount
  // into the DOM either way, but their container stays display:none until that
  // sub-view is selected.
  //
  // This click is not optional. readDashboard() reads through page.evaluate,
  // which returns text from hidden nodes just as happily as visible ones, so
  // without it the spec captures — and asserts against — an invisible panel,
  // and the Hudud tab switch below then hangs until the hook times out,
  // because a display:none tab never becomes clickable.
  await page.getByText("Loyihalar natijalari", { exact: true }).first().click();
  const anyBlock = page.locator(".n-card").filter({ has: page.locator(".n-tabs") }).first();
  await expect(anyBlock, "the Loyihalar natijalari sub-view never became visible").toBeVisible({
    timeout: 30_000,
  });

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
  tarmoq = captured.blocks;
  tiles = captured.tiles;
  dataCallUrls = requestedUrls.filter(isDataCall);

  // Switch every block to its "Hudud" tab. This fires no refetch — by-region
  // is already loaded — so the tables repaint from the payload we captured.
  // Blocks are re-resolved on each iteration rather than indexed up front, so
  // that any reordering or remounting on tab switch cannot shift cached indices.
  expect(await page.locator(".n-tabs-tab", { hasText: /^Hudud$/ }).count()).toBe(indicators.statistics.length);
  const stillOnNetwork = () =>
    page.locator(".n-card").filter({ has: page.locator(".n-tabs-tab--active", { hasText: /^Tarmoq$/ }) });
  for (let guard = 0; guard <= indicators.statistics.length; guard++) {
    if ((await stillOnNetwork().count()) === 0) break;
    // data-name is the component's own tab id ("network"/"region") and is
    // stabler than the label. Each click is bounded: an unclickable tab must
    // fail here, naming the block, rather than silently consuming the whole
    // beforeAll budget with retries.
    const tab = stillOnNetwork().first().locator('[data-name="region"]');
    await tab.scrollIntoViewIfNeeded();
    await tab.click({ timeout: 15_000 });
  }
  await expect(stillOnNetwork()).toHaveCount(0, { timeout: 15_000 });
  hudud = (await readDashboard(page)).blocks;
});

test.afterAll(async () => {
  await context?.close();
});

// --- navigation & provenance ----------------------------------------------

test("the Dashbord menu lands on the completed-projects tab of /app/analytics", async () => {
  expect(landedUrl).toContain("/app/analytics");
  expect(landedUrl).toContain("tab=completed_projects");
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
  expect(byNetwork.results.length).toBeGreaterThan(0);
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

// NB: by-content returns 8 statistics but the page renders only 7 KPI tiles —
// `amount` (total investment volume, ~70.5 mlrd $) is dropped and appears
// nowhere on the dashboard. The test.fail that tracked this was removed on
// 2026-08-06 at the client's request; the bug itself is still open, and
// nothing in this suite watches it now.

// --- metric blocks ---------------------------------------------------------

test("the 12 metric blocks render in the order indicators returns them", async () => {
  expect(tarmoq.length).toBe(BLOCKS.length);
  BLOCKS.forEach((block, i) => {
    expect(indicators.statistics[i].key, `indicators[${i}] should be "${block.key}"`).toBe(block.key);
    if (typeof block.title === "string") {
      expect(tarmoq[i].title).toBe(block.title);
    } else {
      expect(tarmoq[i].title).toMatch(block.title);
    }
  });
});

test("block headlines render the values indicators returned", async () => {
  BLOCKS.forEach((block, i) => {
    const stat = indicators.statistics[i];
    const numbers = parseSummary(tarmoq[i].summary);
    const expected = block.fourColumn ? [stat.plan, stat.fact] : [stat.fact];
    expect(numbers.length, `block "${block.key}" headline: ${tarmoq[i].summary}`).toBe(expected.length);
    numbers.forEach((actual, j) => {
      // Headlines round like the tiles do (icor keeps a decimal, pp does not).
      expect(
        Math.abs(actual - expected[j]),
        `block "${block.key}" headline shows ${actual}, indicators says ${expected[j]}`
      ).toBeLessThanOrEqual(0.5);
    });
  });
});

test("the Tarmoq view shows a block for all 12 metrics", async () => {
  expect([...keyBlocksByMetric(tarmoq).keys()].sort()).toEqual([...ALL_KEYS].sort());
});

test("Tarmoq tables match by-network row for row", async () => {
  assertValues(keyBlocksByMetric(tarmoq), byNetwork.results, "Tarmoq");
});

// GVA used to be carved out here as a known bug, back when this tab was fed by
// by-initiator: the block dropped two initiators ("Olmaliq KMK AJ" and the
// Qizilmiya... uyushmasi) that had a non-zero gva.fact, so its totals could not
// be reconciled against its rows. The tab is fed by by-network now, so that
// exact carve-out no longer applies; the assertion below is left general so a
// dropped row reports itself directly on whichever payload feeds the tab.
test("Tarmoq tables list every network that has data for the metric", async () => {
  assertRowSets(keyBlocksByMetric(tarmoq), byNetwork.results, "Tarmoq");
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

// NB: the page requests BOTH by-region and by-network with year=2025 while the
// period selector — and every other call on the screen (by-content,
// indicators, by-initiator) — is on 2026. So both per-block tabs show last
// year's figures under a "2026 yil" header, and disagree with the block
// headline above them, which is fed by indicators on 2026. The redesign
// carried the hardcoded year over from the old page and widened it from one
// tab to two. The two test.fail tests that tracked this (one on the query
// string, one on the rendered values) were removed on 2026-08-06 at the
// client's request; the bug is still open, and nothing in this suite watches
// it now.
//
// Note this is why the two "tables faithfully render the payload the page
// fetched" assertions above compare against the payload the page actually
// fetched rather than the selected period — they stay green on 2025 data by
// design.

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
