import { makeIterate } from "./scenario.js";
import { buildSummary } from "./report.js";

// Load test — simulates realistic expected traffic: ramp 0 -> 200 users
// over the first 30s, then hold steady at 200 for the remaining 60s.
// Total duration: 1:30 (90s). 1-3s think-time between actions per VU,
// matching how an actual person clicks around a dashboard.
//
// 200 is the committed baseline: 100/200 VUs pass cleanly, but 250+ reliably
// breaches the failure threshold on /test/login specifically — see
// FINDINGS.md / FINDINGS.uz.md for the full capacity investigation.
export const options = {
  scenarios: {
    pmi_api_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 200 },
        { duration: "60s", target: 200 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default makeIterate(1, 3);

export function handleSummary(data) {
  return buildSummary(data, "load-report.html", "PMI API — Load Test Report");
}
