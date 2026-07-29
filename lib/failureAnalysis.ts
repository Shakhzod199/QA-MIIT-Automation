import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { classifyFailure } from "@/lib/failureRules";
import { getSupabaseAdmin } from "@/lib/supabase";
import { testKey, type FailureAnalysis, type FailureOwner, type TestCaseResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Turns a failed Playwright test into a plain-language cause, an owner tag,
// and a ready-to-send Uzbek message.
//
// Results are cached in Supabase by a fingerprint of (file:line + normalized
// error) rather than by run, so a test that has been failing the same way for
// a fortnight costs one generation rather than one per run. A genuinely
// different error on the same test normalizes differently and is analyzed
// afresh.
//
// Everything here is best-effort: with no ANTHROPIC_API_KEY, or on any API
// error, callers get no analysis and the UI falls back to showing the raw
// error exactly as it did before this feature existed.
// ---------------------------------------------------------------------------

const MODEL = process.env.ANALYSIS_MODEL ?? "claude-sonnet-5";

/** Guards against one broken login step turning into 100 analyses on a single page load. */
export const MAX_PER_RUN = Number(process.env.ANALYSIS_MAX_PER_RUN ?? 20);

/** How many analyses to generate at once. Keeps a cold run well inside the function timeout. */
const CONCURRENCY = 4;

export function isAnalysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Strips the parts of an error that differ run to run — timestamps, durations,
 * ids, long digit runs — so the same failure recurring across runs hashes
 * identically. Short numbers are deliberately kept: "expected 0, received
 * 11.2" is the substance of the failure, not noise.
 */
function normalizeError(error: string): string {
  return error
    .replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?/g, "<timestamp>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b\d+(\.\d+)?\s?ms\b/g, "<duration>")
    .replace(/\b[0-9a-f]{12,}\b/gi, "<hash>")
    .replace(/\b\d{4,}\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(test: Pick<TestCaseResult, "file" | "line">, error: string): string {
  return createHash("sha256")
    .update(`${test.file}:${test.line}|${normalizeError(error)}`)
    .digest("hex");
}

// --- model contract --------------------------------------------------------

const OWNERS: FailureOwner[] = ["backend", "frontend", "test", "infra"];

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    owner: {
      type: "string",
      enum: OWNERS,
      description:
        "Who needs to act. 'backend' = the API returned wrong/missing data or an error. " +
        "'frontend' = the API was fine but the page mishandled it. " +
        "'test' = the automation itself is wrong (stale selector, bad assertion). " +
        "'infra' = login, session, credentials, CI network or host slowness — nobody's product is broken.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    cause_en: { type: "string", description: "One or two sentences, plain language, no jargon." },
    cause_uz: { type: "string", description: "The same explanation in Uzbek (Latin script)." },
    cause_ru: { type: "string", description: "The same explanation in Russian." },
    message_uz: {
      type: "string",
      description:
        "Uzbek message to send on. For backend/frontend address the dev team and say concretely " +
        "what to fix, citing the evidence. For 'test' address the QA engineer. For 'infra' " +
        "return an empty string — there is nobody to message.",
    },
  },
  required: ["owner", "confidence", "cause_en", "cause_uz", "cause_ru", "message_uz"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You triage failing Playwright end-to-end tests for MIIT's QA dashboard and explain them to non-engineers.

The suites under test:
- export  — the new-export trade dashboard (frontend export.miit.uz, API export.miit.uz)
- pmi     — the investment-projects app (frontend testpmi.miit.uz, API apiproject.miit.uz)
- pmt     — the enterprise-monitoring app (frontend testpmt.miit.uz)
- sez     — the special-economic-zones app (frontend testsez2.miit.uz)

Assign exactly one owner. The tags are not interchangeable, and misrouting costs the QA team credibility with the dev teams:

- backend — the API is at fault: a 4xx/5xx from an endpoint, a payload missing fields the UI needs, wrong or stale values in the response, a database or SQL error surfacing through the API.
- frontend — the API returned correct data and the page mishandled it: values not rendered, rendered in the wrong place, wrong query parameters sent, an element that never appears despite the data being present.
- test — the automation is at fault: a selector that no longer matches because the UI legitimately changed, an assertion encoding an outdated expectation, a hard-coded value that has drifted. Choose this when the product looks correct and the spec is what is out of date.
- infra — nobody's product is broken: login or session failure, expired or missing credentials, a timeout caused by host slowness or CI network, a browser or worker crash, contention between parallel workers. Failures in a shared login/auth setup step are almost always this.

Rules:
- Judge only from the evidence given. If the error does not clearly indicate a cause, pick the best-supported owner and set confidence to "low" — do not invent a mechanism.
- Write the cause for a non-technical stakeholder: what broke, in terms of what a user would see. No stack frames, no selector syntax, no code identifiers.
- The dev message is different: it is for an engineer. Be specific and cite the concrete evidence (endpoint, status code, expected vs actual value). Uzbek, Latin script, polite and direct, no filler.
- For owner "infra" return an empty string for message_uz. There is no team to notify — it needs a retry or a credential fix.
- For owner "test" the message addresses the QA engineer who owns the spec, not the dev team.`;

export interface AnalysisInput {
  test: Pick<TestCaseResult, "file" | "line" | "titlePath" | "project" | "status" | "error" | "stack" | "snippet" | "retries">;
  /** The existing plain-language description of what this test checks, if we have one. */
  description: string | null;
}

function buildUserPrompt({ test, description }: AnalysisInput): string {
  const parts = [
    `Suite/project: ${test.project || "unknown"}`,
    `Spec file: ${test.file}:${test.line}`,
    `Test name: ${test.titlePath.join(" › ")}`,
    `Result: ${test.status}${test.retries > 0 ? ` (after ${test.retries} retr${test.retries === 1 ? "y" : "ies"})` : ""}`,
  ];
  if (description) parts.push(`What this test checks: ${description}`);
  parts.push(`\nError:\n${test.error ?? "(no error message captured)"}`);
  if (test.snippet) parts.push(`\nFailing code:\n${test.snippet}`);
  if (test.stack) parts.push(`\nStack trace:\n${test.stack}`);
  return parts.join("\n");
}

interface ModelOutput {
  owner: FailureOwner;
  confidence: "high" | "medium" | "low";
  cause_en: string;
  cause_uz: string;
  cause_ru: string;
  message_uz: string;
}

let cachedClient: Anthropic | undefined;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

async function generate(input: AnalysisInput): Promise<ModelOutput> {
  const response = await getClient().messages.create({
    model: MODEL,
    // Adaptive thinking is on by default on Sonnet 5 and max_tokens caps
    // thinking plus output, so leave headroom well above the ~600-token JSON.
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    output_config: {
      // Classification plus a short piece of writing — the default "high" buys
      // little here and costs latency on the first view of a failing run.
      effort: "medium",
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") {
    throw new Error(`no text block in response (stop_reason: ${response.stop_reason})`);
  }
  const parsed = JSON.parse(text.text) as ModelOutput;
  if (!OWNERS.includes(parsed.owner)) {
    throw new Error(`model returned an unknown owner: ${parsed.owner}`);
  }
  return parsed;
}

// --- cache -----------------------------------------------------------------

interface CachedRow {
  fingerprint: string;
  owner: FailureOwner;
  confidence: "high" | "medium" | "low";
  cause_en: string;
  cause_uz: string;
  cause_ru: string;
  message_uz: string | null;
}

function toAnalysis(row: CachedRow, key: string): FailureAnalysis {
  return {
    fingerprint: row.fingerprint,
    key,
    owner: row.owner,
    confidence: row.confidence,
    source: "model",
    cause: { en: row.cause_en, uz: row.cause_uz, ru: row.cause_ru },
    messageUz: row.message_uz || null,
  };
}

async function readCache(fingerprints: string[]): Promise<Map<string, CachedRow>> {
  if (fingerprints.length === 0) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from("failure_analysis")
    .select("fingerprint, owner, confidence, cause_en, cause_uz, cause_ru, message_uz")
    .in("fingerprint", fingerprints);
  if (error) throw new Error(`failure_analysis read failed: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.fingerprint as string, row as CachedRow]));
}

async function writeCache(fp: string, test: AnalysisInput["test"], out: ModelOutput): Promise<void> {
  const { error } = await getSupabaseAdmin().from("failure_analysis").upsert(
    {
      fingerprint: fp,
      test_file: test.file,
      test_line: test.line,
      owner: out.owner,
      confidence: out.confidence,
      cause_en: out.cause_en,
      cause_uz: out.cause_uz,
      cause_ru: out.cause_ru,
      // 'infra' has nobody to message; store null rather than an empty string.
      message_uz: out.owner === "infra" ? null : out.message_uz || null,
      model: MODEL,
    },
    { onConflict: "fingerprint" }
  );
  if (error) throw new Error(`failure_analysis write failed: ${error.message}`);
}

/**
 * Wraps the zero-cost keyword classifier in the same shape the model path
 * returns. Used when no API key is configured, and per-failure when a
 * generation errors. Returns null when no rule matches confidently — the row
 * then renders exactly as it did before this feature existed.
 */
export function ruleAnalysis(
  test: Pick<TestCaseResult, "file" | "line" | "titlePath" | "error" | "stack">,
  key = testKey(test),
  fp = fingerprint(test, test.error ?? "")
): FailureAnalysis | null {
  const verdict = classifyFailure(test);
  if (!verdict) return null;
  return {
    fingerprint: fp,
    key,
    owner: verdict.owner,
    confidence: verdict.confidence,
    source: "rules",
    cause: verdict.cause,
    messageUz: verdict.messageUz,
  };
}

/** Runs `worker` over `items` with a bounded number in flight at once. */
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

/**
 * Returns an analysis for each input, reading from the shared cache first and
 * generating only what's missing. A failure on one input is swallowed so the
 * rest of the run still gets analyzed — the UI simply renders that row the way
 * it always has.
 */
export async function analyzeFailures(inputs: AnalysisInput[]): Promise<FailureAnalysis[]> {
  if (inputs.length === 0) return [];

  const withFingerprints = inputs.map((input) => ({
    input,
    key: testKey(input.test),
    fp: fingerprint(input.test, input.test.error ?? ""),
  }));

  const cached = await readCache([...new Set(withFingerprints.map((x) => x.fp))]);

  const misses = withFingerprints.filter((x) => !cached.has(x.fp));
  const generated = await mapLimit(misses, CONCURRENCY, async ({ input, fp }) => {
    try {
      const out = await generate(input);
      await writeCache(fp, input.test, out);
      return { fp, out };
    } catch (err) {
      console.error(`[failureAnalysis] ${input.test.file}:${input.test.line} —`, err);
      return null;
    }
  });

  for (const result of generated) {
    if (!result) continue;
    cached.set(result.fp, {
      fingerprint: result.fp,
      owner: result.out.owner,
      confidence: result.out.confidence,
      cause_en: result.out.cause_en,
      cause_uz: result.out.cause_uz,
      cause_ru: result.out.cause_ru,
      message_uz: result.out.owner === "infra" ? null : result.out.message_uz || null,
    });
  }

  return withFingerprints
    .map(({ input, key, fp }) => {
      const row = cached.get(fp);
      if (row) return toAnalysis(row, key);
      // Generation failed for this one — fall back to the keyword classifier
      // rather than dropping the row entirely.
      return ruleAnalysis(input.test, key, fp);
    })
    .filter((a): a is FailureAnalysis => a !== null);
}
