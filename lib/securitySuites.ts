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
