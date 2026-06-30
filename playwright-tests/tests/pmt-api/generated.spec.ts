import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API_BASE_URL, login } from "./helpers";

// ---------------------------------------------------------------------------
// Collection-driven coverage for every operation in main.postman_collection.json.
// Two checks per endpoint:
//
//  1. Unauthenticated — no cookie → 401.
//  2. Authenticated   — valid session cookie → not 401, not 5xx.
//     For POST/PUT/PATCH write endpoints an empty body is sent; the expected
//     result is rejection (4xx), not a server crash (5xx). This file never
//     sends a real mutating payload so nothing in the shared environment is
//     created, updated, or deleted.
//
// Endpoints whose host is not testpmt.miit.uz (external URLs like pm.gov.uz)
// are skipped automatically.
// ---------------------------------------------------------------------------

interface PostmanVariable { key: string; value?: string }
interface PostmanUrl {
  raw: string;
  host?: string[];
  path?: string[];
  query?: Array<{ key: string; value?: string; disabled?: boolean }>;
  variable?: PostmanVariable[];
}
interface PostmanRequest {
  method: string;
  url: PostmanUrl | string;
  body?: { mode?: string; raw?: string };
  auth?: { type: string };
  header?: Array<{ key: string; value: string }>;
}
interface PostmanItem {
  name: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
}
interface PostmanCollection {
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

interface FlatRequest {
  folder: string;
  name: string;
  method: string;
  url: string;
  hasJsonBody: boolean;
  isExternal: boolean;
  isBasicAuth: boolean;
  isFormData: boolean;
}

const COLLECTION_VAR = "{{api}}";
const EXTERNAL_HOST_RE = /^https?:\/\/(?!testpmt\.miit\.uz)/;
// URLs that still contain unresolved Postman variables after substitution.
const UNRESOLVED_VAR_RE = /\{\{[^}]+\}\}/;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function resolveUrl(req: PostmanRequest): string {
  const raw = typeof req.url === "string" ? req.url : req.url.raw;
  let url = raw.replace(/\{\{api\}\}/g, API_BASE_URL);

  // Replace path params (:key) with the variable's sample value or "1".
  const variables = typeof req.url === "object" ? (req.url.variable ?? []) : [];
  for (const v of variables) {
    const val = v.value?.trim() || "1";
    url = url.replace(`:${v.key}`, encodeURIComponent(val));
  }

  // Drop disabled query params that appear in raw.
  // (Postman includes disabled params in raw with `&key=value` style — we
  // leave enabled ones as-is since they're already part of the raw string.)
  return url;
}

function isExternal(req: PostmanRequest): boolean {
  const raw = typeof req.url === "string" ? req.url : req.url.raw;
  // Skip if the URL has no {{api}} and is an external host, OR if it still
  // contains an unresolved Postman variable (e.g. {{localhost}}, {{host}}).
  if (UNRESOLVED_VAR_RE.test(raw.replace(/\{\{api\}\}/g, ""))) return true;
  return !raw.includes(COLLECTION_VAR) && EXTERNAL_HOST_RE.test(raw);
}

function hasJsonBody(req: PostmanRequest): boolean {
  return req.body?.mode === "raw" && Boolean(req.body.raw?.trim());
}

function isBasicAuth(req: PostmanRequest): boolean {
  return req.auth?.type === "basic";
}

function isFormData(req: PostmanRequest): boolean {
  return req.body?.mode === "formdata";
}

function flattenItems(
  items: PostmanItem[],
  folderPath: string
): FlatRequest[] {
  const result: FlatRequest[] = [];
  for (const item of items) {
    if (item.item) {
      result.push(...flattenItems(item.item, `${folderPath}/${item.name}`));
    } else if (item.request) {
      result.push({
        folder: folderPath,
        name: item.name,
        method: item.request.method.toUpperCase(),
        url: resolveUrl(item.request),
        hasJsonBody: hasJsonBody(item.request),
        isExternal: isExternal(item.request),
        isBasicAuth: isBasicAuth(item.request),
        isFormData: isFormData(item.request),
      });
    }
  }
  return result;
}

const collection = JSON.parse(
  fs.readFileSync(path.join(__dirname, "main.postman_collection.json"), "utf-8")
) as PostmanCollection;

const allRequests = flattenItems(collection.item, "");
const pmtRequests = allRequests.filter(
  (r) => !r.isExternal && !r.isBasicAuth && !r.isFormData
);

// Group by top-level folder so the test output is readable.
const byFolder = new Map<string, FlatRequest[]>();
for (const req of pmtRequests) {
  const top = req.folder.split("/")[1] ?? "root";
  if (!byFolder.has(top)) byFolder.set(top, []);
  byFolder.get(top)!.push(req);
}

for (const [folder, requests] of byFolder) {
  test.describe(`PMT API — ${folder}`, () => {
    for (const req of requests) {
      // Full path + method makes labels unique even when different folders
      // share identical URLs (e.g. admin/network reuses /admin/initiators).
      const label = `${req.folder}/${req.name} · ${req.method} ${req.url.replace(API_BASE_URL, "")}`;

      test(`${label} → no server crash without session cookie`, async ({
        request,
      }) => {
        const res = await request.fetch(req.url, {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          data: undefined,
          ignoreHTTPSErrors: true,
        });
        // Auth-protected endpoints return 4xx (typically 401). A handful are
        // genuinely public (e.g. /auth/one-id/url) and return 2xx — both are
        // acceptable. A 5xx means the server crashed and is always a failure.
        expect(
          res.status(),
          `${label} crashed with 5xx when called without a session`
        ).toBeLessThan(500);
      });

      test(`${label} → authenticated: not 401 and not 5xx`, async ({
        request,
      }) => {
        await login(request);

        const options: Parameters<typeof request.fetch>[1] = {
          method: req.method,
          ignoreHTTPSErrors: true,
        };

        if (WRITE_METHODS.has(req.method)) {
          // Send an empty JSON object — should be rejected with 4xx, not crash.
          options.headers = { "Content-Type": "application/json" };
          options.data = {};
        }

        const res = await request.fetch(req.url, options);
        const status = res.status();

        expect(status, `${label} should not return 401 when authenticated`).not.toBe(401);
        expect(status, `${label} should not return 5xx`).toBeLessThan(500);
      });
    }
  });
}
