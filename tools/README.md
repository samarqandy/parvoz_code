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

## Ruscha bosh sahifa

- `home_ru.py` — `ru.html` uchun `<head>`, JSON-LD va atribut (aria-label, alt)
  tarjimalari. Sahifa matnining o'zi `index.html` dagi `<span data-lang="ru">`
  lardan olinadi.
- `gen_home_ru.py` — `index.html` dan `ru.html` ni yozadi.

```
python3 tools/gen_home_ru.py
```

`index.html` — manba, qo'lda tahrirlanadi; `ru.html` qo'lda tahrirlanmaydi.
Bosh sahifa matnini o'zgartirganda ruscha spanni ham yangilang va generatorni
ishga tushiring. Generator ruscha sahifada o'zbekcha so'z qolsa yoki `index.html`
dagi FAQ JSON-LD savoli sahifada topilmasa to'xtaydi.

Til tanlovi (`localStorage` dagi `parvoz-lang`) oxirgi ko'rilgan sahifa tiliga
teng: ruscha sahifalar `ru`, o'zbekcha sahifalar (ruscha tanlov bo'lsa) `uz`
yozadi. Ruscha tanlagan odam bosh sahifaga kirsa, `index.html` uni `ru.html`
ga o'tkazadi ("Orqaga" bilan qaytganda o'tkazmaydi). Qidiruv robotlarida
`localStorage` bo'sh — ular har doim o'z tilidagi sahifani ko'radi.

## Inglizcha bosh sahifa

- `home_en.py` — `en.html` uchun `<head>`, JSON-LD, atribut tarjimalari, kurslar
  haqida batafsil bo'lim (`DETAILS`) va qo'shimcha savol-javoblar (`EXTRA_FAQ`).
- `gen_home_en.py` — `index.html` dan `en.html` ni yozadi (`gen_home_ru.py` bilan bir xil usul).

```
python3 tools/gen_home_en.py
```

Inglizcha kurs sahifalari yo'q: kurs kartalari `en.html` ichidagi bo'limlarga olib boradi.
`EXTRA_FAQ` va `DETAILS` ga faqat tasdiqlangan faktlarni yozing (manzil, narx, jadval — `llms.txt`
va o'zbekcha kurs sahifalaridagi bilan bir xil). Hreflang uchligi (uz / ru / en) `index.html`
`<head>` ida, `sitemap.xml` yozuvlarini `gen_home_ru.py` yangilaydi.
Tilni tanlash: `index.html` dagi RU va EN — havola; oldin `ru` yoki `en` tanlagan odamni
`index.html` o'sha sahifaga o'tkazadi.

## AI assistentlar uchun (GEO)

- `llms.txt` — qisqa fakt varaqasi (NAP, narx, jadval, sahifalar xaritasi); qo'lda yangilanadi.
- `gen_llms_full.py` — `llms-full.txt`: markaz faktlari (`llms.txt` boshi) + kurs va maqolalarning
  to'liq matni (o'zbekcha va ruscha). Kurs/maqola matni o'zgarsa qayta ishga tushiring.
- `parvoz-markazi-haqida-savol-javob.html` / `uchebnyj-centr-parvoz-voprosy-otvety.html` —
  `articles.py` / `articles_ru.py` dagi 7-maqola (19 ta savol-javob); javob birinchi jumlada.

```
python3 tools/gen_llms_full.py
```

Hamma generatorni qayta ishga tushirish xavfsiz — o'zgarish bo'lmasa fayllar bir xil qoladi.
Tartib: `gen_articles.py`, `gen_courses_ru.py`, `gen_home_ru.py`, `gen_home_en.py`, `gen_llms_full.py`.

`llms.txt` hali qo'lda yangilanadi — mazmun o'zgarsa, uni ham tekshiring.
