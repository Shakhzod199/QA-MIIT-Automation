import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n * 100) / 100;
}

/** Renders one metric's key sub-values (avg/min/med/max/p95 or rate/count) as a table row. */
function metricRow(name, metric) {
  const v = metric.values || {};
  if (metric.type === "rate") {
    return `<tr><td>${escapeHtml(name)}</td><td colspan="5">rate: ${fmt((v.rate ?? 0) * 100)}%</td></tr>`;
  }
  if (metric.type === "counter") {
    return `<tr><td>${escapeHtml(name)}</td><td colspan="5">count: ${fmt(v.count)} (${fmt(v["rate"])}/s)</td></tr>`;
  }
  return `<tr><td>${escapeHtml(name)}</td><td>${fmt(v.avg)}</td><td>${fmt(v.min)}</td><td>${fmt(v.med)}</td><td>${fmt(v.max)}</td><td>${fmt(v["p(95)"])}</td></tr>`;
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

  const thresholdRows = Object.entries(metrics)
    .filter(([, m]) => m.thresholds)
    .flatMap(([name, m]) =>
      Object.entries(m.thresholds).map(
        ([expr, t]) =>
          `<tr><td>${escapeHtml(name)}</td><td><code>${escapeHtml(expr)}</code></td><td class="${t.ok ? "pass" : "fail"}">${t.ok ? "PASS" : "FAIL"}</td></tr>`
      )
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0b0b0f; color: #e5e5e5; margin: 0; padding: 24px; }
  h1 { margin-top: 0; }
  h2 { margin-top: 32px; color: #a5b4fc; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #27272a; font-size: 13px; }
  th { color: #9ca3af; font-weight: 500; }
  .pass { color: #4ade80; font-weight: 600; }
  .fail { color: #f87171; font-weight: 600; }
  code { background: #18181b; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>

  <h2>Thresholds</h2>
  <table>
    <tr><th>Metric</th><th>Expression</th><th>Result</th></tr>
    ${thresholdRows || '<tr><td colspan="3">No thresholds defined.</td></tr>'}
  </table>

  <h2>Checks</h2>
  <table>
    <tr><th>Name</th><th colspan="5">Result</th></tr>
    ${checks || '<tr><td colspan="6">No checks recorded.</td></tr>'}
  </table>

  <h2>HTTP metrics</h2>
  <table>
    <tr><th>Metric</th><th>avg</th><th>min</th><th>med</th><th>max</th><th>p95</th></tr>
    ${httpRows}
  </table>

  <h2>Other metrics</h2>
  <table>
    <tr><th>Metric</th><th>avg</th><th>min</th><th>med</th><th>max</th><th>p95</th></tr>
    ${otherRows}
  </table>
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
