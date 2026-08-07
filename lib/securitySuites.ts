// Suites that actually have a security test project wired up (a `security`
// workflow_dispatch option + a dedicated Playwright project). Only Export
// has this today — see export-tests.yml's `type: security` option and
// playwright-tests/tests/export-api-security/. PMI/PMT/SEZ have no such
// project, so their "Security" tab would only ever show an empty state;
// hide it there until security tests are actually built for them too.
const SECURITY_ENABLED_SUITES = new Set(["Export Tests"]);

export function suiteHasSecurityTests(workflowName: string | undefined): boolean {
  return !!workflowName && SECURITY_ENABLED_SUITES.has(workflowName);
}

// Same idea for API tests. Export/PMI/PMT each have a dedicated api Playwright
// project (export-api, pmi-api, pmt-api) wired to their workflow's `type: api`
// option. SEZ does not — sez-tests.yml's api branch just prints "API tests are
// not configured yet for SEZ" and exits 1 — so its API tab could only ever
// offer a Run button that fails. Add SEZ here once tests/sez-api/ exists.
const API_ENABLED_SUITES = new Set(["Export Tests", "PMI Tests", "PMT Tests"]);

export function suiteHasApiTests(workflowName: string | undefined): boolean {
  return !!workflowName && API_ENABLED_SUITES.has(workflowName);
}
