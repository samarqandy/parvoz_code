-- "Bekor qilish" oynasi: ota-onaga xabar 8 soniya ushlab turiladi (mark-attendance, hold). Fonda yuboriladigan xabarning natijasi
-- belgiga yoziladi, shunda panel yetmagan xabar haqida ogohlantira oladi. Qo'shimcha migratsiya: ikkala ustun nullable, mavjud
-- qatorlarga va RLS ga tegilmaydi (yozadigan faqat service_role — authenticated uchun INSERT/UPDATE siyosati yo'q).
alter table public.attendance
  add column notify_status text,
  add column notified_at timestamptz;
comment on column public.attendance.notify_status is
  'Ota-onaga xabar natijasi: held | sent | blocked | no_chat | failed | unknown | skipped | bad_name | bad_note (null — xabar ushlanmagan)';
