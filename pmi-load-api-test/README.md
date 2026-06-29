# PMI API load & stress tests (k6)

Two k6 scripts against the real `apiproject.miit.uz` backend (the same one
the Playwright `pmi-api` suite covers), exercising 11 GET endpoints:

- `/v2/user/me`
- `/general/statistics`
- `/project/list` (called with `?limit=20` — with no params it returns the
  *entire* unpaginated dataset, ~20MB / 20-25s per call, which has nothing to
  do with concurrency and isn't representative of real traffic)
- `/additional/statistics`
- `/notification/list`
- `/project/countries-map-statistics`
- `/status/statistics/in-program`
- `/project_types/list`
- `/step/statistics` (called with `?project_type_id=1` — it 500s without it)
- `/sphere/list`
- `/network/statistics`

- **load-test.js** — ramps 0 → 30 virtual users over 30s, holds 30 for the
  remaining 60s (90s total). 1-3s think-time between actions per VU —
  simulates realistic expected traffic.
- **stress-test.js** — spikes straight to 30 VUs with no ramp-up, holds for
  the full 90s. 0.1-0.3s think-time — deliberately aggressive, to probe
  past comfortable capacity rather than just confirm normal-load behavior.

Each virtual user logs in once (via `/test/login`) and reuses its token for
every GET request — no login/logout cycling, same as the export load/stress
scripts.

## Running

```sh
./run.sh load     # or: ./run.sh stress
```

Reads `PMI_USERNAME` / `PMI_PASSWORD` (and optional `PMI_API_BASE_URL`) from
`../.env.local`, same credentials the Playwright `pmi-api` suite uses.
