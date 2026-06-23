import { test, expect } from "@playwright/test";

// Sample backend ("api" type) test — runs over HTTP via Playwright's
// `request` fixture, no browser involved. This is intentionally a smoke
// check (no Swagger/spec wired up yet); it exists to prove the "api" branch
// of the dispatch dropdown actually exercises real tests instead of the
// placeholder failure. Replace/extend once the Swagger link is provided.
const BASE_URL = (process.env.PMI_BASE_URL ?? "https://testpmi.miit.uz").replace(/\/+$/, "");

test.describe("PMI API smoke", () => {
  test("auth page responds OK", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/auth`);
    expect(response.ok()).toBeTruthy();
  });

  test("root redirects (not a server error)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`, { maxRedirects: 0 });
    expect(response.status()).toBeLessThan(500);
  });
});
