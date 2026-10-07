-- Bitta o'quvchiga bir nechta ota-ona (ona va ota): har bir ota-onaning Telegram chati alohida yozuv.
-- Bir chat bir nechta o'quvchiga ulanishi mumkin (aka-uka) — shuning uchun kalit (student_id, chat_id).
-- Faqat edge funksiyalar (service_role) yozadi; panel faqat o'qiydi.
--
-- Qo'shimcha migratsiya: mavjud ustun va jadvallarga tegilmaydi. students.telegram_chat_id / linked_phone / linked_at
-- endi "birinchi ulangan ota-ona"ning nusxasi: ularni trigger parent_chats dan yangilab turadi, shuning uchun eski
-- kod (va panelning ulanish belgisi) o'zgarishsiz ishlayveradi.

-- Ikkinchi ota-ona: ismi va raqami (ixtiyoriy). Ulanish uchun raqam ikkalasidan biriga mos kelishi kerak.
alter table public.students
  add column parent_name2 text,
  add column parent_phone2 text;
grant insert (parent_name2, parent_phone2), update (parent_name2, parent_phone2) on public.students to authenticated;

create table public.parent_chats (
  student_id uuid not null references public.students(id) on delete cascade,
  chat_id bigint not null,
  -- Telegram o'zi tasdiqlagan raqam (998901234567 ko'rinishida)
  phone text not null,
  linked_at timestamptz not null default now(),
  primary key (student_id, chat_id)
);
create index parent_chats_chat on public.parent_chats (chat_id);

alter table public.parent_chats enable row level security;
create policy "staff read parent chats" on public.parent_chats
  for select to authenticated using (
    private.is_admin()
    or exists (select 1 from public.students s where s.id = student_id and private.teaches(s.course_id))
  );
revoke all on public.parent_chats from anon, authenticated;
grant select on public.parent_chats to authenticated;

-- students dagi eski maydonlar = birinchi ulangan ota-ona (yoki bo'sh)
create or replace function private.sync_student_chat() returns trigger
language plpgsql security definer set search_path = '' as $f$
declare
  sid uuid := coalesce(new.student_id, old.student_id);
  c record;
begin
  select pc.chat_id, pc.phone, pc.linked_at into c
    from public.parent_chats pc where pc.student_id = sid
    order by pc.linked_at, pc.chat_id limit 1;
  update public.students s
     set telegram_chat_id = c.chat_id, linked_phone = c.phone, linked_at = c.linked_at
   where s.id = sid;
  return null;
end $f$;
revoke all on function private.sync_student_chat() from public, anon, authenticated;
create trigger parent_chats_sync after insert or update or delete on public.parent_chats
  for each row execute function private.sync_student_chat();

-- Hozirgi ulanishlar yangi jadvalga ko'chadi
insert into public.parent_chats (student_id, chat_id, phone, linked_at)
select s.id, s.telegram_chat_id,
       coalesce(nullif(s.linked_phone, ''), regexp_replace(coalesce(s.parent_phone, ''), '\D', '', 'g')),
       coalesce(s.linked_at, now())
  from public.students s
 where s.telegram_chat_id is not null
on conflict do nothing;
