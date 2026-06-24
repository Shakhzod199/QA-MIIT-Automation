import type { Locale } from "@/lib/i18n";

/**
 * Plain-language, non-technical explanations of what each test actually
 * checks — written for stakeholders (e.g. a non-technical CEO) browsing the
 * dashboard, not for engineers. Keyed by "file:line" (the same identifier
 * already used as the Playwright --grep filter elsewhere in this app), so a
 * description only shows up next to the exact test it describes.
 *
 * Pilot: Export project only. If this works well, extend to PMI/PMT/SEZ.
 */
export const TEST_DESCRIPTIONS: Record<string, Record<Locale, string>> = {
  "tests/export/auth.setup.ts:9": {
    en: "A behind-the-scenes step that logs in once before the other tests run, so they don't each have to log in separately.",
    uz: "Boshqa testlar ishga tushishidan oldin bir marta tizimga kirib, sessiyani saqlaydigan orqa fon bosqichi — shunda har bir test alohida kirishi shart bo‘lmaydi.",
    ru: "Служебный шаг, который один раз выполняет вход перед остальными тестами, чтобы каждому из них не нужно было входить отдельно.",
  },
  "tests/export/analytics.spec.ts:52": {
    en: "Checks that the Export summary numbers at the top of the dashboard (total export value, etc.) actually show real data — not zeros or blanks.",
    uz: "Boshqaruv panelining yuqori qismidagi Eksport umumiy ko‘rsatkichlari (umumiy eksport qiymati va h.k.) haqiqiy ma'lumot ko‘rsatayotganini, nol yoki bo‘sh emasligini tekshiradi.",
    ru: "Проверяет, что сводные показатели «Экспорт» в верхней части панели (общая сумма экспорта и т.д.) действительно показывают реальные данные, а не нули или пустые значения.",
  },
  "tests/export/analytics.spec.ts:57": {
    en: "Checks that the Import page's summary numbers load with real data instead of staying at zero.",
    uz: "Import sahifasidagi umumiy ko‘rsatkichlar nolda qolib ketmasligini, haqiqiy ma'lumot bilan yuklanganini tekshiradi.",
    ru: "Проверяет, что сводные показатели на странице «Импорт» загружаются с реальными данными, а не остаются на нуле.",
  },
  "tests/export/analytics.spec.ts:62": {
    en: "Checks that the Debts (Devitorka) page's summary numbers show actual figures, not zeros.",
    uz: "Devitorka (qarzdorlik) sahifasidagi umumiy ko‘rsatkichlar haqiqiy raqamlarni ko‘rsatishini, nolda qolmasligini tekshiradi.",
    ru: "Проверяет, что сводные показатели страницы «Дебиторка» отображают реальные цифры, а не нули.",
  },
  "tests/export/analytics.spec.ts:67": {
    en: "Checks that the Transport page's route summary numbers actually load with data.",
    uz: "Transport sahifasidagi yo‘nalish bo‘yicha umumiy ko‘rsatkichlar haqiqiy ma'lumot bilan yuklanganini tekshiradi.",
    ru: "Проверяет, что сводные показатели маршрутов на странице «Транспорт» загружаются с данными.",
  },
  "tests/export/analytics.spec.ts:72": {
    en: "Checks that the preview numbers on the main dashboard page load correctly and aren't stuck at zero.",
    uz: "Asosiy boshqaruv panelida ko‘rsatilgan ko‘rsatkichlar to‘g‘ri yuklanganini, nolda qolib ketmasligini tekshiradi.",
    ru: "Проверяет, что показатели на главной странице панели корректно загружаются и не остаются на нуле.",
  },
  "tests/export/analytics.spec.ts:77": {
    en: "Checks that the key performance cards on the Analytics page (export/import totals, trade balance, top country, etc.) show real numbers.",
    uz: "Analitika sahifasidagi asosiy ko‘rsatkich kartalari (eksport/import jami, savdo balansi, top davlat va h.k.) haqiqiy raqamlarni ko‘rsatishini tekshiradi.",
    ru: "Проверяет, что ключевые карточки показателей на странице «Аналитика» (суммы экспорта/импорта, торговый баланс, топ-страна и т.д.) показывают реальные цифры.",
  },
  "tests/export/columns.spec.ts:29": {
    en: "Checks that turning on every optional column in the dashboard table actually adds it, and that every column shows real data — not an empty column.",
    uz: "Boshqaruv panelidagi jadvalda barcha qo‘shimcha ustunlarni yoqish ularni haqiqatan ham qo‘shishini va har bir ustunda bo‘sh emas, haqiqiy ma'lumot borligini tekshiradi.",
    ru: "Проверяет, что включение всех дополнительных столбцов в таблице дашборда действительно добавляет их, и что в каждом столбце отображаются реальные данные, а не пустота.",
  },
  "tests/export/filter.spec.ts:26": {
    en: "Checks that typing in the search box correctly narrows down the table results, and clearing the search brings back the full list.",
    uz: "Qidiruv maydoniga yozish jadval natijalarini to‘g‘ri torayishini va qidiruvni tozalash to‘liq ro‘yxatni qaytarishini tekshiradi.",
    ru: "Проверяет, что ввод текста в поле поиска корректно сужает результаты таблицы, а очистка поиска возвращает полный список.",
  },
  "tests/export/filter.spec.ts:48": {
    en: "Checks that choosing a filter in the side panel adds a removable tag, and that removing that tag clears the filter and shows all results again.",
    uz: "Yon paneldan filtr tanlash o‘chiriladigan teg qo‘shishini va shu tegni o‘chirish filtrni tozalab, barcha natijalarni qayta ko‘rsatishini tekshiradi.",
    ru: "Проверяет, что выбор фильтра в боковой панели добавляет удаляемый тег, а удаление этого тега очищает фильтр и снова показывает все результаты.",
  },
  "tests/export/login.spec.ts:5": {
    en: "Checks that the \"Log in with OneID\" button is visible on the login page.",
    uz: "Kirish sahifasida \"OneID orqali kirish\" tugmasi ko‘rinib turganini tekshiradi.",
    ru: "Проверяет, что на странице входа отображается кнопка «Войти через OneID».",
  },
  "tests/export/login.spec.ts:11": {
    en: "Checks that logging in with a username and password successfully takes the user to the dashboard.",
    uz: "Login va parol bilan kirish foydalanuvchini muvaffaqiyatli boshqaruv paneliga olib borishini tekshiradi.",
    ru: "Проверяет, что вход по логину и паролю успешно перенаправляет пользователя на панель управления.",
  },
};

export function getTestDescription(file: string, line: number, locale: Locale): string | null {
  const entry = TEST_DESCRIPTIONS[`${file}:${line}`];
  return entry ? entry[locale] : null;
}
