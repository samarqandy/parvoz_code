# -*- coding: utf-8 -*-
"""Ruscha kurs sahifalarini o'zbekcha kurs sahifalaridan yaratadi.

    python3 tools/gen_courses_ru.py

O'zbekcha sahifa — manba (qo'lda yoziladi). Generator:
  * o'zbekcha matnni sahifaning o'zidan tartib bo'yicha oladi va courses_ru.py dagi
    tarjima bilan almashtiradi (matn qidirib emas, o'rni bo'yicha);
  * sayt qobig'ini (nav, footer) gen_articles.py dagi CHROME_RU bilan tarjima qiladi;
  * <head> va JSON-LD ni ruscha qiladi, hreflang juftligini ikkala sahifaga qo'yadi;
  * ruscha sahifada o'zbekcha so'z qolmaganini tekshiradi;
  * sitemap.xml ga ruscha sahifalarni hreflang bilan qo'shadi.

O'zbekcha matn o'zgarsa (SRC_HASH mos kelmasa) to'xtaydi: avval tarjimani yangilang.
"""
import copy
import hashlib
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from courses_ru import COURSES, SHARED, SRC_HASH   # noqa: E402
import gen_articles                                  # noqa: E402  (CHROME_RU, to_ru)

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://parvozcode.uz/'
ORG = BASE + '#organization'

# O'zbekcha sahifadagi tarjima qilinadigan joylar: nom, qolip, har moslikdagi guruhlar soni
PARTS = [
    ('h1', r'(<section class="cp-hero[^"]*">.*?<h1>)(.*?)(</h1>)', 1),
    ('lead', r'(<p class="cp-lead">)(.*?)(</p>)', 1),
    ('learn', r'(<div class="learn-item" data-reveal><span class="li-ico" aria-hidden="true">[^<]*</span><div><strong>)(.*?)'
              r'(</strong><p>)(.*?)(</p>)', 2),
    ('feat_h2', r'(<h2 class="sec-title">)([^<]*nima uchun kerak\?)(</h2>)', 1),
    ('feat', r'(<div class="feat" data-reveal><div class="feat-ico" aria-hidden="true">✦</div><div><strong>)(.*?)'
             r'(</strong><p>)(.*?)(</p>)', 2),
    ('faq', r'(<button class="faq-q" type="button" aria-expanded="false"><span>)(.*?)'
            r'(</span><span class="faq-plus" aria-hidden="true">\+</span></button><div class="faq-a"><div class="faq-a-inner">)(.*?)(</div>)', 2),
    ('cta_p', r'(<div class="cta-banner" data-reveal>\s*<h2>[^<]*</h2>\s*<p>)(.*?)(</p>)', 1),
]
RU_BLOCK = re.compile(r'\n  <section>\n    <div class="ru-block" data-reveal>.*?</div>\n  </section>\n', re.S)
LD = re.compile(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', re.S)

# Ruscha sahifada ruxsat etilgan lotin so'zlar (nomlar, texnologiyalar)
LATIN_OK = {'Parvoz', 'PARV', 'O', 'Z', 'Scratch', 'Python', 'HTML', 'CSS', 'Click', 'Payme', 'Mone', 'Caf',
            'Telegram', 'Instagram', 'IT', 'FAQ', 'Learn', 'Build', 'Fly', 'parvozcode', 'parvoz', 'code'}


def extract(page, key):
    pat, n = next((p, n) for k, p, n in PARTS if k == key)
    ms = list(re.finditer(pat, page, re.S))
    return [m.group(2) if n == 1 else (m.group(2), m.group(4)) for m in ms]


def replace_part(page, key, values):
    pat, n = next((p, n) for k, p, n in PARTS if k == key)
    vals = list(values) if isinstance(values, list) else [values]
    found = len(re.findall(pat, page, re.S))
    if found != len(vals):
        raise SystemExit(f"{key}: sahifada {found} ta, tarjimada {len(vals)} ta")
    it = iter(vals)

    def sub(m):
        v = next(it)
        if n == 1:
            return m.group(1) + v + m.group(3)
        return m.group(1) + v[0] + m.group(3) + v[1] + m.group(5)
    return re.sub(pat, sub, page, flags=re.S)


def src_hash(page):
    data = {k: extract(page, k) for k, _, _ in PARTS}
    data['desc'] = re.search(r'<meta name="description" content="(.*?)">', page).group(1)
    return hashlib.sha1(json.dumps(data, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def hreflang(uz_url, ru_url):
    return (f'<link rel="alternate" hreflang="uz" href="{uz_url}">\n'
            f'<link rel="alternate" hreflang="ru" href="{ru_url}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{uz_url}">')


def with_hreflang(page, url, uz_url, ru_url):
    page = re.sub(r'<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n', '', page)
    canon = f'<link rel="canonical" href="{url}">'
    if page.count(canon) != 1:
        raise SystemExit(f'canonical topilmadi: {url}')
    return page.replace(canon, canon + '\n' + hreflang(uz_url, ru_url))


def lang_link(page, href, code, label):
    """Nav zanjiridan keyin til almashtirish havolasi (bir marta)."""
    page = re.sub(r'\n  <p class="cp-lang">.*?</p>', '', page)
    link = (f'\n  <p class="cp-lang"><a href="{href}" hreflang="{code}" lang="{code}">'
            f'{gen_articles.FLAG[code]}{label}</a></p>')
    m = re.search(r'<nav class="crumbs".*?</nav>', page, re.S)
    return page[:m.end()] + link + page[m.end():]


def ru_ld(uz_ld, c, url):
    d = json.loads(uz_ld)
    g = d['@graph']
    course = next(x for x in g if x['@type'] == 'Course')
    course.update(name=c['ld_name'], description=c['desc'], url=url, inLanguage='ru',
                  teaches=[t for t, _ in c['learn']])
    course['offers']['url'] = url
    for inst in course['hasCourseInstance']:
        inst['location']['name'] = 'Учебный центр Parvoz'
        inst['location']['address'].update(streetAddress='ул. Дагбитская, 11, 2 этаж', addressLocality='Самарканд',
                                           addressRegion='Самаркандская область')
    crumbs = next(x for x in g if x['@type'] == 'BreadcrumbList')['itemListElement']
    crumbs[0].update(name='Главная', item=BASE + 'ru.html')
    crumbs[1].update(name='Курсы', item=BASE + 'ru.html#kurslar')
    crumbs[2].update(name=c['name'], item=url)
    faq = next(x for x in g if x['@type'] == 'FAQPage')
    if len(faq['mainEntity']) != len(c['faq']):
        raise SystemExit(f"{c['ru']}: FAQ soni mos emas")
    faq['mainEntity'] = [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                         for q, a in c['faq']]
    return json.dumps(d, ensure_ascii=False, indent=2).replace('</', '<\\/')


def ru_head(head, c, uz_url, url):
    rep = [
        ('<html lang="uz">', '<html lang="ru">'),
        (re.search(r'<title>.*?</title>', head).group(0), f'<title>{c["title"]}</title>'),
        (re.search(r'<meta name="description" content=".*?">', head).group(0), f'<meta name="description" content="{c["desc"]}">'),
        (f'<link rel="canonical" href="{uz_url}">', f'<link rel="canonical" href="{url}">'),
        (re.search(r'<meta property="og:title" content=".*?">', head).group(0), f'<meta property="og:title" content="{c["h1"]}">'),
        (re.search(r'<meta property="og:description" content=".*?">', head).group(0), f'<meta property="og:description" content="{c["desc"]}">'),
        (f'<meta property="og:url" content="{uz_url}">', f'<meta property="og:url" content="{url}">'),
        ('<meta property="og:locale" content="uz_UZ">', '<meta property="og:locale" content="ru_RU">'),
        (re.search(r'<meta name="twitter:title" content=".*?">', head).group(0), f'<meta name="twitter:title" content="{c["h1"]}">'),
        (re.search(r'<meta name="twitter:description" content=".*?">', head).group(0), f'<meta name="twitter:description" content="{c["desc"]}">'),
    ]
    for a, b in rep:
        if head.count(a) != 1:
            raise SystemExit(f"{c['ru']}: <head> da topilmadi: {a[:60]}")
        head = head.replace(a, b)
    # Ruscha sahifaga kelgan odam bosh sahifaga o'tsa ham ruscha ko'rsin (P0-3)
    return with_boot(head.replace(gen_articles.LANG_BOOT['uz'], ''), 'ru')


def with_boot(page, lang):
    """Til skriptini mavzu skriptidan keyin qo'yadi (bir marta)."""
    boot = gen_articles.LANG_BOOT[lang]
    if boot in page:
        return page
    i = page.index('</script>') + len('</script>')
    return page[:i] + boot + page[i:]


def leftover_uz(page, extra=()):
    body = page[page.index('<body'):]
    body = re.sub(r'<script.*?</script>|<svg.*?</svg>|<[^>]+\blang="uz"[^>]*>.*?</a>', ' ', body, flags=re.S)
    attrs = ' '.join(re.findall(r'(?:aria-label|title|alt)="([^"]*)"', body))
    text = re.sub(r'<[^>]+>', ' ', body) + ' ' + attrs
    words = set(re.findall(r"[A-Za-z][A-Za-z'ʻ’]*", text))
    return sorted(w for w in words if w not in LATIN_OK and w not in extra)


def build(c):
    uz_path, ru_path = ROOT / c['uz'], ROOT / c['ru']
    uz_url, ru_url = BASE + c['uz'], BASE + c['ru']
    page = uz_path.read_text()

    for key in ('title', 'desc'):
        lim = 60 if key == 'title' else 155
        if len(c[key]) > lim:
            raise SystemExit(f"{c['ru']}: {key} {len(c[key])} > {lim}")

    h = src_hash(page)
    if SRC_HASH.get(c['uz']) not in (None, h):
        raise SystemExit(f"{c['uz']} matni o'zgargan (hash {h}). Tarjimani courses_ru.py da yangilang, "
                         f"so'ng SRC_HASH['{c['uz']}'] = '{h}' qiling.")

    # --- O'zbekcha sahifa: ruscha orolni olib tashlash, hreflang, til havolasi
    uz = RU_BLOCK.sub('\n', page)
    uz = with_hreflang(uz, uz_url, uz_url, ru_url)
    uz = lang_link(uz, c['ru'], 'ru', 'По-русски')
    uz = with_boot(uz, 'uz')
    uz_path.write_text(uz)

    # --- Ruscha sahifa
    i = uz.index('<body')
    head, body = uz[:i], uz[i:]
    m = LD.search(head)
    head = head[:m.start(2)] + ru_ld(m.group(2), c, ru_url) + head[m.end(2):]
    head = ru_head(with_hreflang(head, uz_url, uz_url, ru_url), c, uz_url, ru_url)

    body = re.sub(r'\n  <p class="cp-lang">.*?</p>', '', body)
    for key in ('h1', 'lead', 'learn', 'feat_h2', 'feat', 'faq', 'cta_p'):
        body = replace_part(body, key, c[key])
    uz_name = re.search(r'<span class="k">Yo\'nalish</span><span class="v">([^<]+)</span>', body).group(1)
    body = body.replace(f'<span>{uz_name}</span>\n  </nav>', f'<span>{c["name"]}</span>\n  </nav>', 1)
    body = body.replace(f'<span class="v">{uz_name}</span>', f'<span class="v">{c["name"]}</span>', 1)
    for a, b in SHARED:
        body = body.replace(a, b)
    body = gen_articles.to_ru(body)
    page_ru = head + body
    page_ru = lang_link(page_ru, c['uz'], 'uz', "O'zbekcha")

    left = leftover_uz(page_ru)
    if left:
        raise SystemExit(f"{c['ru']}: o'zbekcha so'zlar qoldi: {', '.join(left)}")
    ru_path.write_text(page_ru)
    return h


def sync_sitemap():
    path = ROOT / 'sitemap.xml'
    xml = path.read_text()
    for c in COURSES:
        uz_url, ru_url = BASE + c['uz'], BASE + c['ru']
        xml = re.sub(r'\n  <url>\n    <loc>' + re.escape(ru_url) + r'</loc>.*?</url>', '', xml, flags=re.S)
        m = re.search(r'  <url>\n    <loc>' + re.escape(uz_url) + r'</loc>.*?</url>', xml, re.S)
        block = m.group(0)
        lastmod = re.search(r'<lastmod>(.*?)</lastmod>', block).group(1)
        links = '\n'.join(f'    <xhtml:link rel="alternate" hreflang="{code}" href="{u}"/>'
                          for code, u in (('uz', uz_url), ('ru', ru_url), ('x-default', uz_url)))

        def entry(loc):
            return (f'  <url>\n    <loc>{loc}</loc>\n{links}\n    <lastmod>{lastmod}</lastmod>\n'
                    f'    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>')
        xml = xml.replace(block, entry(uz_url) + '\n' + entry(ru_url))
    path.write_text(xml)


def main():
    hashes = {c['uz']: build(c) for c in COURSES}
    sync_sitemap()
    import sitemap_lastmod  # noqa: E402  (sanalar — git bo'yicha)
    sitemap_lastmod.main()
    print(f"{len(COURSES)} ta ruscha kurs sahifasi yaratildi: " + ', '.join(c['ru'] for c in COURSES))
    missing = {k: v for k, v in hashes.items() if SRC_HASH.get(k) != v}
    if missing:
        print('SRC_HASH ni courses_ru.py ga yozing:\n' + json.dumps(missing, indent=4))


if __name__ == '__main__':
    main()
