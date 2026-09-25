# tools

Maqola sahifalari shu yerdan yaratiladi — qo'lda tahrirlanmaydi.

- `articles.py` — maqolalar mazmuni (sarlavha, javob, bo'limlar, FAQ).
- `gen_articles.py` — sahifalarni yozadi.

Sayt qobig'i (nav, mobil menyu, footer, skriptlar) `dasturlash-kurslari.html`
dan olinadi, shuning uchun dizayn o'zgarsa maqolalar ham o'zi yangilanadi.

```
python3 tools/gen_articles.py
```

Mazmunni o'zgartirgach shu buyruqni qayta ishga tushiring va
`sitemap.xml` bilan `llms.txt` ni yangilashni unutmang.
