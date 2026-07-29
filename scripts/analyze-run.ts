// Runs the failure analysis against a real run's artifact and prints the
// result. This is the harness for tuning lib/failureAnalysis.ts — it exercises
// the exact code path the /api/runs/[id]/analysis route uses, including the
// Supabase cache, without needing a browser session.
//
//   npx tsx --env-file=.env.local scripts/analyze-run.ts            # newest run with failures
//   npx tsx --env-file=.env.local scripts/analyze-run.ts 12345678   # a specific run id
//   npx tsx --env-file=.env.local scripts/analyze-run.ts --dry      # list failures, no analysis
//   npx tsx --env-file=.env.local scripts/analyze-run.ts --rules    # keyword classifier only, free
//
// Needs GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO, plus ANTHROPIC_API_KEY and
// the Supabase keys unless --dry is passed.
import { analyzeFailures, isAnalysisConfigured, MAX_PER_RUN, ruleAnalysis } from "@/lib/failureAnalysis";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { parsePlaywrightReport } from "@/lib/playwright-report";
import { findReportFile, getReportFiles } from "@/lib/report-artifact";
import { getTestDescription } from "@/lib/testDescriptions";
import { testKey, type TestCaseResult } from "@/lib/types";

const dry = process.argv.includes("--dry");
const rulesOnly = process.argv.includes("--rules");
const runIdArg = process.argv.slice(2).find((a) => /^\d+$/.test(a));

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const config = getGithubConfig();

/** Walks recent completed runs newest-first and returns the first with parseable failures. */
async function findRunWithFailures(): Promise<{ id: string; tests: TestCaseResult[] }> {
  const res = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs?per_page=30&status=completed`
  );
  if (!res.ok) fail(`GitHub API error: ${res.status} ${res.statusText}`);
  const { workflow_runs = [] } = await res.json();

  for (const run of workflow_runs as { id: number; name: string; run_number: number }[]) {
    const tests = await loadTests(String(run.id));
    if (tests?.some((t) => (t.status === "failed" || t.status === "timedOut") && t.error)) {
      console.log(`Using run ${run.id} — ${run.name} #${run.run_number}\n`);
      return { id: String(run.id), tests };
    }
  }
  fail("No completed run in the last 30 had parseable failures. Pass a run id explicitly.");
}

async function loadTests(runId: string): Promise<TestCaseResult[] | null> {
  const files = await getReportFiles(runId, config);
  const raw = files && findReportFile(files, "results.json");
  if (!raw) return null;
  return parsePlaywrightReport(new TextDecoder().decode(raw))?.tests ?? null;
}

async function main(): Promise<void> {
  if (!config.configured) fail("Missing GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO.");
  if (!dry && !rulesOnly && !isAnalysisConfigured()) {
    fail(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local, or pass --rules to use\n" +
        "the free keyword classifier, or --dry to just list the failures."
    );
  }

  const tests = runIdArg
    ? ((await loadTests(runIdArg)) ?? fail(`No parseable results.json in run ${runIdArg}.`))
    : (await findRunWithFailures()).tests;

  const failures = tests.filter((t) => (t.status === "failed" || t.status === "timedOut") && t.error);
  if (failures.length === 0) fail("That run has no failures to analyze.");

  const selected = failures.slice(0, MAX_PER_RUN);
  console.log(`${failures.length} failure(s); analyzing ${selected.length}.\n`);

  if (dry) {
    for (const test of selected) {
      console.log(`── ${test.file}:${test.line} — ${test.titlePath.join(" › ")}`);
      console.log(`   status: ${test.status}   retries: ${test.retries}`);
      console.log(`   stack: ${test.stack ? "yes" : "no"}   snippet: ${test.snippet ? "yes" : "no"}`);
      console.log(`   ${(test.error ?? "").split("\n")[0].slice(0, 120)}\n`);
    }
    return;
  }

  const started = Date.now();
  const analyses = rulesOnly
    ? selected.map((test) => ruleAnalysis(test)).filter((a): a is NonNullable<typeof a> => a !== null)
    : await analyzeFailures(
        selected.map((test) => ({ test, description: getTestDescription(test.file, test.line, "en") }))
      );

  const byKey = new Map(analyses.map((a) => [a.key, a]));
  const counts: Record<string, number> = {};

  for (const test of selected) {
    const a = byKey.get(testKey(test));
    console.log("─".repeat(76));
    console.log(`${test.file}:${test.line} — ${test.titlePath.join(" › ")}`);
    if (!a) {
      console.log("  (not classified — row renders unchanged)\n");
      counts.unclassified = (counts.unclassified ?? 0) + 1;
      continue;
    }
    counts[a.owner] = (counts[a.owner] ?? 0) + 1;
    console.log(`  owner      : ${a.owner.toUpperCase()}  (${a.confidence} confidence, via ${a.source})`);
    console.log(`  cause (en) : ${a.cause.en}`);
    console.log(`  cause (uz) : ${a.cause.uz}`);
    console.log(`  message    : ${a.messageUz ?? "— none (infra) —"}`);
    console.log();
  }

  console.log("─".repeat(76));
  console.log(
    `${analyses.length}/${selected.length} analyzed in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      Object.entries(counts)
        .map(([owner, n]) => `${owner}: ${n}`)
        .join(", ")
  );
  console.log("Re-run to confirm the cache works — it should return instantly with no model calls.");
}

main().catch((err) => fail(String(err instanceof Error ? err.stack ?? err.message : err)));
