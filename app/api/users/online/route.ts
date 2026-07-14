import { NextResponse } from "next/server";
import { getOnlineUsers } from "@/lib/presence";
import type { OnlineUsersResponse } from "@/lib/types";

export async function GET() {
  try {
    const users = await getOnlineUsers();
    return NextResponse.json<OnlineUsersResponse>({ ok: true, users });
  } catch (err) {
    return NextResponse.json<OnlineUsersResponse>(
      { ok: false, users: [], error: err instanceof Error ? err.message : "Failed to load online users." },
      { status: 400 }
    );
  }
}
