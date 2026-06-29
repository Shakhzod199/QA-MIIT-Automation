import { makeIterate } from "./scenario.js";
import { buildSummary } from "./report.js";

// Stress test — simulates a sudden traffic surge: spike straight to 60
// users with no ramp-up, then hold for the full 1:30 (90s), to find
// breaking points rather than just confirming expected-load behavior.
// Much shorter think-time (0.1-0.3s) than load-test.js — deliberately
// hammers harder than load-test.js.
export const options = {
  scenarios: {
    pmi_api_stress: {
      executor: "ramping-vus",
      startVUs: 60,
      stages: [{ duration: "90s", target: 60 }],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    // Intentionally more lenient than load-test.js — pushing past comfort
    // on purpose, so some degradation is expected, not a failure signal.
    http_req_failed: ["rate<0.05"],
  },
};

export default makeIterate(0.1, 0.3);

export function handleSummary(data) {
  return buildSummary(data, "stress-report.html", "PMI API — Stress Test Report");
}
