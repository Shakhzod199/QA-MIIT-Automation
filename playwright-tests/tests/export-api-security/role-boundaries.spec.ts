import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader, loginViewer, VIEWER_USERNAME, VIEWER_PASSWORD } from "./helpers";

// ---------------------------------------------------------------------------
// Export API — role boundaries (viewer vs admin).
//
// Why this exists: export-api/*.spec.ts proves the documented endpoints work
// for an authorized admin account; it never checks whether a lower-privileged
// account is actually blocked from admin-only actions server-side. This spec
// closes that gap.
//
// Scope is deliberately READ-ONLY. https://export.miit.uz looks like the real
// production backend (no test/staging subdomain, unlike SEZ/PMT), and none of
// the existing export-api specs issue a POST/PUT/DELETE against it. So this
// file only ever calls GET — it proves the viewer role is refused on
// admin-only *reads* (user list, permission config) rather than attempting
// writes that could create or corrupt real data.
//
// EXPORT_VIEWER_USERNAME / EXPORT_VIEWER_PASSWORD must be a real, pre-existing
// account with a restricted (non-admin) role — see .env.local.example. The
// spec self-skips if they're absent, same pattern as tests/security/authz.spec.ts.
//
// Run it:
//   EXPORT_USERNAME=<admin> EXPORT_PASSWORD=<pass> \
//   EXPORT_VIEWER_USERNAME=<viewer> EXPORT_VIEWER_PASSWORD=<pass> \
//   npx playwright test --project=export-api-security
// ---------------------------------------------------------------------------

test.describe("Export API — role boundaries", () => {
  test.skip(
    !VIEWER_USERNAME || !VIEWER_PASSWORD,
    "Set EXPORT_VIEWER_USERNAME and EXPORT_VIEWER_PASSWORD to run the export-api-security spec."
  );

  let adminToken: string;
  let viewerToken: string;

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    adminToken = await login(request);
    viewerToken = await loginViewer(request);
  });

  // ── Authorization — admin-only reads reject the viewer role ────────────────
  test.describe("Admin-only endpoints refuse the viewer role", () => {
    test("viewer cannot list users → 403", async ({ request }) => {
      const res = await request.get(`${API_BASE_URL}/users/`, { headers: authHeader(viewerToken) });
      expect(res.status()).toBe(403);
    });

    test("viewer cannot view permission roles → 403", async ({ request }) => {
      const res = await request.get(`${API_BASE_URL}/permissions/roles`, { headers: authHeader(viewerToken) });
      expect(res.status()).toBe(403);
    });

    test("viewer cannot view permission tables → 403", async ({ request }) => {
      const res = await request.get(`${API_BASE_URL}/permissions/tables`, { headers: authHeader(viewerToken) });
      expect(res.status()).toBe(403);
    });
  });

  // ── Control group — the same endpoints work for the admin account ──────────
  // Without these, a 403 above could mean "endpoint is broken" instead of
  // "role is enforced". These prove the gate is role-specific, not a global outage.
  test.describe("The same endpoints work for admin (control)", () => {
    test("admin can list users → 200", async ({ request }) => {
      const res = await request.get(`${API_BASE_URL}/users/`, { headers: authHeader(adminToken) });
      expect(res.status()).toBe(200);
    });

    test("admin can view permission roles → 200", async ({ request }) => {
      const res = await request.get(`${API_BASE_URL}/permissions/roles`, { headers: authHeader(adminToken) });
      expect(res.status()).toBe(200);
    });
  });

  // ── Session integrity — a tampered JWT is rejected, not just a missing one ──
  test.describe("Session integrity — the JWT can't be tampered with", () => {
    test("flipping a character in the token payload → 401", async ({ request }) => {
      const parts = viewerToken.split(".");
      test.skip(parts.length !== 3, "access_token doesn't look like a 3-part JWT; skipping tamper test");
      const [header, payload, signature] = parts;
      const flipped = payload.slice(0, -1) + (payload.at(-1) === "A" ? "B" : "A");
      const res = await request.get(`${API_BASE_URL}/presence/dau`, {
        headers: authHeader(`${header}.${flipped}.${signature}`),
      });
      expect(res.status()).toBe(401);
    });

    test("a well-formed but unsigned garbage token is refused even on an admin route → 401, not 403", async ({
      request,
    }) => {
      // Proves the auth check runs BEFORE the role check: a bad token must
      // never leak a 403 (which would confirm the route/role exists) instead
      // of a flat 401.
      const res = await request.get(`${API_BASE_URL}/users/`, { headers: authHeader("not-a-real-token") });
      expect(res.status()).toBe(401);
    });
  });
});
