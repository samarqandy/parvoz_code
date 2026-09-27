-- Bir o'quvchiga bir kunda (Samarqand vaqti) bir turdagi belgi faqat bir marta.
-- mark-attendance buni o'zi ham tekshiradi, lekin ikki telefondan bir vaqtda
-- bosilsa ikkala so'rov ham "hali yo'q" deb ko'rib, ikki qator yozishi mumkin edi.
create unique index if not exists attendance_one_per_day
  on public.attendance (student_id, kind, ((occurred_at at time zone 'Asia/Samarkand')::date));
