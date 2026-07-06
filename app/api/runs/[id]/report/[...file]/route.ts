import { NextResponse } from "next/server";
import { canAccessWorkflow, getRunWorkflowId } from "@/lib/access";
import { getGithubConfig } from "@/lib/github";
import { getReportFiles } from "@/lib/report-artifact";

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  css: "text/css",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  webp: "image/webp",
};

function contentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; file: string[] }> }
) {
  const config = getGithubConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "GitHub is not configured." }, { status: 400 });
  }

  const { id, file } = await params;
  const filePath = file.join("/");

  const workflowId = await getRunWorkflowId(id);
  if (workflowId != null && !(await canAccessWorkflow(req, workflowId))) {
    return NextResponse.json({ error: "You don't have access to this project." }, { status: 403 });
  }

  const files = await getReportFiles(id, config);
  if (!files) {
    return NextResponse.json({ error: "Report artifact not found." }, { status: 404 });
  }

  // Try the path as-is, then with a playwright-report/ prefix (artifact zip
  // structure can vary depending on how the workflow uploaded the directory).
  const content =
    files.get(filePath) ??
    files.get(`playwright-report/${filePath}`) ??
    // index.html fallback for SPA-style deep links within the report
    (filePath === "index.html" ? files.get("index.html") : undefined);

  if (!content) {
    return NextResponse.json({ error: `File not found in report: ${filePath}` }, { status: 404 });
  }

  return new NextResponse(Buffer.from(content), {
    headers: { "Content-Type": contentType(filePath) },
  });
}
