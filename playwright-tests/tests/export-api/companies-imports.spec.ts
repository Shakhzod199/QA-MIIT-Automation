import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

// ---------------------------------------------------------------------------
// SWAGGER DOC MISMATCH: /companies/imports/map/locations is documented with
// district_id as a required "path" parameter, but the path template itself
// has no {district_id} placeholder. The real route is
// /companies/imports/map/locations/{district_id} — tested below.
// ---------------------------------------------------------------------------

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Companies / imports", () => {
  test("GET /companies/imports/list", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/imports/list`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("results");
  });

  test("GET /companies/imports/list with filters and pagination", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/imports/list?page=1&per_page=5`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });

  test("GET /companies/imports/map/locations/{district_id}", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/imports/map/locations/1`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("results");
  });

  test("the documented district_id-as-query-param shape 404s", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/imports/map/locations?district_id=1`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(404);
  });

  test("GET /companies/imports/map/republic", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/imports/map/republic`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/imports/map/world", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/imports/map/world`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });
});
