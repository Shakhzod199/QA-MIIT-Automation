import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

let token: string;
test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  token = await login(request);
});

test.describe("Export API — Companies / charts", () => {
  test("GET /companies/charts/countries-count", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/countries-count`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/charts/monthly-dynamics", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/monthly-dynamics`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  test("GET /companies/charts/sphere-dynamics", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/sphere-dynamics`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
  });

  // type=export|import is documented as required; both values are exercised.
  for (const type of ["export", "import"]) {
    test(`GET /companies/charts/top-companies?type=${type}`, async ({ request }) => {
      const res = await request.get(`${API_BASE_URL}/companies/charts/top-companies?type=${type}`, {
        headers: authHeader(token),
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  }

  test("GET /companies/charts/top-countries?type=export", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/top-countries?type=export`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /companies/charts/top-products?type=export", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/top-products?type=export`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /companies/charts/top-regions?type=export", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/top-regions?type=export`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /companies/charts/transport-types?type=export", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/transport-types?type=export`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  // type is documented as required — confirm the server's actual behavior
  // when it's omitted (informational: not asserted as a hard failure either
  // way, since "required" in Swagger doesn't guarantee server-side enforcement).
  test("GET /companies/charts/top-products without type does not 5xx", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/companies/charts/top-products`, {
      headers: authHeader(token),
    });
    expect(res.status()).toBeLessThan(500);
  });
});
