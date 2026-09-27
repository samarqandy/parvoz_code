# Supabase edge funksiyalari

Bu papkadagi kod Supabase'da ishlaydi. Deploy Supabase MCP / CLI orqali
qilinadi; repodagi nusxa — manba va tarix uchun.

| Funksiya | `verify_jwt` | Vazifasi |
|---|---|---|
| `admin-api` | ✅ | Panel uchun boshqaruv: o'qituvchilar, kurslar, bot sozlamalari, ariza xabarnomalari, ota-onaga xabar shablonlari, to'lov eslatmalari |
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

## Ota-onaga xabar shablonlari

Matnni admin paneldan (Sozlamalar → Ota-onaga xabarlar) tahrirlaydi. Saqlanadi:
`app_config.msg_templates` — `{"in": {"on": true, "text": "..." | null}, ...}`.
`text: null` — standart matn (`mark-attendance` dagi `DEFAULT_TPL`).

- O'zgaruvchilar: `{ism}` `{vaqt}` `{kurs}` `{sana}` `{sabab}` — har bir turda
  faqat mosi ruxsat (`admin-api` → `TPL_VARS`). `{ism}` har doim shart:
  oilada bir nechta farzand o'qishi mumkin.
- `*matn*` — qalin. Qolgan hamma narsa ekranlanadi (`parse_mode: HTML`).
- Qiymati bo'sh o'zgaruvchi turgan qator tushib qoladi ({ism} qatoridan tashqari).
- `on: false` — belgi yoziladi, xabar ketmaydi (javobda `muted: true`).

Ko'rsatish mantig'i (`renderTpl`) `assets/app.js` da ham bor — admin ko'rgan
namuna ota-ona oladigan xabarning o'zi bo'lishi uchun. Birini o'zgartirsangiz,
ikkinchisini ham o'zgartiring.

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
