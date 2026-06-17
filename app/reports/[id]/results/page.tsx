import Link from "next/link";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={`/reports/${id}`} className="hover:text-white">
            ← Back to Run
          </Link>
          <span>/</span>
          <span className="text-white">Test Results</span>
        </div>
        <a
          href={`/api/runs/${id}/report`}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Download zip
        </a>
      </div>

      <iframe
        src={`/api/runs/${id}/report/index.html`}
        className="w-full flex-1 rounded-lg border border-surface-border bg-white"
        style={{ minHeight: "calc(100vh - 120px)" }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="Playwright Test Report"
      />
    </div>
  );
}
