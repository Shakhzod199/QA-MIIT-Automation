import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Import tables", () => {
  test("GET /imports/tables/daily", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/imports/tables/daily`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /imports/tables/networks", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/imports/tables/networks`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /imports/tables/products", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/imports/tables/products`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });
});
