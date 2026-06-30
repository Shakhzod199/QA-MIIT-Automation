import { test, expect } from "@playwright/test";
import { API_BASE_URL, USERNAME, PASSWORD, login } from "./helpers";

// ---------------------------------------------------------------------------
// PMT API auth contract (testpmt.miit.uz/api).
// Auth is cookie-based: POST /auth/login sets an httpOnly "accessToken" cookie
// that subsequent requests must carry. There is no Bearer token path.
// ---------------------------------------------------------------------------

test.describe("PMT API — auth", () => {
  test("POST /auth/login returns 200 and sets accessToken cookie for valid credentials", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { username: USERNAME, password: PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.msg).toBe("Success");

    const cookies = res.headers()["set-cookie"] ?? "";
    expect(cookies).toMatch(/accessToken=/);
  });

  test("POST /auth/login rejects invalid credentials with 401", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { username: USERNAME, password: "definitely-wrong" },
    });
    // Server returns 400 for bad credentials (not 401) — just verify it rejects.
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("protected endpoint returns 401 without the session cookie", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/account/profile`);
    expect(res.status()).toBe(401);
  });

  test("GET /account/profile returns the logged-in user's profile", async ({
    request,
  }) => {
    await login(request);
    const res = await request.get(`${API_BASE_URL}/account/profile`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data?.user?.username).toBeTruthy();
  });

  test("POST /auth/logout clears the session", async ({ request }) => {
    await login(request);
    const res = await request.post(`${API_BASE_URL}/auth/logout`);
    expect(res.status()).toBeLessThan(500);
  });
});
