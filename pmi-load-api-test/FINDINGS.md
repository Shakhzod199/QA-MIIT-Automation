# PMI API — Load/Stress Capacity Findings

**Date:** 2026-06-29
**Target:** `https://apiproject.miit.uz/api/projects` (PMI backend, test/develop environment)
**Tooling:** k6 load/stress scripts in this folder, plus a focused manual burst test against `/test/login`.

## Summary

PMI's backend handles realistic load well, but has a hard concurrency ceiling
on the **login path** that sits well below where the rest of the API breaks.
Beyond that ceiling, a meaningful fraction of login requests don't fail
cleanly — they hang for up to several minutes with no response at all. This
is the single biggest reliability risk found.

## Load test results (gradual ramp-up, 1-3s think-time per user)

| Concurrent users | Result | Overall failure rate | `/test/login` success |
|---|---|---|---|
| 100 | ✅ Pass | 0% | 100% |
| 200 | ✅ Pass | 0.02% | ~100% |
| 250 | ❌ Fail | 6.81% | 45% |
| 300 | ❌ Fail | 16.26% | 26% |

**Key observation:** the failure rate doesn't degrade smoothly — it's a
cliff between 200 and 250 concurrent users. Below the cliff, everything is
clean; above it, every endpoint degrades, but `/test/login` degrades far
worse than the rest (down to 26-45% success vs. 89-97% for plain GET
endpoints). This held true even during the *steady-state* portion of the
test (after ramp-up finished), not just during the initial ramp — so this is
a real sustained-capacity limit, not just a burst-arrival artifact.

## Stress test results (instant spike, no ramp-up, 0.1-0.3s think-time)

| Concurrent users (instant) | Overall failure rate | `/test/login` success |
|---|---|---|
| 60 | 0.47% (pass, threshold 5%) | 68% |
| 100 | 8.90% (fail, threshold 5%) | 13% |

Same pattern as load: login is the first and worst-hit endpoint under any
form of concurrency pressure, instant or ramped.

## Root-cause investigation: what's actually happening to `/test/login`?

To isolate the login endpoint from everything else, 100 truly simultaneous
`POST /test/login` requests were fired directly (no ramp, no other
endpoints involved). Results:

| Outcome | Count | Response time |
|---|---|---|
| `200 OK` | 53 | ~1-2s |
| `429 Too Many Requests` | 28 | ~1.1-1.4s (fast, clean rejection) |
| **No response at all** (connection-level failure) | **19** | **30s to 300s (5 minutes!)** |

The 429s are a normal, healthy rate limiter doing its job — fast rejection,
client can retry. **The 19% that hang for up to 5 minutes are the real
problem.** They aren't being rejected; they appear to be queued waiting on
some exhausted resource (most likely a fixed-size connection pool or worker
pool scoped to the login/auth path specifically — login is a heavier
operation than a plain GET, involving password verification and JWT
signing). The hang durations cluster around suspicious round multiples
(~30s, ~90s, ~150s, ~300s), consistent with requests queuing behind a
saturated pool with some retry/backoff cycle, rather than failing fast.

## Recommendation for the backend team

1. **Make the login path fail fast under overload, not hang.** Whatever
   capacity limit triggers the 429s should also be the limit that prevents
   the long hangs — right now ~1 in 5 excess requests during a burst get
   stuck instead of cleanly rejected. A request that's going to fail should
   fail in ~1 second like the 429s do, not after 5 minutes.
2. **Investigate the login path's connection/worker pool size specifically.**
   The rest of the API (plain GET endpoints) degrades far more gracefully
   under the same concurrency — 89-97% success at the same load where login
   drops to 26-45%. This points at a resource pool/limit that's scoped
   narrowly to login (DB connections used for password verification,
   JWT-signing worker pool, session-write lock, etc.) rather than a
   general API capacity issue.
3. **Practical capacity ceiling today: ~200-225 concurrent users** before
   failures start climbing sharply. If real-world traffic is expected to
   exceed that, this needs to be addressed before launch/scale-up.

## What we did on the test side

- `load-test.js` is committed at **200 VUs** — the last cleanly-passing
  configuration — as the baseline regression check.
- `stress-test.js` is committed at **60 VUs** — also clean.
- 250/300 VU runs are not committed as permanent thresholds; they were
  exploratory runs to find the ceiling, documented here instead.
