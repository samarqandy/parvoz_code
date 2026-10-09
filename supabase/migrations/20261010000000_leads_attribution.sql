-- Arizaning reklama manbasi. Sayt (assets/analytics.js) UTM va reklama bosish identifikatorlarini (gclid, yclid, ...) eslab qoladi,
-- ariza bilan birga yuboradi; submit-lead ularni tozalab saqlaydi.
--   channel     — kanal: google_ads | yandex_ads | meta | google_organic | yandex_organic | telegram | instagram | referral | utm_<manba> | direct
--   attribution — xom paket: {utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, gbraid, wbraid, yclid, fbclid, landing, referrer}
-- Ikkalasi ham bo'sh bo'lishi mumkin (eski arizalar). Mavjud RLS siyosatlari va huquqlar o'zgarmaydi: arizani faqat xodimlar o'qiydi.
alter table public.leads
  add column if not exists channel text check (channel is null or char_length(channel) <= 40),
  add column if not exists attribution jsonb check (attribution is null or pg_column_size(attribution) <= 4096);
