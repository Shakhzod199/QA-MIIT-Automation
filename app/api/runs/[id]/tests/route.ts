import { NextResponse } from "next/server";
import { canAccessWorkflow, getRunWorkflowId } from "@/lib/access";
import { getGithubConfig } from "@/lib/github";
import { getReportFiles, findReportFile } from "@/lib/report-artifact";
import { parsePlaywrightReport } from "@/lib/playwright-report";
import type { TestReportResponse } from "@/lib/types";

const EMPTY_SUMMARY = {
  total: 0,
  passed: 0,
  failed: 0,
  flaky: 0,
  skipped: 0,
  durationMs: 0,
};

function unavailable(extra?: Partial<TestReportResponse>): TestReportResponse {
  return {
    configured: true,
    available: false,
    summary: EMPTY_SUMMARY,
    tests: [],
    ...extra,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<TestReportResponse>({
      configured: false,
      available: false,
      summary: EMPTY_SUMMARY,
      tests: [],
    });
  }

  const { id } = await params;

  const workflowId = await getRunWorkflowId(id);
  if (workflowId != null && !(await canAccessWorkflow(request, workflowId))) {
    return NextResponse.json(unavailable({ error: "You don't have access to this project." }), { status: 403 });
  }

  const files = await getReportFiles(id, config);
  if (!files) {
    return NextResponse.json(unavailable());
  }

  const raw = findReportFile(files, "results.json");
  if (!raw) {
    return NextResponse.json(
      unavailable({
        error:
          "No results.json in the report artifact. Add the Playwright JSON reporter to capture test-level results.",
      })
    );
  }

  const parsed = parsePlaywrightReport(new TextDecoder().decode(raw));
  if (!parsed) {
    return NextResponse.json(unavailable({ error: "Could not parse results.json." }));
  }

  return NextResponse.json<TestReportResponse>({
    configured: true,
    available: true,
    summary: parsed.summary,
    tests: parsed.tests,
  });
}
