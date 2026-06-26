import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — misc reference data", () => {
  test("GET /networks", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/networks`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /regions", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/regions`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /regions with pagination and search", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/regions?page=1&per_page=5&search=tosh`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });

  test("GET /services", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/services`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /services/table", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/services/table`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /sidebar", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/sidebar`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /spheres", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/spheres`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /spheres/table", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/spheres/table`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /tnveds", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/tnveds`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /tnveds with pagination and search", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/tnveds?page=1&per_page=5&search=24`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
  });
});
