-- Oylik to'lovlar: o'quvchiga oyiga bitta yozuv. Yozuv bor = to'lagan.
-- Faqat admin ko'radi va o'zgartiradi (o'qituvchilar pul ma'lumotini ko'rmaydi).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- To'lovi bor o'quvchini o'chirib bo'lmaydi (arxivlanadi): o'quvchini
  -- o'chira oladigan o'qituvchi pul tarixini bilvosita o'chirib yubormasin.
  student_id uuid not null references public.students(id) on delete restrict,
  month date not null,                         -- oyning 1-kuni
  amount integer,                              -- so'm; null — summa yozilmagan
  paid_on date not null default ((now() at time zone 'Asia/Samarkand')::date),
  note text,
  marked_by_email text,
  created_at timestamptz not null default now(),
  constraint payments_month_first_day check (extract(day from month) = 1),
  constraint payments_amount_range check (amount is null or amount between 0 and 100000000),
  constraint payments_note_len check (note is null or char_length(note) <= 200),
  constraint payments_one_per_month unique (student_id, month)
);
create index payments_month_idx on public.payments (month);

-- Kim yozgani brauzerdan kelmaydi — JWT dan olinadi
create or replace function private.stamp_payment() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.marked_by_email := private.my_email();
  return new;
end $$;
create trigger payments_stamp before insert or update on public.payments
  for each row execute function private.stamp_payment();

alter table public.payments enable row level security;
create policy "admin reads payments"   on public.payments for select to authenticated using (private.is_admin());
create policy "admin adds payments"    on public.payments for insert to authenticated with check (private.is_admin());
create policy "admin edits payments"   on public.payments for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin removes payments" on public.payments for delete to authenticated using (private.is_admin());

revoke all on public.payments from anon;
revoke truncate, references, trigger on public.payments from authenticated;
