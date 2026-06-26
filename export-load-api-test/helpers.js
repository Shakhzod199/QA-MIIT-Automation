import http from "k6/http";
import { check } from "k6";
import { API_BASE_URL, USERNAME, PASSWORD, GET_ENDPOINTS } from "./config.js";

export function login() {
  const res = http.post(
    `${API_BASE_URL}/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "POST /auth/login" } }
  );
  check(res, { "login: status 200": (r) => r.status === 200 });
  const body = res.json();
  return body && body.data && body.data.access_token;
}

export function logout(token) {
  const res = http.post(`${API_BASE_URL}/auth/logout`, null, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: "POST /auth/logout" },
  });
  check(res, { "logout: not a server error": (r) => r.status < 500 });
  return res;
}

/** Hits one random GET endpoint from the target list with the given token. */
export function getRandomEndpoint(token) {
  const path = GET_ENDPOINTS[Math.floor(Math.random() * GET_ENDPOINTS.length)];
  const res = http.get(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: `GET ${path}` },
  });
  check(res, { [`${path}: status 200`]: (r) => r.status === 200 });
  return res;
}
