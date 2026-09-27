-- To'lov eslatmalari jurnali: kimga, qaysi oy uchun, kim yubordi, natija.
-- Faqat admin-api (service_role) yozadi; admin panel faqat o'qiydi.
create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  month date not null,
  sent_at timestamptz not null default now(),
  sent_by_email text not null,
  -- pending: yuborishdan OLDIN yoziladi — jarayon yiqilsa ham qayta yuborilmaydi
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'unknown')),
  code text,
  error text check (error is null or char_length(error) <= 200),
  constraint payment_reminders_month_first_day check (extract(day from month) = 1)
);
-- Ikki admin / ikki oyna / qayta urinish bir kunda ikki marta yubora olmaydi
create unique index payment_reminders_one_per_day
  on public.payment_reminders (student_id, ((sent_at at time zone 'Asia/Samarkand')::date))
  where status <> 'failed';
create index payment_reminders_student_sent on public.payment_reminders (student_id, sent_at desc);

alter table public.payment_reminders enable row level security;
create policy "admin reads payment reminders" on public.payment_reminders
  for select to authenticated using (private.is_admin());
revoke all on public.payment_reminders from anon, authenticated;
grant select on public.payment_reminders to authenticated;
