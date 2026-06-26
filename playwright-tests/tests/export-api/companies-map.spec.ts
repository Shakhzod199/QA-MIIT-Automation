import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Companies / combined export+import map", () => {
  test("GET /companies/map/republic", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/map/republic`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/map/world", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/map/world`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/map/world accepts a sort param", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/map/world?sort=name`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });
});
