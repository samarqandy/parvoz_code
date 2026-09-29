# Supabase edge funksiyalari

Bu papkadagi kod Supabase'da ishlaydi. Deploy Supabase MCP / CLI orqali
qilinadi; repodagi nusxa — manba va tarix uchun.

| Funksiya | `verify_jwt` | Vazifasi |
|---|---|---|
| `admin-api` | ✅ | Panel uchun boshqaruv: o'qituvchilar, kurslar, bot sozlamalari, ariza xabarnomalari, ota-onaga xabar shablonlari, to'lov eslatmalari va "to'lov qabul qilindi" xabari |
| `mark-attendance` | ✅ | Kelgan/ketganni belgilash + ota-onaga Telegram xabari (shablon bo'yicha) |
| `student-link` | ✅ | Ota-ona uchun muddatli (48 soat) ulanish havolasini yaratish |
| `submit-lead` | ❌ | Saytdagi ariza formasi (ochiq endpoint, honeypot + cheklovlar bilan) |
| `telegram-webhook` | ❌ | Telegram xabarlari; himoya `X-Telegram-Bot-Api-Secret-Token` orqali |

## Ota-ona ulanishi qanday himoyalangan

Havolaning o'zi yetarli emas — ikki bosqich bor:

1. O'qituvchi paneldan havola oladi. Havola **48 soat** amal qiladi va har
   safar yangi kod bilan yaratiladi (eskisi darhol o'ladi).
2. Ota-ona havolani ochganda bot darhol ulamaydi: `request_contact` tugmasi
   orqali **raqamni so'raydi**. Telegram raqamni o'zi tasdiqlab yuboradi
   (`contact.user_id === from.id` — birovning kontaktini yuborib bo'lmaydi).
3. Raqam `students.parent_phone` bilan solishtiriladi. Mos kelsa — ulanadi,
   kod yangilanadi va havola yopiladi. 3 marta mos kelmasa — havola bekor.

Shu sababli havola boshqa odamga tarqalsa ham u hech narsa ko'ra olmaydi.

`students` jadvalidagi ulanish maydonlari (`telegram_chat_id`, `link_code`,
`link_expires_at`, `linked_phone`, `pending_chat_id`) brauzerdan
o'zgartirilmaydi: `authenticated` rolida ular uchun `UPDATE` huquqi yo'q,
faqat edge funksiyalar (service_role) yoza oladi.

## Belgini bekor qilish (`mark-attendance` → `undo_id`)

"Kelmadi" yoki "Sababli" o'sha kundagi "Keldi/Ketdi"ni o'chiradi (bir kunda bitta
mantiqiy holat). Xato bosilsa vaqtlar yo'qolmasin: har bir belgilash javobida
`replaced` — o'chirilgan yozuvlar (`kind`, `occurred_at`, `note`). Toastdagi
"Bekor qilish" `{ undo_id, restore: replaced }` yuboradi: yangi belgi o'chadi,
eskilari asl vaqti bilan qaytadi, ota-onaga xabar ketmaydi.

- O'qituvchi faqat o'zi qo'ygan va o'z kursidagi belgini bekor qiladi (admin — istalganini).
- Qaytariladigan yozuvlar o'sha kunga va bekor qilinayotgan belgi almashtira oladigan
  turlarga tegishli bo'lishi shart (`REPLACES`), ko'pi bilan 3 ta; boshqasi — 400.
- "Keldi" bekor qilinsa, unga bog'liq "Ketdi" ham o'chadi.
- Panel "Keldi/Ketdi" vaqti yo'qoladigan holatda (ustidan "Kelmadi"/"Sababli") avval so'raydi.

## Ota-onaga xabar shablonlari

Matnni admin paneldan (Sozlamalar → Ota-onaga xabarlar) tahrirlaydi. Saqlanadi:
`app_config.msg_templates` — `{"in": {"on": true, "text": "..." | null}, ...}`.
`text: null` — standart matn (`mark-attendance` dagi `DEFAULT_TPL`).

- Turlar: `in` `out` `absent` `excused` (davomat), `pay` (to'lov eslatmasi, faqat qo'lda),
  `paid` (to'lov qabul qilindi).
- O'zgaruvchilar: `{ism}` `{vaqt}` `{kurs}` `{sana}` `{sabab}` `{oy}` `{oylar}` `{summa}` — har bir turda
  faqat mosi ruxsat (`admin-api` → `TPL_VARS`). `{ism}` har doim shart:
  oilada bir nechta farzand o'qishi mumkin.
- `*matn*` — qalin. Qolgan hamma narsa ekranlanadi (`parse_mode: HTML`).
- Qiymati bo'sh o'zgaruvchi turgan qator tushib qoladi ({ism} qatoridan tashqari).
- `on: false` — belgi yoziladi, xabar ketmaydi (javobda `muted: true`).

Ko'rsatish mantig'i (`renderTpl`) `assets/app.js` da ham bor — admin ko'rgan
namuna ota-ona oladigan xabarning o'zi bo'lishi uchun. Birini o'zgartirsangiz,
ikkinchisini ham o'zgartiring. `pay` va `paid` ning standart matni `admin-api` da
(`DEFAULT_PAY`, `DEFAULT_PAID`) va panelda (`TPL_DEFAULT`) bir xil turishi shart.

## To'lov eslatmalari (`admin-api` → `send_reminders`)

Admin To'lovlar bo'limidan qarzdor o'quvchilarning ota-onasiga Telegram xabari
yuboradi. So'rov: `{ action: 'send_reminders', month: 'YYYY-MM', student_ids: [...] }`.

- Faqat admin. Oy — joriy yoki oldingi 11 oy (keyingi oy oldindan to'lov, qarz emas).
  Bir so'rovda ko'pi bilan 50 ta o'quvchi; panel bo'laklab yuboradi.
- Server hammasini qayta tekshiradi: arxivda / oy boshlanmasdan qo'shilgan / to'lagan /
  Telegramsiz / ismida karta raqami yoki havola / 7 kun ichida eslatilgan — o'tkazib yuboriladi.
- Yuborishdan **oldin** `payment_reminders` ga `pending` qatori yoziladi; noyob indeks
  (o'quvchi + Samarqand kuni, `failed` dan tashqari) ikki admin yoki qayta urinish bir kunda
  ikki marta yuborishiga yo'l qo'ymaydi. Natija: `sent` / `failed` / `unknown`.
- 7 kunlik chegara o'quvchi bo'yicha, oy tanlovidan qat'i nazar (`failed` hisobga olinmaydi).
- `{oylar}` — joriy oygacha barcha qarz oylari; faqat tanlangan oy qarz bo'lsa qator tushadi.
- Telegram xatolari: 403 → `blocked`; 400 "chat not found" → `no_chat`; 401/404 → `token`
  (to'xtatadi); 429 → bir marta qayta urinadi, keyin `rate_limited` (to'xtatadi); shablon
  formati xatosi → `format` (to'xtatadi); 3 ta ketma-ket tarmoq xatosi → `network` (to'xtatadi).
  To'xtatilganda qolganlar `not_sent` da qaytadi, jurnalga yozilmaydi.
- 60 soniyalik vaqt chegarasi (so'rov 150 s da uziladi); bir chatga sekundiga bittadan ko'p
  emas; 21:00–08:00 da ovozsiz (`disable_notification`).
- Bot tokeni hech qachon javobga yoki jurnalga tushmaydi: `tg()` throw qilmaydi, xato
  matnlari `redact()` dan o'tadi. Shu himoya `mark-attendance` da ham bor.

## To'lov qabul qilindi (`admin-api` → `notify_payment`)

Admin yangi to'lov yozganda ota-onaga Telegramda xabar ketadi.
So'rov: `{ action: 'notify_payment', payment_id: '<uuid>' }`.

- Faqat admin. Bir to'lovga bitta xabar: yuborishdan **oldin**
  `update payments set notified_at = now() where id = … and notified_at is null`
  bilan band qilinadi — ikki oyna yoki qayta bosish ikkinchi xabar bermaydi.
  Telegram yetkazmasa (`blocked`, `no_chat`, tarmoq, timeout) band bo'shatiladi
  va admin to'lovni ochib qayta yuborishi mumkin.
- Javob: `{ sent: true }` yoki `{ sent: false, code }` — `already` / `no_tg` /
  `no_bot` / `muted` (Sozlamalarda o'chirilgan) / Telegram xato kodlari.
- Panel xabarni darhol emas, "Bekor qilish" tugmasi yo'qolgach (7 s) yuboradi:
  admin adashib boshqa o'quvchini belgilab, bekor qilsa, ota-onaga xabar bormaydi.
  Sahifa shu orada yopilsa — `keepalive` bilan darhol yuboriladi.
- Oynadagi belgi joriy va o'tgan oy uchun o'z-o'zidan belgilangan, eski oylar
  uchun (tarixni kiritish) belgilanmagan — ota-onalarga o'tgan oylar bo'yicha
  xabarlar yog'ilmasin.
- To'lovni tahrirlaganda xabar qayta ketmaydi. Yuborilmagan bo'lsa, tahrir oynasida
  "qabul qilindi xabarini yuborish" tugmasi bor; yuborilganlari ro'yxatda ✓✓ bilan.
- `notified_at` ni server yozganda `marked_by_email` saqlanib qoladi
  (`private.stamp_payment` faqat foydalanuvchi so'rovida emailni yozadi).

## Kurs narxi (`admin-api` → `save_course`, `monthly_fee`)

`courses.monthly_fee` — kursning oylik narxi (so'm, 0 … 100 000 000, `null` — belgilanmagan).
Admin Jamoa → Kurslar oynasida kiritadi.

- `save_course` narxni faqat so'rovda `monthly_fee` kaliti bo'lsa o'zgartiradi — eski
  panel kursni saqlaganda narx o'chib ketmaydi. Faqat son yoki raqamli satr qabul qilinadi.
- **Shaxsiy narx (chegirma)** — `student_fees` jadvali (`student_id` → `monthly_fee`).
  Admin o'quvchi oynasida kiritadi; bo'sh qoldirilsa yozuv o'chadi va kurs narxi olinadi.
  `students` ga ustun qilib qo'shilmadi: o'quvchilarni o'qituvchi ham ko'radi, bu jadvalni
  esa faqat admin o'qiydi va yozadi (RLS). `updated_by_email` va `updated_at` ni trigger
  JWT dan yozadi. O'quvchi o'chirilsa, yozuvi ham o'chadi.
- **Oylik narx** = shaxsiy narx, u bo'lmasa kurs narxi.
- To'lov oynasida summa: oylik narx, u bo'lmasa o'quvchining oxirgi to'lovi. Tez tanlash
  tugmalari: oylik narx, oxirgi summa, kurs narxi (belgilari bilan).
- Qarzdorlar ro'yxatida taxminiy qarz: oylik narx × to'lanmagan oylar (ko'pi bilan
  12 oy orqaga), "≈" bilan. Qisman to'lovlar hisobga olinmaydi.
  Ota-onaga boradigan xabarlarda summa **ishlatilmaydi** — taxminiy summa
  ota-onaga yetib bormasligi uchun.
- Narx o'qituvchilarga ham ko'rinadi (kurslar jadvali ular uchun ochiq), lekin
  to'lovlar va qarzlar faqat adminga.
- **Moliya hisoboti** (To'lovlar → "Moliya hisoboti") shu qoidalar bilan tanlangan oy va
  undan oldingi 11 oyni ko'rsatadi: oylar bo'yicha yig'ilgan pul, to'lagan/to'lamaganlar
  soni, kurslar bo'yicha pul va taxminiy qarz. Yangi so'rov yo'q — `loadPayments`
  yuklagan to'lovlardan panelda hisoblanadi. To'lov qaysi oy **uchun** yozilgan bo'lsa,
  o'sha oyda sanaladi (to'langan sana emas).
