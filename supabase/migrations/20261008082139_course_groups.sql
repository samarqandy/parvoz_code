-- Kurs ichidagi guruhlar: kurs (Dasturlash) ichida bir nechta guruh (dars kunlari va vaqti bilan), o'quvchi bitta guruhda o'qiydi.
-- Qo'shimcha migratsiya: mavjud jadvallar va RLS siyosatlari o'zgarmaydi; o'qituvchi hamon kursga biriktirilgan (private.teaches(course_id)).
-- Guruhlarni yozadigan faqat service_role (admin-api); panel faqat o'qiydi. O'quvchining guruhini panel students.group_id orqali o'zgartiradi.

create table public.course_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- dars kunlari: 1 = dushanba ... 7 = yakshanba
  days smallint[] not null default '{}' check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  starts time,
  ends time,
  created_at timestamptz not null default now(),
  check (starts is null or ends is null or ends > starts)
);
-- bitta kursda bir xil nomli ikkita guruh bo'lmasin
create unique index course_groups_name on public.course_groups (course_id, lower(btrim(name)));

alter table public.course_groups enable row level security;
create policy "staff read groups" on public.course_groups
  for select to authenticated using (private.is_admin() or private.teaches(course_id));
revoke all on public.course_groups from anon, authenticated;
grant select on public.course_groups to authenticated;

-- O'quvchining guruhi (ixtiyoriy). Guruh o'chsa o'quvchi guruhsiz qoladi.
alter table public.students add column group_id uuid references public.course_groups(id) on delete set null;
create index students_group on public.students (group_id);
grant insert (group_id), update (group_id) on public.students to authenticated;

-- Guruh o'quvchining o'z kursiga tegishli bo'lishi shart. Kurs almashsa (guruh o'zgarmasa) — eski kursning guruhi tozalanadi.
create or replace function private.check_student_group() returns trigger
language plpgsql security definer set search_path = '' as $f$
begin
  if new.group_id is null then return new; end if;
  if exists (select 1 from public.course_groups g where g.id = new.group_id and g.course_id = new.course_id) then return new; end if;
  if tg_op = 'UPDATE' and new.group_id is not distinct from old.group_id and new.course_id is distinct from old.course_id then
    new.group_id := null;
    return new;
  end if;
  raise exception 'group_id o''quvchining kursiga tegishli emas' using errcode = '23514';
end $f$;
revoke all on function private.check_student_group() from public, anon, authenticated;
create trigger students_check_group before insert or update of group_id, course_id on public.students
  for each row execute function private.check_student_group();

-- Mavjud ma'lumot: har kursga «Asosiy» guruh, hamma hozirgi o'quvchilar shunga tushadi
insert into public.course_groups (course_id, name) select c.id, 'Asosiy' from public.courses c;
update public.students s set group_id = g.id
  from public.course_groups g
 where g.course_id = s.course_id and g.name = 'Asosiy' and s.group_id is null;
