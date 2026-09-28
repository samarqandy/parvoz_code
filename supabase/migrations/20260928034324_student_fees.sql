-- O'quvchining shaxsiy oylik narxi (chegirma yoki alohida kelishuv). Yozuv yo'q — kurs narxi.
-- students jadvalida emas, alohida: o'qituvchilar o'quvchilarni ko'radi, lekin pul
-- ma'lumotini ko'rmasligi kerak. Faqat admin o'qiydi va o'zgartiradi.
create table public.student_fees (
  student_id uuid primary key references public.students(id) on delete cascade,
  monthly_fee integer not null,
  updated_by_email text,
  updated_at timestamptz not null default now(),
  constraint student_fees_range check (monthly_fee between 0 and 100000000)
);

-- Kim va qachon o'zgartirgani brauzerdan kelmaydi
create or replace function private.stamp_student_fee() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by_email := nullif(private.my_email(), '');
  new.updated_at := now();
  return new;
end $$;
create trigger student_fees_stamp before insert or update on public.student_fees
  for each row execute function private.stamp_student_fee();

alter table public.student_fees enable row level security;
create policy "admin reads student fees"   on public.student_fees for select to authenticated using (private.is_admin());
create policy "admin adds student fees"    on public.student_fees for insert to authenticated with check (private.is_admin());
create policy "admin edits student fees"   on public.student_fees for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin removes student fees" on public.student_fees for delete to authenticated using (private.is_admin());

revoke all on public.student_fees from anon;
revoke truncate, references, trigger on public.student_fees from authenticated;
