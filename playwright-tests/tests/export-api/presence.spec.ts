import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Presence", () => {
  test("GET /presence/dau", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/dau`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.data.count).toBe("number");
  });

  test("GET /presence/dau/by-date-range", async ({ request }) => {
    const res = await request.get(
      `${API_BASE_URL}/presence/dau/by-date-range?from=2026-06-01&to=2026-06-25`,
      { headers: authHeader(token) }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /presence/dau/by-date-range with no range still responds OK", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/dau/by-date-range`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });

  test("GET /presence/me", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/me`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /presence/online", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/online`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.user_ids)).toBe(true);
  });

  test("GET /presence/online/count", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/online/count`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.data.count).toBe("number");
  });

  test("GET /presence/online/users", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/online/users`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
  });

  test("GET /presence/online/users respects pagination params", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/online/users?page=1&per_page=5`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });

  test("GET /presence/online/users rejects an unknown sort value gracefully (no 5xx)", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/online/users?sort=not-a-real-field`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("GET /presence/stats", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/stats`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /presence/user-actions", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/user-actions`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
  });

  test("GET /presence/user-actions filters by date range and pagination", async ({ request }) => {
    const res = await request.get(
      `${API_BASE_URL}/presence/user-actions?from=2026-06-01&to=2026-06-25&page=1&per_page=10`,
      { headers: authHeader(token) }
    );
    expect(res.status()).toBe(200);
  });
});
