import { NextResponse } from "next/server";
import { getDailyVisits } from "@/lib/visits";
import type { VisitsResponse } from "@/lib/types";

export async function GET(request: Request) {
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 7));

  try {
    const data = await getDailyVisits(days);
    return NextResponse.json<VisitsResponse>({ ok: true, days: data });
  } catch (err) {
    return NextResponse.json<VisitsResponse>(
      { ok: false, days: [], error: err instanceof Error ? err.message : "Failed to load visits." },
      { status: 400 }
    );
  }
}
