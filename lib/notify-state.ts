import { promises as fs } from "fs";
import path from "path";

// Best-effort local state for which run IDs we've already alerted on, so the
// poller never sends a duplicate. Stored as a small JSON file (not a database).
// On an ephemeral/serverless filesystem this resets between deploys — that only
// risks a re-alert after reset, never a missed alert, so it degrades safely.
const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "notify-state.json");
const MAX_IDS = 500;

export interface NotifyState {
  /** True once we've recorded a baseline, so we don't blast every historic run. */
  seeded: boolean;
  /** Run IDs already alerted on, newest first, capped to MAX_IDS. */
  notified: number[];
}

export async function loadState(): Promise<NotifyState> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      seeded: Boolean(parsed.seeded),
      notified: Array.isArray(parsed.notified) ? parsed.notified : [],
    };
  } catch {
    return { seeded: false, notified: [] };
  }
}

export async function saveState(state: NotifyState): Promise<boolean> {
  const trimmed: NotifyState = {
    seeded: state.seeded,
    notified: [...new Set(state.notified)].sort((a, b) => b - a).slice(0, MAX_IDS),
  };
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(trimmed), "utf8");
    return true;
  } catch {
    return false; // FS not writable (e.g. serverless) — caller continues anyway.
  }
}
