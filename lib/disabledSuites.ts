// Suites temporarily pulled from the dashboard's run controls (manual and
// scheduled) because the target environment itself is broken, not the tests.
// Remove a workflow's name from here once the underlying issue is fixed.
export const DISABLED_SUITES: Record<string, string> = {
  "PMT Tests": "PMT is disabled — the testpmt.miit.uz login is broken server-side.",
};

export function getSuiteDisabledReason(workflowName: string | undefined): string | null {
  if (!workflowName) return null;
  return DISABLED_SUITES[workflowName] ?? null;
}
