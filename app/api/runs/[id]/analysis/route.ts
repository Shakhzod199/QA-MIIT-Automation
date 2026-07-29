import { NextResponse } from "next/server";
import { canAccessWorkflow, getRunWorkflowId } from "@/lib/access";
import {
  analyzeFailures,
  isAnalysisConfigured,
  MAX_PER_RUN,
  type AnalysisInput,
} from "@/lib/failureAnalysis";
import { getGithubConfig } from "@/lib/github";
import { getReportFiles, findReportFile } from "@/lib/report-artifact";
import { parsePlaywrightReport } from "@/lib/playwright-report";
import { getTestDescription } from "@/lib/testDescriptions";
import type { RunAnalysisResponse } from "@/lib/types";

// Analyzing a cold run makes several model calls; the default 300s function
// timeout is ample, but say so explicitly rather than relying on it.
export const maxDuration = 300;

function empty(extra?: Partial<RunAnalysisResponse>): RunAnalysisResponse {
  return { configured: true, analyses: [], ...extra };
}

/**
 * Owner tag, plain-language cause, and a ready-to-send message for each failed
 * test in a run. Purely additive: when this returns `configured: false` or an
 * error, the summary page renders exactly as it did before the feature existed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAnalysisConfigured()) {
    return NextResponse.json<RunAnalysisResponse>({ configured: false, analyses: [] });
  }

  const config = getGithubConfig();
  if (!config.configured) {
    return NextResponse.json<RunAnalysisResponse>({ configured: false, analyses: [] });
  }

  const { id } = await params;

  // Same access gate as /api/runs/[id]/tests — the analysis quotes the error
  // text, so it must not be readable by anyone who can't read the run itself.
  const workflowId = await getRunWorkflowId(id);
  if (workflowId != null && !(await canAccessWorkflow(request, workflowId))) {
    return NextResponse.json(empty({ error: "You don't have access to this project." }), { status: 403 });
  }

  const files = await getReportFiles(id, config);
  const raw = files && findReportFile(files, "results.json");
  if (!raw) return NextResponse.json(empty());

  const parsed = parsePlaywrightReport(new TextDecoder().decode(raw));
  if (!parsed) return NextResponse.json(empty({ error: "Could not parse results.json." }));

  const failures = parsed.tests.filter(
    (test) => (test.status === "failed" || test.status === "timedOut") && test.error
  );
  if (failures.length === 0) return NextResponse.json(empty());

  // One broken login step can fail a hundred tests; cap the work so a single
  // page view can't turn into a hundred model calls.
  const selected = failures.slice(0, MAX_PER_RUN);

  const inputs: AnalysisInput[] = selected.map((test) => ({
    test,
    // Reuse the hand-written description of what the test checks — it gives the
    // model the intent behind an assertion the error text alone doesn't convey.
    description: getTestDescription(test.file, test.line, "en"),
  }));

  try {
    const analyses = await analyzeFailures(inputs);
    return NextResponse.json<RunAnalysisResponse>({
      configured: true,
      analyses,
      ...(failures.length > selected.length
        ? { limited: { analyzed: selected.length, total: failures.length } }
        : {}),
    });
  } catch (err) {
    console.error("[analysis] failed for run", id, err);
    return NextResponse.json(empty({ error: "Analysis is temporarily unavailable." }));
  }
}
