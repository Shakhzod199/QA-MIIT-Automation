import type { Locale } from "@/lib/i18n";
import type { FailureOwner, TestCaseResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Keyword classification of a test failure — the zero-cost path used when no
// ANTHROPIC_API_KEY is configured, and the safety net when a model call fails.
//
// What this tier is honestly good at:
//   infra    — very good. Login/session/credential/network failures announce
//              themselves unambiguously in the error text.
//   backend  — good. A 5xx or a database error is unmistakable.
//   frontend — weak, and deliberately reported at low confidence. From error
//              text alone you cannot tell "the page stopped rendering X" from
//              "our selector is stale because the UI legitimately changed".
//              So the message asks the reader to decide, rather than asserting.
//
// It never emits the "test" tag. Telling a QA engineer their spec is wrong on
// the strength of a regex would send them chasing a product bug, which is the
// same credibility problem as misrouting to a dev team — just pointed inward.
//
// When nothing matches confidently the classifier returns null and the row
// renders exactly as it did before this feature existed. Silence is a better
// answer than a guess wearing a coloured badge.
// ---------------------------------------------------------------------------

export interface RuleVerdict {
  owner: FailureOwner;
  confidence: "high" | "medium" | "low";
  cause: Record<Locale, string>;
  messageUz: string | null;
}

/** The most informative single line of an error — what a human reads first. */
function headline(error: string): string {
  const line = error
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("at ") && l !== "Error:");
  return (line ?? error.split("\n")[0] ?? "").slice(0, 200);
}

/** "tests/export/analytics.spec.ts" -> "Export" — the suite a dev would recognise. */
function suiteName(file: string): string {
  const part = file.split("/").filter((p) => p && p !== "tests")[0] ?? "";
  return part.replace(/-.*$/, "").replace(/^\w/, (c) => c.toUpperCase());
}

interface Rule {
  owner: FailureOwner;
  confidence: "high" | "medium" | "low";
  /** Returns capture values when the rule applies, or null when it doesn't. */
  match: (ctx: { error: string; file: string; title: string; stack: string }) => Record<string, string> | null;
  cause: (c: Record<string, string>, ctx: { suite: string; headline: string }) => Record<Locale, string>;
  message: ((c: Record<string, string>, ctx: { suite: string; headline: string; file: string }) => string) | null;
}

const RULES: Rule[] = [
  // --- infra ---------------------------------------------------------------
  {
    // Our own helpers throw this when a credential env var is missing.
    owner: "infra",
    confidence: "high",
    match: ({ error }) => {
      const m = error.match(/([A-Z_]+) is not set\./);
      return m ? { variable: m[1] } : null;
    },
    cause: ({ variable }) => ({
      en: `The ${variable} credential is not configured, so the test could not sign in. Nothing in the product is broken.`,
      uz: `${variable} login ma'lumoti sozlanmagan, shuning uchun test tizimga kira olmadi. Mahsulotda muammo yo‘q.`,
      ru: `Учётные данные ${variable} не настроены, поэтому тест не смог войти. Продукт не сломан.`,
    }),
    message: null,
  },
  {
    // A failing shared login/setup step. Almost never a product defect.
    owner: "infra",
    confidence: "high",
    match: ({ file, title }) =>
      /auth\.setup\.ts|login\.spec\.ts/.test(file) || /\b(log ?in|sign ?in|kirish|oneid)\b/i.test(title)
        ? {}
        : null,
    cause: (_c, { suite }) => ({
      en: `Signing in to ${suite} failed, so the tests that depend on that session could not run. Usually an expired credential, a session conflict between parallel runs, or the site being slow — not a product bug.`,
      uz: `${suite} tizimiga kirish muvaffaqiyatsiz bo‘ldi, shuning uchun shu sessiyaga bog‘liq testlar ishlamadi. Odatda login ma'lumoti eskirgan, parallel ishlar sessiyani to‘qnashtirgan yoki sayt sekin ishlagan bo‘ladi — mahsulotdagi xatolik emas.`,
      ru: `Не удалось войти в ${suite}, поэтому зависящие от этой сессии тесты не выполнились. Обычно это истёкшие учётные данные, конфликт сессий при параллельном запуске или медленный сайт — не дефект продукта.`,
    }),
    message: null,
  },
  {
    owner: "infra",
    confidence: "high",
    match: ({ error }) => {
      const m = error.match(
        /net::(ERR_[A-Z_]+)|\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)\b|socket hang up/
      );
      return m ? { code: m[1] ?? m[2] ?? "socket hang up" } : null;
    },
    cause: ({ code }, { suite }) => ({
      en: `The test could not reach ${suite} at all — the connection failed (${code}). The environment is down, unreachable, or the CI network dropped.`,
      uz: `Test ${suite} serveriga umuman ulana olmadi — ulanish uzildi (${code}). Server o‘chiq, mavjud emas yoki CI tarmog‘ida muammo bo‘lgan.`,
      ru: `Тест вообще не смог подключиться к ${suite} — соединение не установлено (${code}). Среда недоступна или проблема с сетью CI.`,
    }),
    message: null,
  },
  {
    owner: "infra",
    confidence: "medium",
    match: ({ error }) =>
      /Target (page|frame).*closed|Browser has been closed|browserContext\.close|Execution context was destroyed|crashed/i.test(
        error
      )
        ? {}
        : null,
    cause: (_c, { suite }) => ({
      en: `The browser or page closed unexpectedly while the test was running against ${suite}. This is a run-environment problem, not something a user would hit.`,
      uz: `${suite} bilan ishlash paytida brauzer yoki sahifa kutilmaganda yopildi. Bu ishga tushirish muhitidagi muammo, foydalanuvchi duch keladigan xatolik emas.`,
      ru: `Браузер или страница неожиданно закрылись во время прогона по ${suite}. Это проблема среды запуска, а не то, с чем столкнётся пользователь.`,
    }),
    message: null,
  },

  // --- backend -------------------------------------------------------------
  {
    owner: "backend",
    confidence: "high",
    match: ({ error }) => {
      const m = error.match(/\b(50\d|502|503|504)\b(?![\d.])/);
      if (!m) return null;
      // Guard against matching a coincidental number in an assertion diff.
      if (!/\b(status|response|http|got|received|returned|code)\b/i.test(error)) return null;
      const url = error.match(/https?:\/\/[^\s"')]+/)?.[0] ?? "";
      return { code: m[1], url };
    },
    cause: ({ code, url }) => ({
      en: `The API returned a ${code} server error${url ? ` for ${url}` : ""}, so the page had no data to display.`,
      uz: `API ${code} server xatoligini qaytardi${url ? ` (${url})` : ""}, shuning uchun sahifada ko‘rsatiladigan ma'lumot bo‘lmadi.`,
      ru: `API вернул серверную ошибку ${code}${url ? ` для ${url}` : ""}, поэтому странице нечего было отображать.`,
    }),
    message: ({ code, url }, { suite, headline: h, file }) =>
      `Salom! ${suite} loyihasidagi avtotest ${code} xatolik bilan to‘xtadi.\n\n` +
      (url ? `So‘rov: ${url}\n` : "") +
      `Test: ${file}\nXatolik: ${h}\n\n` +
      `Iltimos, shu endpointni tekshirib bering — u ${code} qaytaryapti va shu sababli sahifada ma'lumot ko‘rinmayapti.`,
  },
  {
    owner: "backend",
    confidence: "high",
    match: ({ error }) =>
      /\b(SQL|sqlstate|pq: |Scan error|null value in column|duplicate key|constraint .* violat|deadlock)\b/i.test(
        error
      )
        ? {}
        : null,
    cause: () => ({
      en: `The API failed with a database error, so the request never completed. The data layer needs fixing before this can pass.`,
      uz: `API ma'lumotlar bazasi xatoligi bilan tugadi, so‘rov bajarilmadi. Bu test o‘tishi uchun avval baza tomonidagi muammo tuzatilishi kerak.`,
      ru: `API завершился с ошибкой базы данных, запрос не выполнился. Сначала нужно починить слой данных.`,
    }),
    message: (_c, { suite, headline: h, file }) =>
      `Salom! ${suite} loyihasida avtotest ma'lumotlar bazasi xatoligiga duch keldi.\n\n` +
      `Test: ${file}\nXatolik: ${h}\n\n` +
      `Iltimos, so‘rovni va baza tomonidagi xatolikni tekshirib bering.`,
  },

  // --- frontend (low confidence by design — see the header comment) ---------
  {
    owner: "frontend",
    confidence: "low",
    match: ({ error }) => {
      if (!/waiting for locator|locator\.\w+:|toBeVisible|element is not visible|not found|should render/i.test(error))
        return null;
      // Prefer a human-readable label over a raw selector when one is quoted.
      const label = error.match(/["“]([^"”\n]{2,60})["”]/)?.[1] ?? "";
      return { label };
    },
    cause: ({ label }, { suite, headline: h }) => ({
      en: label
        ? `The ${suite} page did not show "${label}" when the test expected it.`
        : `An element the test expected on the ${suite} page never appeared. ${h}`,
      uz: label
        ? `${suite} sahifasida test kutgan "${label}" elementi ko‘rinmadi.`
        : `${suite} sahifasida test kutgan element umuman chiqmadi. ${h}`,
      ru: label
        ? `На странице ${suite} не отобразился элемент "${label}", который ожидал тест.`
        : `Элемент, который ожидал тест на странице ${suite}, так и не появился. ${h}`,
    }),
    message: ({ label }, { suite, headline: h, file }) =>
      `Salom! ${suite} sahifasida ${label ? `"${label}" ` : ""}element avtotest kutgan joyda chiqmadi.\n\n` +
      `Test: ${file}\nXatolik: ${h}\n\n` +
      `Iltimos, tekshirib bering: bu element sahifada hali ham bo‘lishi kerakmi?\n` +
      `— Agar ha, nega ko‘rinmayotganini ko‘rib chiqsangiz.\n` +
      `— Agar u ataylab o‘zgartirilgan yoki olib tashlangan bo‘lsa, ayting — biz testni yangilaymiz.`,
  },
  {
    owner: "frontend",
    confidence: "low",
    match: ({ error }) => {
      const m = error.match(/Expected:\s*(.+)\n[\s\S]*?Received:\s*(.+)/);
      return m ? { expected: m[1].trim().slice(0, 60), received: m[2].trim().slice(0, 60) } : null;
    },
    cause: ({ expected, received }, { suite }) => ({
      en: `The ${suite} page showed ${received} where the test expected ${expected}.`,
      uz: `${suite} sahifasida test ${expected} kutgan joyda ${received} ko‘rsatildi.`,
      ru: `На странице ${suite} отобразилось ${received} там, где тест ожидал ${expected}.`,
    }),
    message: ({ expected, received }, { suite, file }) =>
      `Salom! ${suite} sahifasida qiymat mos kelmadi.\n\n` +
      `Test: ${file}\nKutilgan: ${expected}\nAmalda: ${received}\n\n` +
      `Iltimos, tekshirib bering: bu qiymat qayerdan kelmoqda va nega o‘zgargan?\n` +
      `Agar bu o‘zgarish ataylab qilingan bo‘lsa, ayting — biz testni yangilaymiz.`,
  },

  // NOTE — there is deliberately no catch-all rule for a bare
  // "Test timeout of Nms exceeded." Playwright captures no stack frames and no
  // locator for those, so the error carries literally no evidence of a cause.
  // An earlier draft tagged them Infra at low confidence; that was checked
  // against real runs and found to misroute a known frontend bug. A tag is a
  // routing claim, so when there is nothing to go on the correct output is
  // nothing at all, and the row renders as it always has.
];

/**
 * Classifies a failure from its error text. Returns null when no rule matches
 * confidently — callers should then render the row unchanged.
 */
export function classifyFailure(
  test: Pick<TestCaseResult, "file" | "line" | "titlePath" | "error" | "stack">
): RuleVerdict | null {
  const error = test.error ?? "";
  if (!error.trim()) return null;

  const ctx = {
    error,
    file: test.file,
    title: test.titlePath.join(" › "),
    stack: test.stack ?? "",
  };
  const meta = { suite: suiteName(test.file), headline: headline(error), file: test.file };

  for (const rule of RULES) {
    const captures = rule.match(ctx);
    if (!captures) continue;
    return {
      owner: rule.owner,
      confidence: rule.confidence,
      cause: rule.cause(captures, meta),
      // Infra has nobody to notify; the UI shows a retry hint instead.
      messageUz: rule.owner === "infra" ? null : rule.message?.(captures, meta) ?? null,
    };
  }
  return null;
}
