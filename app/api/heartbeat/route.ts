import { NextResponse } from "next/server";
import { touchSession } from "@/lib/presence";

// Pinged periodically by components/PresenceHeartbeat.tsx while a tab is
// open, so /api/users/online can tell "currently active" apart from "has an
// unexpired 7-day session cookie".
export async function POST(request: Request) {
  await touchSession(request.headers.get("x-session-id"));
  return NextResponse.json({ ok: true });
}
