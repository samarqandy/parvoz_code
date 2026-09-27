-- O'qituvchilar app_config dan faqat panelga kerak kalitlarni o'qiydi.
-- Avval taqiqlangan kalitlar ro'yxati edi (denylist) va admin_link_code
-- (ariza xabarnomalariga ulanish kodi) har qanday o'qituvchiga ochiq edi.
-- Ruxsat etilganlar ro'yxati (allowlist) yangi maxfiy kalit qo'shilganda ham xavfsiz.
drop policy if exists "teachers can read public config" on public.app_config;
create policy "teachers can read public config" on public.app_config
  for select to authenticated
  using (private.is_teacher() and key = any (array['bot_username', 'tg_mode', 'msg_templates']));
