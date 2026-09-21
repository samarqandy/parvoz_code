# Supabase edge funksiyalari

Bu papkadagi kod Supabase'da ishlaydi. Deploy Supabase MCP / CLI orqali
qilinadi; repodagi nusxa — manba va tarix uchun.

| Funksiya | `verify_jwt` | Vazifasi |
|---|---|---|
| `admin-api` | ✅ | Panel uchun boshqaruv: o'qituvchilar, kurslar, bot sozlamalari, ariza xabarnomalari |
| `mark-attendance` | ✅ | Kelgan/ketganni belgilash + ota-onaga Telegram xabari |
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
