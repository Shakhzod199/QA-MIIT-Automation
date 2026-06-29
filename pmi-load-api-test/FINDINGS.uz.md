# PMI API — Yuklama/Stress sig'imi bo'yicha topilmalar

**Sana:** 2026-06-29
**Manzil:** `https://apiproject.miit.uz/api/projects` (PMI backend, test/develop muhiti)
**Vositalar:** ushbu papkadagi k6 load/stress skriptlari, shuningdek `/test/login`
endpointiga qarshi alohida o'tkazilgan qo'lda "burst" (bir vaqtda ko'p so'rov) testi.

## Qisqacha xulosa

PMI backend'i real hayotdagi (asta-sekin oshib boruvchi) yuklamani yaxshi
ko'taradi, ammo **login** yo'lida boshqa endpointlarga nisbatan ancha pastroq
darajada qattiq concurrency (bir vaqtdagi foydalanuvchilar) chegarasi mavjud.
Bu chegaradan oshganda, login so'rovlarining sezilarli qismi "toza" xatolik
bilan tugamaydi — ular hech qanday javobsiz bir necha daqiqagacha "osilib"
qoladi. Bu topilgan eng katta ishonchlilik (reliability) xavfi hisoblanadi.

## Load test natijalari (asta-sekin ko'tariluvchi yuklama, har foydalanuvchi uchun 1-3s "o'ylash vaqti")

| Bir vaqtdagi foydalanuvchilar | Natija | Umumiy xatolik darajasi | `/test/login` muvaffaqiyati |
|---|---|---|---|
| 100 | ✅ O'tdi | 0% | 100% |
| 200 | ✅ O'tdi | 0.02% | ~100% |
| 250 | ❌ O'tmadi | 6.81% | 45% |
| 300 | ❌ O'tmadi | 16.26% | 26% |

**Asosiy kuzatuv:** xatolik darajasi tekis pasaymaydi — 200 va 250 foydalanuvchi
oralig'ida keskin "jar" (cliff) mavjud. Bu chegaradan past bo'lsa hammasi toza,
yuqori bo'lsa esa barcha endpointlar yomonlashadi, ammo `/test/login` boshqalarga
qaraganda ancha yomonroq holatga tushadi (oddiy GET endpointlar uchun 89-97%
muvaffaqiyat bo'lsa, login uchun 26-45%). Bu holat test davomida faqat
ko'tarilish (ramp-up) bosqichida emas, balki barqaror (steady-state) bosqichda
ham saqlanib qoldi — demak bu vaqtinchalik "portlash" (burst) emas, balki
haqiqiy, barqaror sig'im chegarasi.

## Stress test natijalari (zudlik bilan sakrash, ramp-up yo'q, 0.1-0.3s "o'ylash vaqti")

| Bir vaqtdagi foydalanuvchilar (zudlik bilan) | Umumiy xatolik darajasi | `/test/login` muvaffaqiyati |
|---|---|---|
| 60 | 0.47% (o'tdi, chegara 5%) | 68% |
| 100 | 8.90% (o'tmadi, chegara 5%) | 13% |

Load testdagi bilan bir xil naqsh: concurrency bosimi qanday shaklda bo'lishidan
qat'i nazar (zudlik bilan yoki asta-sekin), login birinchi va eng ko'p
zararlanadigan endpoint hisoblanadi.

## Sabab-natija tekshiruvi: `/test/login`'da aslida nima sodir bo'lyapti?

Login endpointini boshqa hammasidan ajratib tekshirish uchun, 100 ta haqiqiy
bir vaqtdagi `POST /test/login` so'rovi to'g'ridan-to'g'ri yuborildi (ramp-up'siz,
boshqa endpointlarsiz). Natijalar:

| Natija | Soni | Javob vaqti |
|---|---|---|
| `200 OK` | 53 | ~1-2s |
| `429 Too Many Requests` | 28 | ~1.1-1.4s (tez, toza rad etish) |
| **Hech qanday javob yo'q** (ulanish darajasidagi xatolik) | **19** | **30s dan 300s gacha (5 daqiqa!)** |

429 javoblar — bu normal, sog'lom rate limiter o'z vazifasini bajarayotganini
bildiradi: tez rad etish, mijoz qayta urinishi mumkin. **Aslida muammo — 5
daqiqagacha "osilib" qoladigan 19% qismda.** Ular rad etilmayapti — balki,
ehtimol, qandaydir tugagan resursni (eng ehtimoli — login/auth yo'liga xos
belgilangan o'lchamdagi ulanish puli yoki worker puli) kutib navbatda
turishga o'xshaydi (login oddiy GET'dan og'irroq amal — parolni tekshirish
va JWT imzolashni o'z ichiga oladi). "Osilib qolish" davomiyligi shubhali
yaxlit ko'paytmalar atrofida to'planadi (~30s, ~90s, ~150s, ~300s) — bu esa
to'lib-toshgan pul ortida navbatda turish va qayta urinish/backoff siklini
ko'rsatadi, tezda muvaffaqiyatsiz bo'lish o'rniga.

## Backend jamoasi uchun tavsiya

1. **Login yo'li haddan tashqari yuklama ostida tez muvaffaqiyatsiz bo'lsin,
   "osilib qolmasin".** 429 javoblarni keltirib chiqaradigan sig'im chegarasi
   xuddi shu chegara uzoq "osilib qolish"larning oldini olishi kerak — hozirda
   "burst" paytida ortiqcha so'rovlarning har 5tasidan 1tasi toza rad etilish
   o'rniga osilib qoladi. Muvaffaqiyatsiz bo'lishi kerak bo'lgan so'rov 429
   kabi ~1 soniyada muvaffaqiyatsiz bo'lishi kerak, 5 daqiqadan keyin emas.
2. **Login yo'lining ulanish/worker puli o'lchamini alohida tekshiring.**
   API'ning qolgan qismi (oddiy GET endpointlar) xuddi shu concurrency
   ostida ancha yumshoqroq yomonlashadi — login 26-45%ga tushganda, ular
   89-97% muvaffaqiyatni saqlab qoladi. Bu esa umumiy API sig'imi muammosi
   emas, balki maxsus login'ga tegishli resurs puli/chegarasi (parolni
   tekshirish uchun DB ulanishlari, JWT imzolash worker puli, sessiya yozish
   uchun lock va h.k.) borligini ko'rsatadi.
3. **Bugungi amaliy sig'im chegarasi: ~200-225 bir vaqtdagi foydalanuvchi**,
   shundan keyin xatoliklar keskin oshib boradi. Agar real foydalanish shundan
   oshishi kutilsa, bu masala ishga tushirish/kengaytirishdan oldin hal
   qilinishi kerak.

## Test tomonida nima qildik

- `load-test.js` **200 VU** bilan committed qilindi — oxirgi toza o'tgan
  konfiguratsiya — asosiy regressiya tekshiruvi sifatida.
- `stress-test.js` **60 VU** bilan committed qilindi — bu ham toza.
- 250/300 VU testlari doimiy chegara sifatida saqlanmadi; ular chegarani
  topish uchun izlanuvchi (exploratory) testlar bo'lib, natijalari shu yerda
  hujjatlashtirildi.
