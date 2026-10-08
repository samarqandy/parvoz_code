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

**Oila (bitta ota-onada 2-3 farzand).** Har bir farzandning o'z havolasi bor, lekin raqam bir marta tasdiqlanadi
(bazada migratsiya kerak emas: `telegram_chat_id` bir nechta o'quvchida bir xil bo'lishi mumkin):

1. Raqam tasdiqlangach bot shu raqamga ro'yxatdan o'tgan, hali ulanmagan faol farzandlarni sanab beradi va
   «✅ Ha, hammasini ulash» / «Yo'q, hozir emas» tugmalarini beradi (oddiy matnli javob tugmalari, `callback_query` kerak emas).
2. Shu chat raqamni allaqachon tasdiqlagan bo'lsa (`linked_phone`), boshqa farzandning havolasini ochish uni
   raqam so'ramasdan darhol ulaydi. Xavfsizlik oldingisi bilan teng: tasdiqlangan raqam == farzandga yozilgan ota-ona
   raqami, havola esa faqat xodimda.
3. «Ha» faqat shu chat tasdiqlagan raqamga yozilgan o'quvchilarni ulaydi; tasdiqlamagan chatga hech narsa ko'rsatilmaydi.
4. Boshqa raqam yozilgan, boshqa chatga ulangan yoki arxivdagi farzand taklif qilinmaydi.
5. `/stop` shu chatdagi hamma farzandni uzadi va ismlarini aytadi. Panelda bitta farzandni uzish boshqalarga tegmaydi.

Raqamlar oxirgi 9 raqam bo'yicha solishtiriladi (`+998 90 …`, `998…`, `90 …` bir xil). Farzandlar bitta oila bo'lishi
uchun ota-ona raqami bir xil kiritilishi shart — panel yangi o'quvchi formasida buni ko'rsatib turadi.

**Ona va ota (bitta farzandga ikkita ota-ona).** O'quvchida ikkita ota-ona raqami bo'lishi mumkin
(`parent_phone`, `parent_phone2`); ikkalasi ham alohida Telegramdan ulanadi va bir xil xabarlarni oladi.
Ulanishlar `public.parent_chats (student_id, chat_id, phone, linked_at)` jadvalida — manba shu; kalit
`(student_id, chat_id)`, shuning uchun bir chat bir nechta farzandga, bir farzand bir nechta chatga ulanishi mumkin.
Jadvalga faqat edge funksiyalar (service_role) yozadi; panel o'qiydi (RLS: admin yoki shu kursning o'qituvchisi).

- `students.telegram_chat_id / linked_phone / linked_at` endi «birinchi ulangan ota-ona»ning nusxasi: trigger
  `private.sync_student_chat` ularni jadvaldan yangilab turadi. Eski kod va panelning «ulangan» belgisi shu sababli
  o'zgarishsiz ishlaydi; ulanish uzilsa nusxa keyingi ota-onaga o'tadi yoki bo'shaydi.
- Bot: Telegram tasdiqlagan raqam **ikkala** raqamdan biriga mos kelsa ulanadi (`regPhones`); shu chat boshqa
  ota-onaga (ya'ni boshqa chatga) ulangan farzandni ham taklif qiladi. `/stop` faqat shu chatni uzadi — ikkinchi
  ota-ona ulanib qoladi.
- `student-link` → `create`: faqat hali ulanmagan ro'yxatdagi raqamlar uchun havola beradi (`phone_hint` shularni
  ko'rsatadi); hammasi ulangan bo'lsa `all_linked` (400). `unlink` ixtiyoriy `phone` oladi — faqat shu raqamdagi
  ota-ona uziladi, usiz hammasi.
- `mark-attendance`, `send_reminders`, `notify_payment`: xabar farzandning **hamma** chatlariga yuboriladi
  (`parent_chats` + eski nusxa). Kamida bittasiga yetsa — «yuborildi» (`delivery: 'sent'`); `chats: { sent, total }`
  qaysi biriga yetmaganini ko'rsatadi. Hammasiga yetmasa avvalgi kodlar (`blocked`, `failed`, …) qaytadi.
  To'lov kvitansiyasi band qilingan belgi faqat birortasiga ham yetmasa bo'shatiladi.
- Migratsiya: `20261007193236_parent_chats.sql` (qo'shimcha; mavjud ustun va jadvallarga tegilmaydi, hozirgi ulanishlar
  jadvalga ko'chiriladi).

Raqamni tasdiqlash kutilayotganda (`pending_at` 15 daqiqadan yangi) ota-ona raqamni tugma o'rniga
yozib yuborsa yoki boshqa matn yozsa, bot tugmani qayta ko'rsatadi: yozilgan raqam tekshirilmaydi,
faqat Telegram o'zi tasdiqlagan kontakt (tugma) qabul qilinadi. 12 xonali yozilgan raqam kod deb
adashtirilmaydi.

## Kurs ichidagi guruhlar (`admin-api` → `save_group`, `remove_group`)

Kurs (Dasturlash) ichida bir nechta guruh bo'lishi mumkin: `public.course_groups (course_id, name, days, starts, ends)` —
nom, dars kunlari (1 = dushanba … 7 = yakshanba) va vaqt (hammasi ixtiyoriy). O'quvchi bitta guruhda: `students.group_id`
(guruh o'chsa o'quvchi guruhsiz qoladi). O'qituvchi hamon **kursga** biriktiriladi (`private.teaches(course_id)`): kursning hamma
guruhini ko'radi — RLS o'zgarmagan.

- Guruhlarni faqat admin boshqaradi (`save_group`: nom 1–40 belgi, kursda takrorlanmaydi (registrsiz) → 409; kunlar 1–7; vaqt `HH:MM`,
  tugash boshlanishidan keyin; tahrirlashda kurs o'zgarmaydi. `remove_group` — nechta o'quvchi guruhsiz qolganini qaytaradi).
  Jadvalga panel faqat o'qiydi (`select` huquqi), yozadigan faqat service_role.
- `students.group_id` ni panel to'g'ridan-to'g'ri yozadi (ustun huquqi berilgan). Trigger `private.check_student_group` guruh o'quvchining
  kursiga tegishli bo'lishini majbur qiladi; kurs almashsa (guruh o'zgarmasa) eski kursning guruhi tozalanadi.
- Migratsiya hozirgi o'quvchilarni har kursning «Asosiy» guruhiga qo'yadi. Panelda guruh nomi kursda 2+ guruh bo'lgandagina ko'rinadi.
- Jadval bo'lmasa (migratsiya qo'llanmagan) panel guruhsiz ishlayveradi.

## Xabarni ushlab turish (`mark-attendance` → `hold`)

Panel `hold: true` yuboradi: ota-onaga xabar **8 soniya** (`HOLD_MS`) ushlab turiladi. Shu vaqt ichida o'qituvchi «Bekor qilish» bossa
belgi o'chadi va ota-onaga **hech narsa ketmaydi**; «Kelmadi» «Keldi»ni almashtirsa ham ushlangan «keldi» xabari ketmaydi.

- Javob darhol qaytadi: har bir ushlangan o'quvchida `delivery: 'held'`, `hold_ms`; javob boshida `held` — nechta xabar ushlangan.
- Ushlash **fonda** (`EdgeRuntime.waitUntil`) ishlaydi, panelga bog'liq emas: tab yopilsa ham xabar ketadi. 8 s dan keyin avval belgilar
  hali bazada borligi qayta tekshiriladi, faqat ular uchun yuboriladi (qayta o'qib bo'lmasa — yuboriladi: yo'qolgan xabardan
  bekor qilingan xabar yaxshi). Vaqt chegarasi — yuborish boshlanganidan 30 s.
- Natija `attendance.notify_status` ga yoziladi: `held` → `sent | blocked | no_chat | failed | unknown | skipped | bad_name | bad_note`,
  `notified_at` — qachon. Panel ushlash tugagach shuni o'qib, yetmagan xabar haqida ogohlantiradi. Ustun yo'q bo'lsa
  (migratsiya qo'llanmagan) yozuv e'tiborsiz, xabar baribir ketadi, panel jim.
- `hold` yo'q (eski panel), o'tgan kun, ulanmagan ota-ona, o'chirilgan shablon — xabar avvalgidek darhol yoki umuman ketmaydi.
- Migratsiya: `attendance.notify_status text`, `attendance.notified_at timestamptz` (qo'shimcha, nullable).

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

## Xabar yetdimi (`mark-attendance` → `delivery`)

Belgilar avval yoziladi, xabarlar keyin ketadi: bir vaqtda 5 ta chat, bitta chatga ketma-ket
(aka-uka bitta ota-onada). So'rov boshlanganidan 11 s o'tgach yangi xabar boshlanmaydi, bitta xabar
ko'pi bilan 6 s kutiladi — panelning 20 s kutishiga yetmaydi. Har natijada `delivery`:

| `delivery` | Ma'nosi |
|---|---|
| `sent` | yetdi (`notified: true`) |
| `blocked` / `no_chat` / `failed` | yetmadi (ota-ona botni bloklagan / chat yo'q / boshqa xato) |
| `unknown` | Telegram javob bermadi — yetgan bo'lishi mumkin; hech qachon "yetmadi" deyilmaydi |
| `skipped` | vaqt tugadi yoki Telegram to'xtatdi (token / rate limit) — yuborilmadi |
| `bad_name` / `bad_note` | ism yoki izohda havola, `@` yoki uzun raqam bor — ota-onaga yuborilmaydi (xuddi shu qoida to'lov xabarida ham) |
| `muted` / `no_tg` / `no_bot` | admin o'chirgan / ota-ona ulanmagan / bot yo'q |
| `null` | o'tgan kun — xabar umuman ketmaydi |

Guruh javobida: `notify_failed` (blocked, no_chat, failed, skipped, bad_*) va `notify_unknown`.
Panel buni toast'da ko'rsatadi. Havola ko'rinishi (`link_preview_options`) o'chirilgan.

## Ota-onaga xabar shablonlari

Matnni admin paneldan (Sozlamalar → Ota-onaga xabarlar) tahrirlaydi. Saqlanadi:
`app_config.msg_templates` — `{"in": {"on": true, "text": "..." | null}, ...}`.
`text: null` — standart matn (`mark-attendance` dagi `DEFAULT_TPL`).

- Turlar: `in` `out` `absent` `excused` (davomat), `pay` (to'lov eslatmasi, faqat qo'lda),
  `paid` (to'lov qabul qilindi).
- O'zgaruvchilar: `{ism}` `{vaqt}` `{kurs}` `{guruh}` `{sana}` `{sabab}` `{oy}` `{oylar}` `{summa}` — har bir turda
  faqat mosi ruxsat (`admin-api` → `TPL_VARS`). `{ism}` har doim shart:
  oilada bir nechta farzand o'qishi mumkin.
- `{guruh}` — o'quvchining guruhi (`course_groups`). Faqat kursda 2 ta va undan ko'p guruh bo'lsa to'ladi
  (bitta «Asosiy» guruh xabarni to'ldirmasin), aks holda bo'sh va uning qatori tushib qoladi. `payfam`
  (oilaviy eslatma) da yo'q: unda bir nechta farzand bor. Standart matnlarda ishlatilmaydi — admin o'zi qo'shadi
  (masalan `👥 {guruh}`). Qiymatni `mark-attendance` va `admin-api` (`loadGroupNames`) hamda panel (`tplGroupName`) bir xil hisoblaydi.
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
- **Oila: bitta xabar.** Bir ota-onaga (chatga) tushadigan farzandlar bitta xabarga birlashadi — shablon `payfam`
  (`{bolalar}` — «• Ism (kurs) — qarz oylar» qatorlari, `{oy}`; panelda Sozlamalar → Xabarlar → «Oila», faqat qo'lda
  yuboriladi). Tekshiruvlar (to'lagan, 7 kun, ism va h.k.) o'quvchi bo'yicha qoladi: xabarga faqat yuboriladiganlar kiradi;
  bitta farzand qolsa — oddiy `pay` matni. Ona va ota ikkalasi ulangan bo'lsa, har biriga o'z xabari (ikkalasida ham
  to'liq ro'yxat); bir farzand ikki xabarga tushishi mumkin — kamida bittasi yetsa «yuborildi», yetmagan bo'lsa
  `unknown` (javob kelmadi) `failed` dan ustun. Ro'yxat 10 farzandgacha, qolgani «… +N». Jurnal (`payment_reminders`)
  baribir har bir farzandga bitta qator. Javobda `messages` (yuborilgan xabarlar) va `family` (shundan oilaviylari).
  Panel bir oilani bitta so'rovga solib yuboradi (bo'laklar oilani bo'lmaydi), chunki birlashtirish bitta so'rov ichida.
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
- Nom: ichki bo'shliqlar yig'iladi, 80 belgigacha. Bunday nomli kurs bor bo'lsa (`courses_name_key`)
  — **409** «… nomli kurs allaqachon bor» (panel xatoni oynaning o'zida ko'rsatadi).
  Rang faqat `sky / green / teal / violet / rose / gold` dan (boshqasi `sky` bo'ladi — qiymat
  panelda `style` ichiga tushadi), belgi 8 kod nuqtagacha. Yo'q `id` — **404**. Javob: `{ ok: true, id }`.
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

## Parol siyosati (`admin-api` → `save_teacher`, `bootstrap`)

Supabase Free tarifida «leaked password protection» (HaveIBeenPwned) yo'q, shuning uchun eng xavfli parollarni o'zimiz rad etamiz
(`passwordIssue`; panelda `passIssue` — xuddi shu qoidalar, serverga bormasdan ko'rsatadi). Kamida 8 belgi, va:
faqat raqamlar; bir xil belgi/qisqa birlik takrori (`11111111`, `abababab`); ketma-ketlik (`12345678`, `abcdefgh`, `qwertyui`);
oddiy so'z + raqam/belgi (`parol123`, `Qwerty2024!`, `Parvoz_2026`; so'zlar ro'yxati `WEAK_WORDS`); emailning lokal qismi (4+ belgi)
yoki ism/familiya (4+ belgi) parol ichida. Parol almashtirishda bo'sh parol — «o'zgartirmaslik», tekshirilmaydi.
Pro tarifga o'tilsa, Supabase'ning o'z tekshiruvini ham yoqish mumkin (Authentication → Sign In / Providers → Email).
