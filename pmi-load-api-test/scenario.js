import { sleep } from "k6";
import { login, getRandomEndpoint } from "./helpers.js";

// Per-VU state. k6 gives each virtual user its own isolated JS runtime for
// its whole lifetime, so this module-level variable persists across all of
// that VU's iterations — it logs in once and reuses the token, instead of
// re-authenticating on every single request (same pattern as the export
// load/stress scripts, see export-load-api-test/scenario.js).
let token = null;

/**
 * Builds the per-iteration function for a scenario. `minSleepS`/`maxSleepS`
 * control the think-time between actions. Load test uses realistic pacing;
 * stress test uses much shorter pacing on purpose, to push past comfortable
 * capacity rather than just confirm normal-load behavior.
 */
export function makeIterate(minSleepS, maxSleepS) {
  return function iterate() {
    if (!token) {
      token = login();
    }

    getRandomEndpoint(token);

    sleep(minSleepS + Math.random() * (maxSleepS - minSleepS));
  };
}
