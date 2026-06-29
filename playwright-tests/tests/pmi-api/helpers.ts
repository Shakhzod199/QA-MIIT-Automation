import { expect, type APIRequestContext } from "@playwright/test";

// Single source of truth for target + credentials. No credential lives in
// source: PMI_USERNAME / PMI_PASSWORD must come from the environment
// (locally via .env.local, in CI via GitHub Actions secrets). Same OneID
// account tests/pmi-tests/login.spec.ts uses for the UI login — it also
// works against the backend's /test/login endpoint.
function requireCredential(name: "PMI_USERNAME" | "PMI_PASSWORD"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Provide it via the ${name} env var (locally in .env.local, or as a GitHub Actions secret in CI) before running the PMI API tests.`
    );
  }
  return value;
}

// The backend lives on a different host (apiproject.miit.uz) than the PMI
// frontend (testpmi.miit.uz), so this is intentionally its own env var
// rather than reusing PMI_BASE_URL.
export const API_BASE_URL = `${(process.env.PMI_API_BASE_URL ?? "https://apiproject.miit.uz").replace(/\/+$/, "")}/api/projects`;
export const USERNAME = requireCredential("PMI_USERNAME");
export const PASSWORD = requireCredential("PMI_PASSWORD");

/** Logs in via /test/login and returns the JWT access token. */
export async function login(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/test/login`, {
    data: { username: USERNAME, password: PASSWORD },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body.data.access_token as string;
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
