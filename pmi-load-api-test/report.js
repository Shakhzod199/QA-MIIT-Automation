import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";
import { buildHtmlReport } from "./report-render.mjs";

export { buildHtmlReport };

/**
 * Shared handleSummary() builder for both scripts. Produces a self-contained
 * standalone HTML report (for anyone grabbing just that one file), a raw
 * JSON dump of the same summary `data` (so build-report-index.mjs can render
 * a combined page without re-parsing HTML), and keeps the usual colored text
 * summary on stdout for local/CI log output.
 */
export function buildSummary(data, htmlFilename, title) {
  return {
    [htmlFilename]: buildHtmlReport(data, title),
    [htmlFilename.replace(/\.html$/, ".json")]: JSON.stringify(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
