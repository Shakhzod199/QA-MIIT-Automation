import { expect, type APIRequestContext } from "@playwright/test";

const RAW = process.env.PMT_API_BASE_URL ?? "https://testpmt.miit.uz/api";
export const API_BASE_URL = RAW.replace(/\/+$/, "");

export const USERNAME = process.env.PMT_API_USERNAME ?? "admin";
export const PASSWORD = process.env.PMT_API_PASSWORD ?? "Postman@11";

/**
 * Logs in and stores the session cookie in the request context.
 * The JWT arrives as an httpOnly "accessToken" cookie — the APIRequestContext
 * persists and re-sends it automatically for all subsequent calls.
 */
export async function login(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: USERNAME, password: PASSWORD },
  });
  expect(res.ok(), `PMT API login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}
