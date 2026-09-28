# tools

Maqola sahifalari shu yerdan yaratiladi — qo'lda tahrirlanmaydi.

- `articles.py` — maqolalar mazmuni (sarlavha, javob, bo'limlar, FAQ).
- `gen_articles.py` — sahifalarni yozadi.

Sayt qobig'i (nav, mobil menyu, footer, skriptlar) `dasturlash-kurslari.html`
dan olinadi, shuning uchun dizayn o'zgarsa maqolalar ham o'zi yangilanadi.

```
python3 tools/gen_articles.py
```

Mazmunni o'zgartirgach shu buyruqni qayta ishga tushiring. U oxirida
`sitemap_lastmod.py` ni ham chaqiradi: `sitemap.xml` dagi `<lastmod>` sanalari
fayllarning haqiqiy o'zgarish sanasiga moslanadi (commit qilinmagan fayl — bugun,
qolganlari — git'dagi oxirgi commit). Boshqa sahifani (masalan, kurs sahifasini)
o'zgartirsangiz, commit'dan oldin alohida ishga tushiring:

```
python3 tools/sitemap_lastmod.py
```

## Ruscha kurs sahifalari

- `courses_ru.py` — 5 ta kurs sahifasining ruscha tarjimasi (sarlavha, tavsif,
  h1, "nimalarni o'rganadi", FAQ va h.k.).
- `gen_courses_ru.py` — ruscha sahifalarni o'zbekcha kurs sahifalaridan yozadi:
  `dasturlash-kurslari.html` → `kursy-programmirovaniya.html`,
  `robototexnika-kurslari.html` → `robototehnika.html`,
  `matematika-kurslari.html` → `matematika.html`,
  `shaxmat-kurslari.html` → `shahmaty.html`,
  `ingliz-tili-kurslari.html` → `angliyskiy.html`.

```
python3 tools/gen_courses_ru.py
```

O'zbekcha kurs sahifasi — manba, qo'lda tahrirlanadi; ruschasi qo'lda
tahrirlanmaydi. Generator o'zbekcha matnni sahifadan o'rni bo'yicha oladi va
tarjima bilan almashtiradi, ikkala sahifaga hreflang qo'yadi, ruscha sahifada
o'zbekcha so'z qolmaganini tekshiradi va `sitemap.xml` ni yangilaydi.

O'zbekcha sahifadagi tarjima qilinadigan matn o'zgarsa, generator to'xtaydi
(`SRC_HASH` mos kelmaydi) — avval `courses_ru.py` dagi tarjimani yangilang,
so'ng xabardagi yangi `SRC_HASH` qiymatini yozing. Nav, footer yoki narx kabi
umumiy qismlar o'zgarsa, tarjimasini `courses_ru.py` dagi `SHARED` ga yoki
`gen_articles.py` dagi `CHROME_RU` ga qo'shing.

Ikkala generatorni ham qayta ishga tushirish xavfsiz — o'zgarish bo'lmasa
fayllar bir xil qoladi.

`llms.txt` hali qo'lda yangilanadi — mazmun o'zgarsa, uni ham tekshiring.
