-- Kursning oylik narxi (so'm). To'lov oynasida summa o'zi qo'yiladi va qarz taxminan
-- hisoblanadi. null — narx belgilanmagan. Faqat admin-api (save_course) yozadi.
alter table public.courses add column monthly_fee integer;
alter table public.courses add constraint courses_monthly_fee_range
  check (monthly_fee is null or monthly_fee between 0 and 100000000);
