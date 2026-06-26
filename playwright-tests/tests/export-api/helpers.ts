import { expect, type APIRequestContext } from "@playwright/test";

// Single source of truth for target + credentials. No credential lives in
// source: EXPORT_USERNAME / EXPORT_PASSWORD must come from the environment
// (locally via .env.local, in CI via GitHub Actions secrets). Same account
// tests/export/helpers.ts uses for the UI login.
function requireCredential(name: "EXPORT_USERNAME" | "EXPORT_PASSWORD"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Provide it via the ${name} env var (locally in .env.local, or as a GitHub Actions secret in CI) before running the export API tests.`
    );
  }
  return value;
}

export const API_BASE_URL = `${(process.env.BASE_URL ?? "https://export.miit.uz").replace(/\/+$/, "")}/api/v1`;
export const USERNAME = requireCredential("EXPORT_USERNAME");
export const PASSWORD = requireCredential("EXPORT_PASSWORD");

/** Logs in via /auth/login and returns the JWT access token. */
export async function login(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: USERNAME, password: PASSWORD },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body.data.access_token as string;
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
