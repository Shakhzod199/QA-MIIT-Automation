// Shared config for the PMI API load/stress tests. Values come from real
// environment variables (see run.sh, which sources ../.env.local) — no
// credential lives in source.
//
// The backend lives on a different host (apiproject.miit.uz) than the PMI
// frontend (testpmi.miit.uz) — see playwright-tests/tests/pmi-api/helpers.js
// for the same split. Login is /test/login, not /auth/login.
export const API_BASE_URL = `${(__ENV.PMI_API_BASE_URL || "https://apiproject.miit.uz").replace(/\/+$/, "")}/api/projects`;
export const USERNAME = __ENV.PMI_USERNAME;
export const PASSWORD = __ENV.PMI_PASSWORD;

// The 11 GET endpoints under load test, as given for this run. Verified
// directly against the live API (not just the Swagger doc) before wiring
// these in:
//  - /test/step/statistics 500s without a project_type_id query param, so it
//    carries one here (?project_type_id=1, the first id returned by
//    /test/project_types/list).
//  - /test/project/list with no params returns the ENTIRE unpaginated
//    dataset (~20MB, 20-25s) — not a concurrency problem, just an unbounded
//    payload. ?limit=20 is what any real UI client would actually send and
//    returns in ~1s, so that's what's used here.
export const GET_ENDPOINTS = [
  "/test/v2/user/me",
  "/test/general/statistics",
  "/test/project/list?limit=20",
  "/test/additional/statistics",
  "/test/notification/list",
  "/test/project/countries-map-statistics",
  "/test/status/statistics/in-program",
  "/test/project_types/list",
  "/test/step/statistics?project_type_id=1",
  "/test/sphere/list",
  "/test/network/statistics",
];
