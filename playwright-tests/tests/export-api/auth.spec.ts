import { test, expect } from "@playwright/test";
import { API_BASE_URL, USERNAME, PASSWORD, login, authHeader } from "./helpers";

// ---------------------------------------------------------------------------
// Export API — auth contract.
// Every endpoint under test requires a Bearer token (see securityDefinitions
// in the Swagger doc); this file proves the login flow itself and that the
// auth gate actually rejects missing/invalid tokens, so the per-endpoint spec
// files can assume a valid token "just works" without re-checking 401s.
// ---------------------------------------------------------------------------

test.describe("Export API — auth", () => {
  test("POST /auth/login returns an access token for valid credentials", async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { username: USERNAME, password: PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.access_token).toBe("string");
    expect(body.data.access_token.length).toBeGreaterThan(0);
  });

  test("POST /auth/login rejects invalid credentials with 401", async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { username: USERNAME, password: "definitely-wrong-password" },
    });
    expect(res.status()).toBe(401);
  });

  test("a protected endpoint rejects requests with no Authorization header", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/dau`);
    expect(res.status()).toBe(401);
  });

  test("a protected endpoint rejects a malformed token", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/presence/dau`, {
      headers: authHeader("not-a-real-token"),
    });
    expect(res.status()).toBe(401);
  });

  test("a protected endpoint accepts a valid token", async ({ request }) => {
    const token = await login(request);
    const res = await request.get(`${API_BASE_URL}/presence/dau`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
  });
});
