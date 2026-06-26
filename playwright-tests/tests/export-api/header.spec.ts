import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

// ---------------------------------------------------------------------------
// Export API — Header / company statistics.
//
// SWAGGER DOC MISMATCH: the spec documents these at /statistics,
// /header/statistics and /header/import/statistics, but all three 404 there.
// The real, working routes are one level deeper under /companies — tested
// below. Flagged for the backend team; not something a test can "fix".
// ---------------------------------------------------------------------------

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Header", () => {
  test("GET /companies/statistics", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/statistics`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/header/statistics", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/header/statistics`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("companies_count");
  });

  test("GET /companies/header/import/statistics", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/header/import/statistics`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("companies_count");
  });

  // Documents the mismatch explicitly so a future spec fix (adding the
  // missing /companies prefix) doesn't silently go unnoticed.
  test("the documented /statistics path (without the /companies prefix) 404s", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/statistics`, { headers: authHeader(token) });
    expect(res.status()).toBe(404);
  });
});
