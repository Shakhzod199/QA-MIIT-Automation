import { makeIterate } from "./scenario.js";
import { buildSummary } from "./report.js";

// Load test — simulates realistic expected traffic: ramp 0 -> 100 users
// over the first 30s, then hold steady at 100 for the remaining 60s.
// Total duration: 1:30 (90s). 1-3s think-time between actions per VU,
// matching how an actual person clicks around a dashboard.
export const options = {
  scenarios: {
    export_api_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "60s", target: 100 },
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
  return buildSummary(data, "load-report.html", "Export API — Load Test Report");
}
