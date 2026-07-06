import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Security spec — authentication, role-based authorization, and session
// integrity for the QA Dashboard's own API/pages (NOT the products under test).
//
// Why this exists: generic scanners (ZAP, CodeQL) can't know this app's role
// model — admin/editor/viewer with per-route gates enforced in middleware.ts.
// These are the tests only we can write, because only we know the intended
// rules. Each test tries to BREAK a rule and asserts the server refuses.
//
// What it checks:
//   1. Authentication — no valid session ⇒ APIs 401, pages redirect to /login.
//   2. Authorization  — the exact role matrix: viewer can't manage users or
//      trigger/cancel runs; editor can trigger but not manage users; admin can
//      do everything. (See requiredRoleFor() in middleware.ts.)
//   3. Session integrity — the signed cookie can't be forged or tampered with
//      to escalate privileges (HMAC check in lib/session-token.ts).
//
// How it authenticates each role: it logs in as an existing admin (creds from
// env, never hardcoded), uses that admin to create throwaway editor + viewer
// accounts, logs in as each to capture their real signed session cookies, runs
// the matrix, then deletes the throwaway accounts in afterAll. Real sessions
// are required because sensitive routes do a live Supabase revocation check —
// a hand-forged token with a fake session id would be rejected as "revoked"
// (401) and never reach the role check we're actually trying to exercise.
//
// Run it (against a locally running instance, e.g. `next start -p 3417`):
//   SECURITY_BASE_URL=http://localhost:3417 \
//   SECURITY_ADMIN_USER=<admin> SECURITY_ADMIN_PASS=<pass> \
//   npx playwright test --project=security
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SECURITY_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3417";
const ADMIN_USER = process.env.SECURITY_ADMIN_USER;
const ADMIN_PASS = process.env.SECURITY_ADMIN_PASS;

// Unique per run so parallel/re-runs never collide on the users table.
const STAMP = Date.now();
const EDITOR = { username: `sec-editor-${STAMP}`, password: `Ed!${STAMP}`, role: "editor" as const };
const VIEWER = { username: `sec-viewer-${STAMP}`, password: `Vw!${STAMP}`, role: "viewer" as const };

// Captured "ds=<signed-token>" cookie pairs for each role (the whole first
// segment of Set-Cookie, so we never hardcode the cookie name).
let adminCookie = "";
let editorCookie = "";
let viewerCookie = "";
// Ids of the throwaway accounts, deleted in afterAll.
let editorId = 0;
let viewerId = 0;

/**
 * Logs in via the real endpoint and returns the "name=value" session cookie
 * pair. Uses its own throwaway context so the returned cookie never lands in
 * the shared test context's jar — every test request must depend ONLY on the
 * explicit Cookie header it sets (or none), otherwise the "no session" tests
 * would silently ride a stored login.
 */
async function login(username: string, password: string): Promise<string> {
  const ctx = await playwrightRequest.newContext();
  try {
    const res = await ctx.post(`${BASE_URL}/api/auth/login`, { data: { username, password } });
    if (res.status() !== 200) {
      throw new Error(`login failed for "${username}": HTTP ${res.status()} ${await res.text()}`);
    }
    const setCookie = res.headers()["set-cookie"] ?? "";
    const pair = setCookie.split(";")[0]; // "ds=<token>"
    if (!/^\w+=/.test(pair)) throw new Error(`login for "${username}" set no session cookie`);
    return pair;
  } finally {
    await ctx.dispose();
  }
}

test.describe("QA Dashboard security", () => {
  // No admin creds ⇒ we can't provision the role accounts; skip loudly rather
  // than silently pass, so a missing secret in CI is visible.
  test.skip(
    !ADMIN_USER || !ADMIN_PASS,
    "Set SECURITY_ADMIN_USER and SECURITY_ADMIN_PASS to run the security spec."
  );

  let api: APIRequestContext;

  test.beforeAll(async () => {
    // This context never logs in itself, so its cookie jar stays empty — the
    // requests below carry a session only when we pass an explicit Cookie header.
    api = await playwrightRequest.newContext();

    adminCookie = await login(ADMIN_USER!, ADMIN_PASS!);

    // Provision throwaway editor + viewer accounts as admin.
    for (const u of [EDITOR, VIEWER]) {
      const res = await api.post(`${BASE_URL}/api/users`, {
        headers: { Cookie: adminCookie },
        data: { username: u.username, password: u.password, name: u.username, role: u.role },
      });
      if (res.status() !== 201) {
        throw new Error(`could not create ${u.role} fixture user: HTTP ${res.status()} ${await res.text()}`);
      }
      const id = (await res.json()).user.id as number;
      if (u.role === "editor") editorId = id;
      else viewerId = id;
    }

    editorCookie = await login(EDITOR.username, EDITOR.password);
    viewerCookie = await login(VIEWER.username, VIEWER.password);
  });

  test.afterAll(async () => {
    // Clean up the throwaway accounts so the real users table isn't polluted.
    for (const id of [editorId, viewerId]) {
      if (id) await api.delete(`${BASE_URL}/api/users/${id}`, { headers: { Cookie: adminCookie } }).catch(() => {});
    }
    await api.dispose();
  });

  // ── 1. Authentication ────────────────────────────────────────────────────
  test.describe("Authentication — no session is refused", () => {
    test("GET /api/users without a session → 401", async () => {
      const res = await api.get(`${BASE_URL}/api/users`);
      expect(res.status()).toBe(401);
    });

    test("GET /api/runs without a session → 401", async () => {
      const res = await api.get(`${BASE_URL}/api/runs`);
      expect(res.status()).toBe(401);
    });

    test("POST /api/runs/trigger without a session → 401", async () => {
      const res = await api.post(`${BASE_URL}/api/runs/trigger`, { data: {} });
      expect(res.status()).toBe(401);
    });

    test("GET /users page without a session → redirect to /login", async () => {
      const res = await api.get(`${BASE_URL}/users`, { maxRedirects: 0 });
      expect([302, 303, 307, 308]).toContain(res.status());
      expect(res.headers()["location"] ?? "").toContain("/login");
    });
  });

  // ── 2. Authorization role matrix ───────────────────────────────────────────
  test.describe("Authorization — viewer is read-only", () => {
    test("viewer cannot list users (admin-only) → 403", async () => {
      const res = await api.get(`${BASE_URL}/api/users`, { headers: { Cookie: viewerCookie } });
      expect(res.status()).toBe(403);
    });

    test("viewer cannot trigger a run (editor+) → 403", async () => {
      const res = await api.post(`${BASE_URL}/api/runs/trigger`, {
        headers: { Cookie: viewerCookie },
        data: { workflowId: 1 },
      });
      expect(res.status()).toBe(403);
    });

    test("viewer cannot cancel a run (editor+) → 403", async () => {
      const res = await api.post(`${BASE_URL}/api/runs/999999/cancel`, { headers: { Cookie: viewerCookie } });
      expect(res.status()).toBe(403);
    });

    test("viewer CAN read runs (allowed) → 200", async () => {
      const res = await api.get(`${BASE_URL}/api/runs`, { headers: { Cookie: viewerCookie } });
      expect(res.status()).toBe(200);
    });
  });

  test.describe("Authorization — editor can run but not manage users", () => {
    test("editor cannot list users (admin-only) → 403", async () => {
      const res = await api.get(`${BASE_URL}/api/users`, { headers: { Cookie: editorCookie } });
      expect(res.status()).toBe(403);
    });

    test("editor passes the trigger gate (not 401/403)", async () => {
      // Empty body ⇒ handler returns 400 "Missing workflowId" BEFORE dispatching
      // any real CI. So a non-403 here proves the role gate let the editor
      // through, without actually starting a workflow.
      const res = await api.post(`${BASE_URL}/api/runs/trigger`, {
        headers: { Cookie: editorCookie },
        data: {},
      });
      expect(res.status()).not.toBe(401);
      expect(res.status()).not.toBe(403);
      expect(res.status()).toBe(400);
    });
  });

  test.describe("Authorization — admin has full access", () => {
    test("admin can list users → 200", async () => {
      const res = await api.get(`${BASE_URL}/api/users`, { headers: { Cookie: adminCookie } });
      expect(res.status()).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    test("admin passes the trigger gate (not 403)", async () => {
      const res = await api.post(`${BASE_URL}/api/runs/trigger`, {
        headers: { Cookie: adminCookie },
        data: {},
      });
      expect(res.status()).not.toBe(403);
      expect(res.status()).toBe(400);
    });
  });

  // ── 3. Session integrity (can't forge/tamper the signed cookie) ────────────
  test.describe("Session integrity — the signed cookie can't be forged", () => {
    /** Returns "ds=<token>" with the given token value. */
    function withToken(token: string): string {
      const name = viewerCookie.split("=")[0];
      return `${name}=${token}`;
    }

    test("garbage token → 401", async () => {
      const res = await api.get(`${BASE_URL}/api/runs`, { headers: { Cookie: withToken("not.a.real.token") } });
      expect(res.status()).toBe(401);
    });

    test("token with the signature stripped → 401", async () => {
      const body = viewerCookie.split("=")[1].split(".")[0]; // payload only, no signature
      const res = await api.get(`${BASE_URL}/api/runs`, { headers: { Cookie: withToken(body) } });
      expect(res.status()).toBe(401);
    });

    test("tampered payload (broken signature) → 401", async () => {
      const value = viewerCookie.split("=")[1];
      const [body, sig] = value.split(".");
      // Flip the last char of the payload; the HMAC no longer matches.
      const flipped = body.slice(0, -1) + (body.at(-1) === "A" ? "B" : "A");
      const res = await api.get(`${BASE_URL}/api/runs`, { headers: { Cookie: withToken(`${flipped}.${sig}`) } });
      expect(res.status()).toBe(401);
    });

    test("privilege-escalation attempt: swap viewer's cookie onto an admin route → still 403", async () => {
      // The viewer's cookie is perfectly valid — the point is that a valid
      // low-privilege session still can't reach an admin route. (Forging a
      // higher role into the payload is covered by the tamper test above:
      // any edit breaks the signature ⇒ 401.)
      const res = await api.get(`${BASE_URL}/api/users`, { headers: { Cookie: viewerCookie } });
      expect(res.status()).toBe(403);
    });
  });
});
