# Export API load & stress tests (k6)

Two k6 scripts against the real `export.miit.uz` API (same one the Playwright
`export-api` suite covers), exercising the 12 GET endpoints from the
Companies/Header/Map groups plus `/auth/login` and `/auth/logout`.

- **load-test.js** — ramps 0 → 30 virtual users over 30s, holds 30 for the
  remaining 60s (90s total). 1-3s think-time between actions per VU —
  simulates realistic expected traffic.
- **stress-test.js** — spikes straight to 30 VUs with no ramp-up, holds for
  the full 90s. 0.1-0.3s think-time — deliberately aggressive, to probe
  past comfortable capacity rather than just confirm normal-load behavior.

Each virtual user logs in once and reuses its token for GET requests; ~10%
of iterations log out and back in instead, so `/auth/login` and
`/auth/logout` get continuous, proportional load too (not just once per VU).

**Known finding:** the live API rate-limits aggressively — a single VU with
no think-time alone trips `429 Too many requests` within seconds. Both
scripts' pacing was chosen with that in mind; expect the stress test to hit
it on purpose.

## Running

```sh
./run.sh load     # or: ./run.sh stress
```

Reads `EXPORT_USERNAME` / `EXPORT_PASSWORD` (and optional `BASE_URL`) from
`../.env.local`, same as the Playwright export tests.
