export type Locale = "en" | "uz" | "ru";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "uz", label: "O‘zbekcha" },
  { code: "ru", label: "Русский" },
];

export const DEFAULT_LOCALE: Locale = "en";

type Dict = Record<string, string>;

const en: Dict = {
  "app.subtitle": "MIIT automation tests",
  "app.signOut": "Sign out",

  "nav.dashboard": "Dashboard",
  "nav.testcases": "Test cases",
  "nav.reports": "Reports",
  "nav.trends": "Trends",
  "nav.flaky": "Flaky Tests",
  "nav.alerts": "Telegram Alerts",

  "dashboard.title": "Dashboard",
  "dashboard.subtitle": "Playwright test suite runs",
  "dashboard.suites": "Suites",
  "dashboard.recentRuns": "Recent Runs",
  "dashboard.noRuns": "No runs yet.",
  "dashboard.noWorkflows": "No workflows found.",
  "dashboard.githubNotConfigured":
    "GitHub is not configured yet. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO in .env.local, then restart the dev server.",
  "dashboard.runs": "runs",
  "dashboard.run": "run",

  "suite.run": "Run",
  "suite.running": "Running…",
  "suite.triggered": "Triggered!",
  "suite.viewOnGithub": "View on GitHub",

  "table.run": "Run",
  "table.status": "Status",
  "table.progress": "Progress",
  "table.branch": "Branch",
  "table.duration": "Duration",
  "table.triggered": "Triggered",
  "table.cancel": "Cancel",
  "table.cancelling": "Cancelling…",
  "table.prev": "Prev",
  "table.next": "Next",
  "table.of": "of",

  "status.running": "Running",
  "status.queued": "Queued",
  "status.passed": "Passed",
  "status.failed": "Failed",
  "status.cancelled": "Cancelled",

  "trends.title": "Trends",
  "trends.subtitle": "Pass rate, duration, and per-suite health over your recent runs.",
  "trends.last": "Last",
  "trends.runs": "runs",
  "trends.passRate": "Pass Rate",
  "trends.failRate": "Fail Rate",
  "trends.avgDuration": "Avg Duration",
  "trends.medianDuration": "Median Duration",
  "trends.durationChart": "Run duration & outcome (oldest → newest)",
  "trends.passRateChart": "Pass rate over time",
  "trends.bySuite": "By suite",

  "flaky.title": "Flaky Tests",
  "flaky.subtitle":
    "Tests whose results flip-flop across recent runs (or pass only on retry). A consistently failing test is treated as a real failure, not flaky.",
  "flaky.analyzeLast": "Analyze last",
  "flaky.runs": "runs",
  "flaky.none": "No flaky tests detected",
  "flaky.noneHint": "Every test was consistent across the analyzed runs.",

  "alerts.title": "Telegram Alerts",
  "alerts.subtitle": "Get a Telegram message for every run result — passed, failed, or cancelled.",
  "alerts.sendTest": "Send test message",
  "alerts.checkNow": "Check for new results now",
  "alerts.refresh": "Refresh status",

  "reports.title": "Reports",
  "reports.subtitle": "Browse all test run reports and artifacts",
  "reports.search": "Search by name, run number, or branch…",
  "reports.allProjects": "All Projects",
  "reports.newest": "Newest first",
  "reports.oldest": "Oldest first",
  "reports.shown": "runs shown",
  "reports.noMatch": "No runs match your filters.",
  "common.all": "All",
};

const uz: Dict = {
  "app.subtitle": "MIIT avtomatlashtirilgan testlar",
  "app.signOut": "Chiqish",

  "nav.dashboard": "Boshqaruv paneli",
  "nav.testcases": "Test holatlari",
  "nav.reports": "Hisobotlar",
  "nav.trends": "Tendensiyalar",
  "nav.flaky": "Beqaror testlar",
  "nav.alerts": "Telegram bildirishnomalar",

  "dashboard.title": "Boshqaruv paneli",
  "dashboard.subtitle": "Playwright test to‘plamlari ishga tushirilishi",
  "dashboard.suites": "To‘plamlar",
  "dashboard.recentRuns": "So‘nggi ishga tushirishlar",
  "dashboard.noRuns": "Hozircha ishga tushirishlar yo‘q.",
  "dashboard.noWorkflows": "Workflow’lar topilmadi.",
  "dashboard.githubNotConfigured":
    "GitHub hali sozlanmagan. .env.local faylida GITHUB_TOKEN, GITHUB_OWNER va GITHUB_REPO ni kiriting va serverni qayta ishga tushiring.",
  "dashboard.runs": "ta ishga tushirish",
  "dashboard.run": "ta ishga tushirish",

  "suite.run": "Ishga tushirish",
  "suite.running": "Ishlamoqda…",
  "suite.triggered": "Boshlandi!",
  "suite.viewOnGithub": "GitHub’da ko‘rish",

  "table.run": "Ish",
  "table.status": "Holat",
  "table.progress": "Jarayon",
  "table.branch": "Tarmoq",
  "table.duration": "Davomiyligi",
  "table.triggered": "Boshlangan",
  "table.cancel": "Bekor qilish",
  "table.cancelling": "Bekor qilinmoqda…",
  "table.prev": "Oldingi",
  "table.next": "Keyingi",
  "table.of": "/",

  "status.running": "Ishlamoqda",
  "status.queued": "Navbatda",
  "status.passed": "O‘tdi",
  "status.failed": "Muvaffaqiyatsiz",
  "status.cancelled": "Bekor qilindi",

  "trends.title": "Tendensiyalar",
  "trends.subtitle": "So‘nggi ishga tushirishlar bo‘yicha muvaffaqiyat darajasi, davomiyligi va to‘plamlar holati.",
  "trends.last": "So‘nggi",
  "trends.runs": "ta",
  "trends.passRate": "Muvaffaqiyat darajasi",
  "trends.failRate": "Muvaffaqiyatsizlik darajasi",
  "trends.avgDuration": "O‘rtacha davomiyligi",
  "trends.medianDuration": "Median davomiyligi",
  "trends.durationChart": "Davomiyligi va natija (eskidan → yangiga)",
  "trends.passRateChart": "Vaqt bo‘yicha muvaffaqiyat darajasi",
  "trends.bySuite": "To‘plamlar bo‘yicha",

  "flaky.title": "Beqaror testlar",
  "flaky.subtitle":
    "Natijasi so‘nggi ishga tushirishlarda o‘zgarib turadigan (yoki faqat qayta urinishda o‘tadigan) testlar. Doimiy muvaffaqiyatsiz test beqaror emas, balki haqiqiy xatolik hisoblanadi.",
  "flaky.analyzeLast": "Tahlil qilinadigan",
  "flaky.runs": "ta ishga tushirish",
  "flaky.none": "Beqaror testlar topilmadi",
  "flaky.noneHint": "Tahlil qilingan barcha ishga tushirishlarda har bir test barqaror bo‘ldi.",

  "alerts.title": "Telegram bildirishnomalar",
  "alerts.subtitle": "Har bir natija uchun Telegram xabarini oling — o‘tdi, muvaffaqiyatsiz yoki bekor qilindi.",
  "alerts.sendTest": "Sinov xabarini yuborish",
  "alerts.checkNow": "Yangi natijalarni tekshirish",
  "alerts.refresh": "Holatni yangilash",

  "reports.title": "Hisobotlar",
  "reports.subtitle": "Barcha test hisobotlari va artefaktlarini ko‘rib chiqing",
  "reports.search": "Nomi, raqami yoki tarmoq bo‘yicha qidirish…",
  "reports.allProjects": "Barcha loyihalar",
  "reports.newest": "Avval yangilari",
  "reports.oldest": "Avval eskilari",
  "reports.shown": "ta ishga tushirish ko‘rsatildi",
  "reports.noMatch": "Filtrlarga mos ishga tushirishlar yo‘q.",
  "common.all": "Hammasi",
};

const ru: Dict = {
  "app.subtitle": "Автотесты MIIT",
  "app.signOut": "Выйти",

  "nav.dashboard": "Панель",
  "nav.testcases": "Тест-кейсы",
  "nav.reports": "Отчёты",
  "nav.trends": "Тренды",
  "nav.flaky": "Нестабильные тесты",
  "nav.alerts": "Telegram-оповещения",

  "dashboard.title": "Панель",
  "dashboard.subtitle": "Запуски наборов тестов Playwright",
  "dashboard.suites": "Наборы",
  "dashboard.recentRuns": "Последние запуски",
  "dashboard.noRuns": "Запусков пока нет.",
  "dashboard.noWorkflows": "Воркфлоу не найдены.",
  "dashboard.githubNotConfigured":
    "GitHub ещё не настроен. Укажите GITHUB_TOKEN, GITHUB_OWNER и GITHUB_REPO в .env.local и перезапустите сервер.",
  "dashboard.runs": "запусков",
  "dashboard.run": "запуск",

  "suite.run": "Запустить",
  "suite.running": "Выполняется…",
  "suite.triggered": "Запущено!",
  "suite.viewOnGithub": "Открыть в GitHub",

  "table.run": "Запуск",
  "table.status": "Статус",
  "table.progress": "Прогресс",
  "table.branch": "Ветка",
  "table.duration": "Длительность",
  "table.triggered": "Запущен",
  "table.cancel": "Отменить",
  "table.cancelling": "Отмена…",
  "table.prev": "Назад",
  "table.next": "Вперёд",
  "table.of": "из",

  "status.running": "Выполняется",
  "status.queued": "В очереди",
  "status.passed": "Пройден",
  "status.failed": "Провален",
  "status.cancelled": "Отменён",

  "trends.title": "Тренды",
  "trends.subtitle": "Доля прохождений, длительность и состояние наборов за последние запуски.",
  "trends.last": "Последние",
  "trends.runs": "запусков",
  "trends.passRate": "Доля прохождений",
  "trends.failRate": "Доля провалов",
  "trends.avgDuration": "Средняя длительность",
  "trends.medianDuration": "Медианная длительность",
  "trends.durationChart": "Длительность и результат (от старых → к новым)",
  "trends.passRateChart": "Доля прохождений со временем",
  "trends.bySuite": "По наборам",

  "flaky.title": "Нестабильные тесты",
  "flaky.subtitle":
    "Тесты, результат которых меняется от запуска к запуску (или проходят только при повторе). Стабильно падающий тест считается реальной ошибкой, а не нестабильным.",
  "flaky.analyzeLast": "Анализировать последние",
  "flaky.runs": "запусков",
  "flaky.none": "Нестабильных тестов не найдено",
  "flaky.noneHint": "Каждый тест был стабилен во всех проанализированных запусках.",

  "alerts.title": "Telegram-оповещения",
  "alerts.subtitle": "Получайте сообщение в Telegram о каждом результате — пройден, провален или отменён.",
  "alerts.sendTest": "Отправить тестовое сообщение",
  "alerts.checkNow": "Проверить новые результаты",
  "alerts.refresh": "Обновить статус",

  "reports.title": "Отчёты",
  "reports.subtitle": "Просмотр всех отчётов и артефактов запусков",
  "reports.search": "Поиск по имени, номеру или ветке…",
  "reports.allProjects": "Все проекты",
  "reports.newest": "Сначала новые",
  "reports.oldest": "Сначала старые",
  "reports.shown": "запусков показано",
  "reports.noMatch": "Нет запусков по заданным фильтрам.",
  "common.all": "Все",
};

export const TRANSLATIONS: Record<Locale, Dict> = { en, uz, ru };

export function translate(locale: Locale, key: string): string {
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}
