import http from "k6/http";
import { sleep } from "k6";
import { API_BASE_URL, USERNAME, PASSWORD, GET_ENDPOINTS } from "./config.js";

// Diagnostic only — logs VU id, iteration number, and status for every
// request, to see exactly when 429s start appearing per VU. Not part of
// the deliverable; same 1-3s think-time as load-test.js.
export const options = { vus: 30, duration: "20s" };

let token = null;

export default function () {
  if (!token) {
    const res = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify({ username: USERNAME, password: PASSWORD }), {
      headers: { "Content-Type": "application/json" },
    });
    console.log(`VU=${__VU} ITER=${__ITER} action=login status=${res.status}`);
    const body = res.json();
    token = body && body.data && body.data.access_token;
  } else {
    const path = GET_ENDPOINTS[Math.floor(Math.random() * GET_ENDPOINTS.length)];
    const res = http.get(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`VU=${__VU} ITER=${__ITER} action=get status=${res.status}`);
  }
  sleep(1 + Math.random() * 2);
}
