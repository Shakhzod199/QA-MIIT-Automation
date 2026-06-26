import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

// SWAGGER DOC MISMATCH: same district_id-as-path-param issue as
// companies-imports.spec.ts — see that file's header comment.

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Companies / exports", () => {
  test("GET /companies/exports/list", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/exports/list`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("results");
  });

  test("GET /companies/exports/list with filters and pagination", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/exports/list?page=1&per_page=5`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });

  test("GET /companies/exports/list/manual", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/exports/list/manual`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/exports/map/locations/{district_id}", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/exports/map/locations/1`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("results");
  });

  test("GET /companies/exports/map/republic", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/exports/map/republic`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/exports/map/world", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/exports/map/world`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });
});
