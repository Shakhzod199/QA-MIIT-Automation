import { test, expect } from "@playwright/test";
import { API_BASE_URL, USERNAME, PASSWORD, login, authHeader } from "./helpers";

// ---------------------------------------------------------------------------
// PMI API — auth contract.
// Every endpoint under test requires a JWT via `Authorization: Bearer <token>`
// (see securitySchemes in the Swagger doc at apiproject.miit.uz/swagger/);
// this file proves the login flow itself and that the auth gate actually
// rejects missing/invalid tokens, so later per-endpoint spec files can assume
// a valid token "just works" without re-checking 401s.
// Read-only — only uses /test/login and a GET list endpoint, never creates,
// updates, or deletes data in the real backend.
// ---------------------------------------------------------------------------

test.describe("PMI API — auth", () => {
  test("POST /test/login returns an access token for valid credentials", async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/test/login`, {
      data: { username: USERNAME, password: PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(true);
    expect(typeof body.data.access_token).toBe("string");
    expect(body.data.access_token.length).toBeGreaterThan(0);
  });

  test("POST /test/login rejects invalid credentials with 401", async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/test/login`, {
      data: { username: USERNAME, password: "definitely-wrong-password" },
    });
    expect(res.status()).toBe(401);
  });

  test("a protected endpoint rejects requests with no Authorization header", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/test/project_types/list`);
    expect(res.status()).toBe(401);
  });

  test("a protected endpoint rejects a malformed token", async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/test/project_types/list`, {
      headers: authHeader("not-a-real-token"),
    });
    expect(res.status()).toBe(401);
  });

  test("a protected endpoint accepts a valid token", async ({ request }) => {
    const token = await login(request);
    const res = await request.get(`${API_BASE_URL}/test/project_types/list`, { headers: authHeader(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.results)).toBe(true);
  });
});
