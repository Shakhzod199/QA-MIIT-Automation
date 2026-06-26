// Shared config for the export API load/stress tests. Values come from real
// environment variables (see run.sh, which sources ../.env.local) — no
// credential lives in source.
export const API_BASE_URL = `${(__ENV.BASE_URL || "https://export.miit.uz").replace(/\/+$/, "")}/api/v1`;
export const USERNAME = __ENV.EXPORT_USERNAME;
export const PASSWORD = __ENV.EXPORT_PASSWORD;

// The GET endpoints under load test, from the screenshotted Swagger groups.
// Paths use the REAL working routes, not the ones documented in the Swagger
// doc — see playwright-tests/tests/export-api for the two doc/route
// mismatches this corrects for (missing /companies prefix, and district_id
// as a path segment instead of a query param).
export const GET_ENDPOINTS = [
  "/companies/statistics",
  "/companies/header/import/statistics",
  "/companies/header/statistics",
  "/companies/imports/list",
  "/companies/imports/map/locations/1",
  "/companies/imports/map/republic",
  "/companies/imports/map/world",
  "/companies/map/republic",
  "/companies/map/world",
  "/companies/exports/map/republic",
  "/companies/exports/map/world",
  "/companies/exports/list",
];
