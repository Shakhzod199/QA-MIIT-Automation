import { expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL, login, authHeader } from "../export-api/helpers";

// Re-exported so spec files only need one import path for this project.
export { API_BASE_URL, login, authHeader };

// Optional on purpose (unlike export-api/helpers's requireCredential): the
// spec self-skips when these are absent instead of throwing, so the rest of
// the export-api project still runs fine without a viewer account configured.
export const VIEWER_USERNAME = process.env.EXPORT_VIEWER_USERNAME;
export const VIEWER_PASSWORD = process.env.EXPORT_VIEWER_PASSWORD;

/** Logs in the lower-privileged fixture account and returns its JWT access token. */
export async function loginViewer(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: VIEWER_USERNAME, password: VIEWER_PASSWORD },
  });
  expect(res.ok(), `viewer login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body.data.access_token as string;
}
