// Runs in CI (plain Node, after both k6 scripts finish) to assemble one flat
// HTML page out of the load + stress test summaries — no iframes, so there's
// exactly one scrollbar instead of the page-in-a-page double-scroll you get
// from embedding two full standalone reports via <iframe>.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { SHARED_STYLES, escapeHtml, renderReportBody } from "./report-render.mjs";

const SECTIONS = [
  // Matches report.js's buildSummary(), which derives the JSON filename
  // from the HTML filename by replacing ".html" with ".json".
  { id: "load", nav: "Load test", json: "load-report.json", title: "PMI API — Load Test Report" },
  { id: "stress", nav: "Stress test", json: "stress-report.json", title: "PMI API — Stress Test Report" },
];

const blocks = SECTIONS.map(({ id, json, title }) => {
  if (!existsSync(json)) {
    return `<div class="report-block" id="${id}"><p class="empty">This test did not produce a summary — it may have crashed before finishing.</p></div>`;
  }
  const data = JSON.parse(readFileSync(json, "utf8"));
  return `<div class="report-block" id="${id}">${renderReportBody(data, title)}</div>`;
});

const nav = SECTIONS.map(({ id, nav }) => `<a href="#${id}">${escapeHtml(nav)}</a>`).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PMI API — k6 Load/Stress Report</title>
<style>
${SHARED_STYLES}
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0b0b0f;
    color: #e5e7eb;
    margin: 0;
    line-height: 1.4;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    background: #0b0b0f;
    border-bottom: 1px solid #27272a;
  }
  header h1 { margin: 0; font-size: 16px; font-weight: 600; }
  nav { display: flex; gap: 8px; }
  nav a {
    color: #a5b4fc;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #27272a;
  }
  nav a:hover { background: #1f1f23; color: #fff; }
  .report-block { padding: 24px; border-top: 1px solid #27272a; }
  .report-block:first-of-type { border-top: none; }
</style>
</head>
<body>
  <header>
    <h1>PMI API — k6 Load/Stress Report</h1>
    <nav>${nav}</nav>
  </header>
  ${blocks.join("\n")}
</body>
</html>`;

mkdirSync("k6-report", { recursive: true });
writeFileSync("k6-report/index.html", html);
console.log("Wrote k6-report/index.html");
