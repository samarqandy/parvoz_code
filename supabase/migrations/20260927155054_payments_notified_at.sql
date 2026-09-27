-- Ota-onaga "to'lov qabul qilindi" xabari qachon yuborilgani. Xabar faqat admin-api
-- (service_role) orqali ketadi va shu ustunni band qiladi — bir to'lovga bitta xabar.
alter table public.payments add column notified_at timestamptz;
