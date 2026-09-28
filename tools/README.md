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

`llms.txt` hali qo'lda yangilanadi — mazmun o'zgarsa, uni ham tekshiring.
