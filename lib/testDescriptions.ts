import type { Locale } from "@/lib/i18n";

/**
 * Plain-language, non-technical explanations of what each test actually
 * checks — written for stakeholders (e.g. a non-technical CEO) browsing the
 * dashboard, not for engineers. Keyed by "file:line" (the same identifier
 * already used as the Playwright --grep filter elsewhere in this app), so a
 * description only shows up next to the exact test it describes.
 *
 * Covers Export, PMI, PMT, and SEZ.
 */
export const TEST_DESCRIPTIONS: Record<string, Record<Locale, string>> = {
  // ── Export ────────────────────────────────────────────────────────────
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

  // ── Export API security ──────────────────────────────────────────────────
  "tests/export-api-security/role-boundaries.spec.ts:45": {
    en: "Logs in as a restricted \"viewer\" account and checks the system correctly refuses to show it the full user list, which should only be visible to admins.",
    uz: "Cheklangan (\"viewer\") hisob bilan tizimga kirib, faqat administratorlarga ko‘rinishi kerak bo‘lgan to‘liq foydalanuvchilar ro‘yxatini tizim to‘g‘ri rad etishini tekshiradi.",
    ru: "Входит под ограниченной учётной записью («viewer») и проверяет, что система корректно отказывает в показе полного списка пользователей, который должен быть виден только администраторам.",
  },
  "tests/export-api-security/role-boundaries.spec.ts:50": {
    en: "Checks that a restricted \"viewer\" account cannot view the list of roles used to control who can do what — that's admin-only information.",
    uz: "Cheklangan (\"viewer\") hisob kim nima qila olishini boshqaruvchi rollar ro‘yxatini ko‘ra olmasligini tekshiradi — bu faqat administratorlarga tegishli ma'lumot.",
    ru: "Проверяет, что ограниченная учётная запись («viewer») не может просматривать список ролей, определяющих права доступа — это информация только для администраторов.",
  },
  "tests/export-api-security/role-boundaries.spec.ts:55": {
    en: "Checks that a restricted \"viewer\" account cannot view the permission configuration tables — another admin-only screen.",
    uz: "Cheklangan (\"viewer\") hisob ruxsatlar konfiguratsiyasi jadvallarini ko‘ra olmasligini tekshiradi — bu ham faqat administratorlarga tegishli ekran.",
    ru: "Проверяет, что ограниченная учётная запись («viewer») не может просматривать таблицы настройки прав доступа — ещё один экран только для администраторов.",
  },
  "tests/export-api-security/role-boundaries.spec.ts:65": {
    en: "Control check: confirms a real admin account CAN see the user list, proving the previous \"viewer is blocked\" result means the role check works — not that the feature itself is broken.",
    uz: "Nazorat tekshiruvi: haqiqiy administrator hisobi foydalanuvchilar ro‘yxatini ko‘ra olishini tasdiqlaydi — bu oldingi \"viewer bloklangan\" natijasi funksiya buzilgani uchun emas, rol tekshiruvi ishlayotgani uchun ekanini isbotlaydi.",
    ru: "Контрольная проверка: подтверждает, что реальный администратор ВИДИТ список пользователей — это доказывает, что предыдущий результат «viewer заблокирован» связан с работающей проверкой роли, а не с поломкой самой функции.",
  },
  "tests/export-api-security/role-boundaries.spec.ts:70": {
    en: "Control check: confirms a real admin account can view the roles configuration, the admin-side counterpart to the viewer-is-blocked test above.",
    uz: "Nazorat tekshiruvi: haqiqiy administrator hisobi rollar konfiguratsiyasini ko‘ra olishini tasdiqlaydi — yuqoridagi \"viewer bloklangan\" testining administrator tomonidagi hamkori.",
    ru: "Контрольная проверка: подтверждает, что реальный администратор может просматривать настройки ролей — это «зеркальная» проверка для теста блокировки viewer выше.",
  },
  "tests/export-api-security/role-boundaries.spec.ts:78": {
    en: "Takes a real login token and corrupts one character in it, then checks the system rejects it — proving a tampered login session can't be used to sneak in.",
    uz: "Haqiqiy kirish tokenidagi bitta belgini buzib, tizim uni rad etishini tekshiradi — bu buzilgan sessiya orqali tizimga kira olmaslikni isbotlaydi.",
    ru: "Портит один символ в настоящем токене входа и проверяет, что система его отклоняет — это доказывает, что подделанной сессией нельзя воспользоваться для входа.",
  },
  "tests/export-api-security/role-boundaries.spec.ts:89": {
    en: "Sends a completely fake login token to an admin-only page and checks the system says \"you're not logged in\" rather than \"you're logged in but not allowed\" — so a bad token can never be used to fish for which pages exist.",
    uz: "Administratorlarga tegishli sahifaga soxta tokenni yuborib, tizim \"tizimga kirmagansiz\" deb javob berishini (\"kirgansiz, lekin ruxsat yo‘q\" emas) tekshiradi — shunda soxta token orqali qaysi sahifalar mavjudligini bilib bo‘lmaydi.",
    ru: "Отправляет полностью поддельный токен на страницу только для администраторов и проверяет, что система отвечает «вы не вошли», а не «вы вошли, но нет доступа» — так поддельным токеном нельзя выяснить, какие страницы вообще существуют.",
  },

  // ── PMI ───────────────────────────────────────────────────────────────
  "tests/pmi-tests/columns.spec.ts:22": {
    en: "Checks that turning on every optional column in the Projects table actually adds it, and that each column shows real data instead of being empty.",
    uz: "Loyihalar jadvalida barcha qo‘shimcha ustunlarni yoqish ularni haqiqatan ham qo‘shishini va har bir ustunda bo‘sh emas, haqiqiy ma'lumot borligini tekshiradi.",
    ru: "Проверяет, что включение всех дополнительных столбцов в таблице проектов действительно добавляет их, и что в каждом столбце отображаются реальные данные, а не пустота.",
  },
  "tests/pmi-tests/create-project-1tip.spec.ts:106": {
    en: "Simulates creating a new state investment program project through the form and confirms the system saves it successfully.",
    uz: "Davlat investitsiya dasturi loyihasini forma orqali yaratishni simulyatsiya qiladi va tizim uni muvaffaqiyatli saqlaganini tasdiqlaydi.",
    ru: "Имитирует создание нового проекта государственной инвестиционной программы через форму и подтверждает, что система успешно его сохранила.",
  },
  "tests/pmi-tests/create-project-2tip.spec.ts:93": {
    en: "Simulates creating a new road-map project through the form and confirms the system saves it successfully.",
    uz: "Yo‘l xaritasiga kiritilgan loyihani forma orqali yaratishni simulyatsiya qiladi va tizim uni muvaffaqiyatli saqlaganini tasdiqlaydi.",
    ru: "Имитирует создание нового проекта дорожной карты через форму и подтверждает, что система успешно его сохранила.",
  },
  "tests/pmi-tests/create-project-3tip.spec.ts:92": {
    en: "Simulates creating a new forward-looking (strategic) project through the form and confirms the system saves it successfully.",
    uz: "Yangi (istiqbolli) loyihani forma orqali yaratishni simulyatsiya qiladi va tizim uni muvaffaqiyatli saqlaganini tasdiqlaydi.",
    ru: "Имитирует создание нового перспективного (стратегического) проекта через форму и подтверждает, что система успешно его сохранила.",
  },
  "tests/pmi-tests/create-project-4tip.spec.ts:93": {
    en: "Simulates creating a supplementary sub-project nested under a main project and confirms the system saves it successfully.",
    uz: "Asosiy loyiha ostidagi qo‘shimcha loyihani yaratishni simulyatsiya qiladi va tizim uni muvaffaqiyatli saqlaganini tasdiqlaydi.",
    ru: "Имитирует создание дополнительного подпроекта внутри основного проекта и подтверждает, что система успешно его сохранила.",
  },
  "tests/pmi-tests/filter.spec.ts:46": {
    en: "Checks that typing in the search box correctly narrows down the projects table, and clearing the search brings back the full list.",
    uz: "Qidiruv maydoniga yozish loyihalar jadvalini to‘g‘ri torayishini va qidiruvni tozalash to‘liq ro‘yxatni qaytarishini tekshiradi.",
    ru: "Проверяет, что ввод текста в поле поиска корректно сужает таблицу проектов, а очистка поиска возвращает полный список.",
  },
  "tests/pmi-tests/filter.spec.ts:72": {
    en: "Checks that choosing filters in the side panel narrows the projects list, and clearing them restores all results.",
    uz: "Yon paneldan filtrlarni tanlash loyihalar ro‘yxatini torayishini va ularni tozalash barcha natijalarni qaytarishini tekshiradi.",
    ru: "Проверяет, что выбор фильтров в боковой панели сужает список проектов, а их очистка восстанавливает все результаты.",
  },
  "tests/pmi-tests/login.spec.ts:5": {
    en: "Checks that the \"Log in with OneID\" button is visible, and that logging in with a username and password also works.",
    uz: "\"OneID orqali kirish\" tugmasi ko‘rinib turganini va login/parol bilan kirish ham ishlayotganini tekshiradi.",
    ru: "Проверяет, что кнопка «Войти через OneID» отображается, а вход по логину и паролю также работает.",
  },
  "tests/pmi-tests/login.spec.ts:29": {
    en: "Checks that a successful login takes the user to the dashboard.",
    uz: "Muvaffaqiyatli kirish foydalanuvchini boshqaruv paneliga olib borishini tekshiradi.",
    ru: "Проверяет, что успешный вход перенаправляет пользователя на панель управления.",
  },
  "tests/pmi-tests/update-1tip.spec.ts:6": {
    en: "Simulates opening an existing state investment project and changing its start/end dates, then confirms the change was saved.",
    uz: "Mavjud davlat investitsiya loyihasini ochib, uning boshlanish/tugash sanalarini o‘zgartirishni simulyatsiya qiladi va o‘zgarish saqlanganini tasdiqlaydi.",
    ru: "Имитирует открытие существующего государственного инвестиционного проекта и изменение его дат начала/окончания, затем подтверждает, что изменение сохранено.",
  },
  "tests/pmi-tests/update-2tip.spec.ts:17": {
    en: "Simulates updating a road-map project's details and confirms the change was saved.",
    uz: "Yo‘l xaritasi loyihasining ma'lumotlarini yangilashni simulyatsiya qiladi va o‘zgarish saqlanganini tasdiqlaydi.",
    ru: "Имитирует обновление данных проекта дорожной карты и подтверждает, что изменение сохранено.",
  },
  "tests/pmi-tests/update-3tip.spec.ts:13": {
    en: "Simulates updating a forward-looking project's details, then opens its Tasks section and confirms the project's tasks load correctly.",
    uz: "Yangi (istiqbolli) loyihaning ma'lumotlarini yangilashni simulyatsiya qiladi, so‘ngra uning Vazifalar bo‘limini ochib, vazifalar to‘g‘ri yuklanganini tasdiqlaydi.",
    ru: "Имитирует обновление данных перспективного проекта, затем открывает раздел «Задачи» и подтверждает, что задачи проекта корректно загружаются.",
  },
  "tests/pmi-tests/update-4tip.spec.ts:22": {
    en: "Simulates updating a sub-project's details, then opens its Tasks and Indicators sections and confirms both load correctly.",
    uz: "Qo‘shimcha loyihaning ma'lumotlarini yangilashni simulyatsiya qiladi, so‘ngra uning Vazifalar va Ko‘rsatkichlar bo‘limlarini ochib, ikkisi ham to‘g‘ri yuklanganini tasdiqlaydi.",
    ru: "Имитирует обновление данных подпроекта, затем открывает разделы «Задачи» и «Показатели» и подтверждает, что оба загружаются корректно.",
  },
  "tests/pmi-tests/xmi-update-1tip.spec.ts:25": {
    en: "Simulates converting a state investment project to externally-funded (XMI) status via its financial indicators, then confirms the project updates and saves correctly under that status.",
    uz: "Davlat investitsiya loyihasini moliyaviy ko‘rsatkichlar orqali tashqi mablag‘ (XMI) holatiga o‘tkazishni simulyatsiya qiladi va loyiha shu holatda to‘g‘ri yangilanib saqlanishini tasdiqlaydi.",
    ru: "Имитирует перевод государственного инвестиционного проекта в статус внешнего финансирования (XMI) через его финансовые показатели, затем подтверждает, что проект корректно обновляется и сохраняется в этом статусе.",
  },

  // ── PMT ───────────────────────────────────────────────────────────────
  "tests/pmt/columns.spec.ts:25": {
    en: "Checks that turning on every optional column in the Organizations table actually adds it, and that each column shows real data instead of being empty.",
    uz: "Korxonalar jadvalida barcha qo‘shimcha ustunlarni yoqish ularni haqiqatan ham qo‘shishini va har bir ustunda bo‘sh emas, haqiqiy ma'lumot borligini tekshiradi.",
    ru: "Проверяет, что включение всех дополнительных столбцов в таблице организаций действительно добавляет их, и что в каждом столбце отображаются реальные данные, а не пустота.",
  },
  "tests/pmt/filter.spec.ts:75": {
    en: "Checks that typing in the search box correctly narrows down the organizations table, and clearing the search brings back the full list.",
    uz: "Qidiruv maydoniga yozish korxonalar jadvalini to‘g‘ri torayishini va qidiruvni tozalash to‘liq ro‘yxatni qaytarishini tekshiradi.",
    ru: "Проверяет, что ввод текста в поле поиска корректно сужает таблицу организаций, а очистка поиска возвращает полный список.",
  },
  "tests/pmt/filter.spec.ts:103": {
    en: "Checks that filling in every filter field in the side panel (region, sector, company type, etc.) narrows the organizations list, and clearing them restores all results.",
    uz: "Yon paneldagi barcha filtr maydonlarini (viloyat, soha, korxona turi va h.k.) to‘ldirish korxonalar ro‘yxatini torayishini va ularni tozalash barcha natijalarni qaytarishini tekshiradi.",
    ru: "Проверяет, что заполнение всех полей фильтра в боковой панели (регион, отрасль, тип компании и т.д.) сужает список организаций, а их очистка восстанавливает все результаты.",
  },
  "tests/pmt/login.spec.ts:5": {
    en: "Checks that the \"Log in with OneID\" button is visible, and that logging in with a username and password also works.",
    uz: "\"OneID orqali kirish\" tugmasi ko‘rinib turganini va login/parol bilan kirish ham ishlayotganini tekshiradi.",
    ru: "Проверяет, что кнопка «Войти через OneID» отображается, а вход по логину и паролю также работает.",
  },
  "tests/pmt/login.spec.ts:34": {
    en: "Checks that a successful login takes the user to the dashboard.",
    uz: "Muvaffaqiyatli kirish foydalanuvchini boshqaruv paneliga olib borishini tekshiradi.",
    ru: "Проверяет, что успешный вход перенаправляет пользователя на панель управления.",
  },

  // ── SEZ ───────────────────────────────────────────────────────────────
  "tests/sez/auth.setup.ts:8": {
    en: "A behind-the-scenes step that logs in once before the other tests run, so they don't each have to log in separately.",
    uz: "Boshqa testlar ishga tushishidan oldin bir marta tizimga kirib, sessiyani saqlaydigan orqa fon bosqichi — shunda har bir test alohida kirishi shart bo‘lmaydi.",
    ru: "Служебный шаг, который один раз выполняет вход перед остальными тестами, чтобы каждому из них не нужно было входить отдельно.",
  },
  "tests/sez/login.spec.ts:10": {
    en: "Checks that the \"Log in with OneID\" option is visible, and that logging in with an email and password also works.",
    uz: "\"OneID orqali kirish\" imkoniyati ko‘rinib turganini va email/parol bilan kirish ham ishlayotganini tekshiradi.",
    ru: "Проверяет, что опция «Войти через OneID» отображается, а вход по email и паролю также работает.",
  },
  "tests/sez/login.spec.ts:37": {
    en: "Checks that a successful login takes the user to the dashboard.",
    uz: "Muvaffaqiyatli kirish foydalanuvchini boshqaruv paneliga olib borishini tekshiradi.",
    ru: "Проверяет, что успешный вход перенаправляет пользователя на панель управления.",
  },
  "tests/sez/columns.spec.ts:24": {
    en: "Checks that turning on every optional column in the Industrial Zones table actually adds it, and that each column shows real data instead of being empty.",
    uz: "Sanoat zonalari jadvalida barcha qo‘shimcha ustunlarni yoqish ularni haqiqatan ham qo‘shishini va har bir ustunda bo‘sh emas, haqiqiy ma'lumot borligini tekshiradi.",
    ru: "Проверяет, что включение всех дополнительных столбцов в таблице промышленных зон действительно добавляет их, и что в каждом столбце отображаются реальные данные, а не пустота.",
  },
  "tests/sez/filter.spec.ts:66": {
    en: "Checks that typing in the search box correctly narrows down the industrial zones table, and clearing the search brings back the full list.",
    uz: "Qidiruv maydoniga yozish sanoat zonalari jadvalini to‘g‘ri torayishini va qidiruvni tozalash to‘liq ro‘yxatni qaytarishini tekshiradi.",
    ru: "Проверяет, что ввод текста в поле поиска корректно сужает таблицу промышленных зон, а очистка поиска возвращает полный список.",
  },
  "tests/sez/filter.spec.ts:92": {
    en: "Checks that choosing filters in the side panel (region, district, directorate, territory boundary, zone category) narrows the list, and clearing them restores all results.",
    uz: "Yon paneldan filtrlarni tanlash (viloyat, tuman, direksiya, hudud chegarasi, zona turi) ro‘yxatni torayishini va ularni tozalash barcha natijalarni qaytarishini tekshiradi.",
    ru: "Проверяет, что выбор фильтров в боковой панели (регион, район, дирекция, границы территории, категория зоны) сужает список, а их очистка восстанавливает все результаты.",
  },
};

export function getTestDescription(file: string, line: number, locale: Locale): string | null {
  const entry = TEST_DESCRIPTIONS[`${file}:${line}`];
  return entry ? entry[locale] : null;
}
