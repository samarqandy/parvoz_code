# Supabase edge funksiyalari

Bu papkadagi kod Supabase'da ishlaydi. Deploy Supabase MCP / CLI orqali
qilinadi; repodagi nusxa — manba va tarix uchun.

| Funksiya | `verify_jwt` | Vazifasi |
|---|---|---|
| `admin-api` | ✅ | Panel uchun boshqaruv: o'qituvchilar, kurslar, bot sozlamalari, ariza xabarnomalari, ota-onaga xabar shablonlari |
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
