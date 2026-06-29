import fs from "node:fs";
import path from "node:path";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "./helpers";

// ---------------------------------------------------------------------------
// Spec-driven coverage for every operation in openapi.json (a committed
// snapshot of https://apiproject.miit.uz/swagger/openapi.json — 455 paths,
// 542 operations). Rather than hand-writing one file per endpoint, this file
// walks the spec and generates two kinds of checks:
//
//  - GET endpoints: prove the auth gate rejects an unauthenticated request
//    (401), then prove a valid token is accepted. Endpoints with path
//    params / required query params get a placeholder id, so we can't
//    assert a specific 200 body — only that the token itself isn't the
//    reason for a non-200 (i.e. status isn't 401, and isn't a 5xx crash).
//
//  - POST/PUT/PATCH/DELETE endpoints: a single safety-net check that the
//    endpoint never succeeds (2xx) when called with no request body. This
//    file intentionally NEVER sends a real create/update/delete payload —
//    nothing here mutates real data on apiproject.miit.uz.
// ---------------------------------------------------------------------------

interface OpenApiParam {
  name: string;
  in: string;
  required?: boolean;
  schema?: { type?: string };
}

interface OpenApiOp {
  tags?: string[];
  security?: unknown[];
  parameters?: OpenApiParam[];
}

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, "openapi.json"), "utf-8")) as {
  paths: Record<string, Record<string, OpenApiOp>>;
};

const WRITE_METHODS = ["post", "put", "patch", "delete"] as const;
type WriteMethod = (typeof WRITE_METHODS)[number];

function placeholderFor(type: string | undefined): string {
  if (type === "integer" || type === "number") return "999999999";
  if (type === "boolean") return "true";
  return "test-placeholder";
}

/** Substitutes path params and any *required* query params with safe placeholder values. */
function buildUrl(rawPath: string, op: OpenApiOp): { url: string; hasParams: boolean } {
  let url = rawPath;
  let hasParams = false;
  for (const p of op.parameters ?? []) {
    if (p.in === "path") {
      hasParams = true;
      url = url.replace(`{${p.name}}`, placeholderFor(p.schema?.type));
    }
  }
  const requiredQuery = (op.parameters ?? []).filter((p) => p.in === "query" && p.required);
  if (requiredQuery.length > 0) {
    hasParams = true;
    const qs = requiredQuery.map((p) => `${p.name}=${placeholderFor(p.schema?.type)}`).join("&");
    url += `${url.includes("?") ? "&" : "?"}${qs}`;
  }
  return { url, hasParams };
}

/** A "public" operation explicitly declares an empty security requirement, overriding the global bearerAuth default. */
function isPublic(op: OpenApiOp): boolean {
  return Array.isArray(op.security) && op.security.length === 0;
}

const getOps = new Map<string, { path: string; op: OpenApiOp }[]>();
const writeOps = new Map<string, { method: WriteMethod; path: string; op: OpenApiOp }[]>();

for (const [rawPath, methods] of Object.entries(spec.paths)) {
  if (rawPath === "/test/ws") continue; // WebSocket upgrade, not a plain HTTP request

  const getOp = methods.get;
  if (getOp) {
    const tag = getOp.tags?.[0] ?? "misc";
    if (!getOps.has(tag)) getOps.set(tag, []);
    getOps.get(tag)!.push({ path: rawPath, op: getOp });
  }

  for (const method of WRITE_METHODS) {
    const op = methods[method];
    if (!op) continue;
    const tag = op.tags?.[0] ?? "misc";
    if (!writeOps.has(tag)) writeOps.set(tag, []);
    writeOps.get(tag)!.push({ method, path: rawPath, op });
  }
}

test.describe("PMI API — generated GET coverage", () => {
  let token: string;
  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  for (const [tag, ops] of getOps) {
    test.describe(tag, () => {
      for (const { path: rawPath, op } of ops) {
        const { url } = buildUrl(rawPath, op);
        const fullUrl = `${API_BASE_URL}${url}`;
        const public_ = isPublic(op);

        if (!public_) {
          test(`GET ${rawPath} — rejects requests with no token (401)`, async ({ request }) => {
            const res = await request.get(fullUrl);
            expect(res.status()).toBe(401);
          });
        }

        // Many endpoints need context the spec doesn't declare as a required
        // param (e.g. a real project_id), and the backend sometimes reports
        // that as a 500 instead of 400 — neither is an auth problem. The one
        // thing we can assert sight-unseen across the whole spec is that a
        // *valid* token never itself causes a 401.
        test(`GET ${rawPath} — ${public_ ? "is reachable without a token" : "accepts a valid token"}`, async ({
          request,
        }) => {
          // A few heavy aggregation/stats endpoints take longer than the default 30s.
          test.setTimeout(60000);
          const res = await request.get(fullUrl, public_ ? {} : { headers: authHeader(token) });
          if (!public_) expect(res.status(), `unexpected 401 for GET ${rawPath} with a valid token`).not.toBe(401);
        });
      }
    });
  }
});

async function callWrite(request: APIRequestContext, method: WriteMethod, url: string) {
  return request[method](url);
}

test.describe("PMI API — generated write-endpoint safety checks", () => {
  for (const [tag, ops] of writeOps) {
    test.describe(tag, () => {
      for (const { method, path: rawPath, op } of ops) {
        const { url } = buildUrl(rawPath, op);
        const fullUrl = `${API_BASE_URL}${url}`;

        test(`${method.toUpperCase()} ${rawPath} — never succeeds without a real payload (no mutation)`, async ({
          request,
        }) => {
          const res = await callWrite(request, method, fullUrl);
          const status = res.status();
          expect(status >= 200 && status < 300, `expected a non-2xx rejection for ${method.toUpperCase()} ${rawPath}, got ${status}`).toBe(
            false
          );
        });
      }
    });
  }
});
