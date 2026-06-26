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

    // The dev team confirmed /auth/login and /auth/logout specifically have
    // a much lower rate limit than the GET data endpoints. Repeatedly
    // re-authenticating here was tripping THAT limit, not the GET endpoints'
    // — masking what the GET endpoints can actually handle on their own.
    // Disabled for now so this run isolates GET-endpoint capacity; each VU
    // logs in once and reuses that token for every iteration.
    //
    // if (Math.random() < 0.1) {
    //   logout(token);
    //   token = login();
    // } else {
    //   getRandomEndpoint(token);
    // }
    getRandomEndpoint(token);

    sleep(minSleepS + Math.random() * (maxSleepS - minSleepS));
  };
}
