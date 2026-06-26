import { sleep } from "k6";
import { login, logout, getRandomEndpoint } from "./helpers.js";

// Per-VU state. k6 gives each virtual user its own isolated JS runtime for
// its whole lifetime, so this module-level variable persists across all of
// that VU's iterations — it logs in once and reuses the token, instead of
// re-authenticating on every single request.
let token = null;

/**
 * Builds the per-iteration function for a scenario. `minSleepS`/`maxSleepS`
 * control the think-time between actions — discovered via manual probing
 * that the live API rate-limits aggressively (429 "Too many requests") with
 * zero think-time, even from a single VU. Load test uses realistic pacing;
 * stress test uses much shorter pacing on purpose, to actually probe that
 * rate limit under sustained concurrent load.
 */
export function makeIterate(minSleepS, maxSleepS) {
  return function iterate() {
    if (!token) {
      token = login();
    }

    // ~10% of iterations: log out and back in instead of a data GET, so
    // /auth/login and /auth/logout both receive continuous, realistic load
    // throughout the run (proportional to how many VUs are active), rather
    // than only once per VU at startup.
    if (Math.random() < 0.1) {
      logout(token);
      token = login();
    } else {
      getRandomEndpoint(token);
    }

    sleep(minSleepS + Math.random() * (maxSleepS - minSleepS));
  };
}
