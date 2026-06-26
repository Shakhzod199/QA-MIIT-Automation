import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n * 100) / 100;
}

/** Pill-style badge matching the dashboard's status colors. */
function badge(ok, label) {
  const cls = ok ? "badge pass" : "badge fail";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

/** Renders one metric's key sub-values (avg/min/med/max/p95 or rate/count) as a table row. */
function metricRow(name, metric) {
  const v = metric.values || {};
  if (metric.type === "rate") {
    const pct = fmt((v.rate ?? 0) * 100);
    return `<tr><td>${escapeHtml(name)}</td><td colspan="5">${badge(pct === 100, `${pct}%`)}</td></tr>`;
  }
  if (metric.type === "counter") {
    return `<tr><td>${escapeHtml(name)}</td><td colspan="5">${fmt(v.count)} <span class="muted">(${fmt(v["rate"])}/s)</span></td></tr>`;
  }
  return `<tr><td>${escapeHtml(name)}</td><td class="num">${fmt(v.avg)}</td><td class="num">${fmt(v.min)}</td><td class="num">${fmt(v.med)}</td><td class="num">${fmt(v.max)}</td><td class="num">${fmt(v["p(95)"])}</td></tr>`;
}

/**
 * Hand-rolled, self-contained HTML report (no external CDN assets — k6 runs
 * in CI with no guarantee a third-party jslib bundle stays resolvable) built
 * straight from k6's summary `data` object passed into handleSummary().
 */
export function buildHtmlReport(data, title) {
  const metrics = data.metrics || {};
  const checks = Object.entries(metrics)
    .filter(([k]) => k === "checks")
    .map(([name, m]) => metricRow(name, m))
    .join("");
  const httpRows = Object.entries(metrics)
    .filter(([k]) => k.startsWith("http_"))
    .map(([name, m]) => metricRow(name, m))
    .join("");
  const otherRows = Object.entries(metrics)
    .filter(([k]) => !k.startsWith("http_") && k !== "checks")
    .map(([name, m]) => metricRow(name, m))
    .join("");

  const thresholds = Object.entries(metrics).flatMap(([name, m]) =>
    m.thresholds
      ? Object.entries(m.thresholds).map(([expr, t]) => ({ name, expr, ok: t.ok }))
      : []
  );
  const thresholdRows = thresholds
    .map(
      ({ name, expr, ok }) =>
        `<tr><td>${escapeHtml(name)}</td><td><code>${escapeHtml(expr)}</code></td><td>${badge(ok, ok ? "PASS" : "FAIL")}</td></tr>`
    )
    .join("");
  const thresholdsPassed = thresholds.filter((t) => t.ok).length;
  const allThresholdsOk = thresholds.length === 0 || thresholdsPassed === thresholds.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0b0b0f;
    color: #e5e7eb;
    margin: 0;
    padding: 28px;
    line-height: 1.4;
  }
  h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
  .subtitle { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
  .summary {
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 10px;
    border: 1px solid ${allThresholdsOk ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"};
    background: ${allThresholdsOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)"};
    padding: 14px 18px;
    margin-bottom: 24px;
  }
  .summary .icon {
    width: 20px; height: 20px; flex-shrink: 0;
    color: ${allThresholdsOk ? "#34d399" : "#f87171"};
  }
  .summary .text { font-size: 14px; }
  .summary .text strong { color: #fff; }
  section { margin-bottom: 28px; border: 1px solid #27272a; border-radius: 10px; background: #111114; overflow: hidden; }
  section h2 {
    margin: 0; padding: 12px 16px; font-size: 13px; font-weight: 600;
    letter-spacing: 0.03em; text-transform: uppercase; color: #a5b4fc;
    border-bottom: 1px solid #27272a; background: #15151a;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 9px 16px; font-size: 13px; }
  td { border-top: 1px solid #1f1f23; }
  th { color: #6b7280; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  td.num { font-variant-numeric: tabular-nums; color: #d1d5db; }
  .muted { color: #6b7280; font-size: 12px; }
  .badge {
    display: inline-flex; align-items: center; border-radius: 9999px;
    padding: 2px 10px; font-size: 12px; font-weight: 600;
  }
  .badge.pass { background: rgba(16,185,129,0.15); color: #34d399; }
  .badge.fail { background: rgba(239,68,68,0.15); color: #f87171; }
  code { background: #1f1f23; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  .empty { padding: 14px 16px; color: #6b7280; font-size: 13px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="subtitle">k6 load test summary — thresholds, checks, and HTTP timings.</p>

  <div class="summary">
    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      ${
        allThresholdsOk
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />'
      }
    </svg>
    <span class="text">
      ${
        thresholds.length === 0
          ? "No thresholds were defined for this run."
          : `<strong>${thresholdsPassed}/${thresholds.length}</strong> thresholds passed`
      }
    </span>
  </div>

  <section>
    <h2>Thresholds</h2>
    ${thresholdRows ? `<table><tr><th>Metric</th><th>Expression</th><th>Result</th></tr>${thresholdRows}</table>` : '<p class="empty">No thresholds defined.</p>'}
  </section>

  <section>
    <h2>Checks</h2>
    ${checks ? `<table><tr><th>Name</th><th colspan="5">Result</th></tr>${checks}</table>` : '<p class="empty">No checks recorded.</p>'}
  </section>

  <section>
    <h2>HTTP metrics</h2>
    <table><tr><th>Metric</th><th>avg</th><th>min</th><th>med</th><th>max</th><th>p95</th></tr>${httpRows}</table>
  </section>

  <section>
    <h2>Other metrics</h2>
    <table><tr><th>Metric</th><th>avg</th><th>min</th><th>med</th><th>max</th><th>p95</th></tr>${otherRows}</table>
  </section>
</body>
</html>`;
}

/**
 * Shared handleSummary() builder for both scripts. Produces a self-contained
 * HTML report (single file, inline styles only — no external assets to
 * serve) plus keeps the usual colored text summary on stdout for local/CI
 * log output.
 */
export function buildSummary(data, htmlFilename, title) {
  return {
    [htmlFilename]: buildHtmlReport(data, title),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
