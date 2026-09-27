-- Server (service_role, JWT emailsiz) notified_at ni yozganda "kim yozgani" bo'sh
-- qiymat bilan almashmasin: faqat foydalanuvchi so'rovida emailni yozamiz.
create or replace function private.stamp_payment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.my_email() <> '' then
    new.marked_by_email := private.my_email();
  elsif tg_op = 'UPDATE' then
    new.marked_by_email := old.marked_by_email;
  end if;
  return new;
end $$;
