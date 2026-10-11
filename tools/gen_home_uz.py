# -*- coding: utf-8 -*-
"""O'zbekcha bosh sahifani (index.html) tools/home_src.html dan yaratadi.

    python3 tools/gen_home_uz.py

Manba (tools/home_src.html) uch tilli: <span data-lang="uz|ru|en">. Oldin index.html shu uch tilni
bir DOM'da ko'tarib turardi — qidiruv va AI robotlar uch tilni aralash o'qirdi. Endi har til alohida fayl:
index.html faqat o'zbekcha, ru.html ruscha, en.html inglizcha (gen_home_ru.py, gen_home_en.py).

Generator o'zbekcha spanlarni qoldiradi, boshqa tillarni olib tashlaydi; <head> (hreflang, JSON-LD,
langRoute) o'zgarishsiz qoladi. index.html qo'lda tahrirlanmaydi: matnni tools/home_src.html dagi
o'zbekcha spanda o'zgartiring va shu buyruqni (hamda gen_home_ru.py, gen_home_en.py) qayta ishga tushiring.
"""
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_home_ru as G   # noqa: E402

ROOT = G.ROOT
G.KEEP = 'uz'
NOTE = ('<!-- Bu fayl tools/gen_home_uz.py tomonidan tools/home_src.html dan yaratiladi — qo\'lda tahrirlamang.\n'
        '     Matnni tools/home_src.html dagi o\'zbekcha spanlarda o\'zgartirib, generatorni qayta ishga tushiring. -->\n')


def uz_body(body):
    body = re.sub(r'<!--.*?-->\n?', '', body, flags=re.S)
    n_attr, n_span = body.count('data-lang='), len(G.OPEN.findall(body))
    if n_attr != n_span:
        raise SystemExit(f'home_src.html: {n_attr - n_span} ta data-lang span emas yoki boshqacha yozilgan')
    body = G.keep_lang(body)
    # Kurs kartalaridagi ruscha havola atributi o'zbekcha sahifada kerak emas
    body, n = re.subn(r' data-href-ru="[^"]+"', '', body)
    if n != len(G.R.COURSES):
        raise SystemExit(f'kurs kartalari: {n} ta, {len(G.R.COURSES)} ta kutilgan')
    body = re.sub(r'\n[ \t]+(?=\n)', '\n', body)
    return re.sub(r'\n{3,}', '\n\n', body)


CYR_OK = {'ул', 'Дагбитская', 'этаж', 'Статьи', 'для', 'родителей', 'Русская', 'версия'}


def check(page):
    for bad in ('data-lang=', 'data-href-ru="', 'class="show"'):
        if bad in page:
            raise SystemExit(f'index.html da qolgan: {bad}')
    body = page[page.index('<body'):]
    vis = re.sub(r'<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<a\b[^>]*\blang="(?:ru|en)"[^>]*>.*?</a>',
                 ' ', body, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', vis)
    cyr = sorted(set(re.findall(r'[А-Яа-яЁё]+', text)) - CYR_OK)
    if cyr:
        raise SystemExit("index.html: ruscha so'zlar qoldi: " + ', '.join(cyr[:12]))
    for m in re.finditer(r'<script type="application/ld\+json">\n(.*?)\n</script>', page, re.S):
        json.loads(m.group(1))


def main():
    src = G.SRC.read_text()
    i = src.index('<body>')
    head, body = src[:i], src[i:]
    page = head.replace('<head>\n', '<head>\n' + NOTE, 1) + uz_body(body)
    check(page)
    (ROOT / 'index.html').write_text(page)
    import sitemap_lastmod  # noqa: E402
    sitemap_lastmod.main()
    print('index.html yaratildi')


if __name__ == '__main__':
    main()
