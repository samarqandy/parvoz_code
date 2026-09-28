# -*- coding: utf-8 -*-
"""Ruscha bosh sahifani (ru.html) index.html dan yaratadi.

    python3 tools/gen_home_ru.py

index.html — manba, qo'lda tahrirlanadi (uch tilli: <span data-lang="uz|ru|en">).
Generator:
  * har bir tildagi spanlardan faqat ruschasini qoldiradi — ru.html da o'zbekcha va
    inglizcha matn umuman bo'lmaydi;
  * <head>, JSON-LD (tashkilot, kurslar katalogi, FAQ) va atributlarni ruscha qiladi —
    FAQ JSON-LD sahifadagi ruscha savol-javobdan olinadi, shuning uchun ular doim mos;
  * kurs kartalarini ruscha kurs sahifalariga ulaydi, til almashtirgichni havolaga aylantiradi;
  * ruscha sahifada o'zbekcha so'z qolmaganini tekshiradi;
  * sitemap.xml ga index.html <-> ru.html hreflang juftligini yozadi.

ru.html qo'lda tahrirlanmaydi: matnni index.html dagi ruscha spanda o'zgartiring va
shu buyruqni qayta ishga tushiring.
"""
import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import home_ru as R                     # noqa: E402
from gen_courses_ru import leftover_uz  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://parvozcode.uz/'
URL = BASE + 'ru.html'
KEEP = 'ru'

HREFLANG = (f'<link rel="alternate" hreflang="uz" href="{BASE}">\n'
            f'<link rel="alternate" hreflang="ru" href="{URL}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{BASE}">')
BOOT = "<script>\ntry { localStorage.setItem('parvoz-lang', 'ru'); } catch (e) {}\n</script>"
NOTE = ('<!-- Bu fayl tools/gen_home_ru.py tomonidan index.html dan yaratiladi — qo\'lda tahrirlamang.\n'
        '     Matnni index.html dagi ruscha spanlarda o\'zgartirib, generatorni qayta ishga tushiring. -->\n')

OPEN = re.compile(r'<span data-lang="(uz|ru|en)"(?: class="show")?>')
TAG = re.compile(r'<span\b|</span>')


def one(page, old, new, what):
    if page.count(old) != 1:
        raise SystemExit(f"index.html: {what} topilmadi yoki bir nechta ({page.count(old)})")
    return page.replace(old, new)


def keep_lang(text):
    """<span data-lang="..."> lardan faqat ruschasini qoldiradi (ichma-ich spanlarni hisobga olib)."""
    out, i = [], 0
    while True:
        m = OPEN.search(text, i)
        if not m:
            out.append(text[i:])
            return ''.join(out)
        out.append(text[i:m.start()])
        depth, j = 1, m.end()
        while depth:
            t = TAG.search(text, j)
            if not t:
                raise SystemExit('index.html: yopilmagan <span data-lang>')
            depth += 1 if t.group(0) == '<span' else -1
            j = t.end()
        if m.group(1) == KEEP:
            out.append('<span>' + keep_lang(text[m.end():j - len('</span>')]) + '</span>')
        i = j


def span_text(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


def visible_faq(body_uz):
    """index.html dagi FAQ: o'zbekcha savol -> (ruscha savol, ruscha javob)."""
    faq = {}
    for item in re.findall(r'<div class="faq-item">(.*?)</div></div>\s*</div>', body_uz, re.S):
        q = re.search(r'<button class="faq-q"[^>]*>(.*?)</button>', item, re.S).group(1)
        a = re.search(r'<div class="faq-a-inner">(.*)', item, re.S).group(1)
        pick = lambda frag, lang: span_text(re.search(  # noqa: E731
            rf'<span data-lang="{lang}"(?: class="show")?>(.*?)</span>', frag, re.S).group(1))
        faq[pick(q, 'uz')] = (pick(q, 'ru'), pick(a, 'ru'))
    return faq


def ru_ld(head, body_uz):
    blocks = list(re.finditer(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', head, re.S))
    if len(blocks) != 2:
        raise SystemExit(f'index.html: 2 ta JSON-LD kutilgan, {len(blocks)} ta topildi')
    main, faq = (json.loads(m.group(2)) for m in blocks)

    org = next(x for x in main['@graph'] if '@type' in x and 'LocalBusiness' in x['@type'])
    org['description'] = R.ORG_DESC
    org['address'].update(R.ADDRESS)
    for a in org['areaServed']:
        a['name'] = R.AREA[a['name']]
    cat = org['hasOfferCatalog']
    cat['name'] = R.CATALOG
    for offer in cat['itemListElement']:
        slug = offer['url'][len(BASE):]
        ru_slug, name = R.COURSES[slug]
        offer['url'] = offer['itemOffered']['url'] = BASE + ru_slug
        offer['itemOffered']['name'] = name
    main['@graph'].append({"@type": "WebPage", "@id": URL, "url": URL, "name": R.TITLE,
                           "inLanguage": "ru", "isPartOf": {"@id": BASE + "#website"},
                           "about": {"@id": BASE + "#organization"}})

    # FAQ: index.html JSON-LD dagi savollar tartibida, matn — sahifadagi ruscha savol-javob
    vis = visible_faq(body_uz)
    ents = []
    for e in faq['mainEntity']:
        if e['name'] not in vis:
            raise SystemExit(f"FAQ JSON-LD dagi savol sahifada yo'q: {e['name']}")
        q, a = vis[e['name']]
        ents.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})
    faq['mainEntity'] = ents

    dump = lambda d: json.dumps(d, ensure_ascii=False, indent=2).replace('</', '<\\/')  # noqa: E731
    head = head[:blocks[1].start(2)] + dump(faq) + head[blocks[1].end(2):]
    return head[:blocks[0].start(2)] + dump(main) + head[blocks[0].end(2):]


def ru_head(head, body_uz):
    head = one(head, '<html lang="uz">', '<html lang="ru">', '<html lang>')
    for pat, new in [
        (r'<title>.*?</title>', f'<title>{html.escape(R.TITLE)}</title>'),
        (r'<meta name="description" content=".*?">', f'<meta name="description" content="{html.escape(R.DESC)}">'),
        (r'<meta property="og:title" content=".*?">', f'<meta property="og:title" content="{html.escape(R.OG_TITLE)}">'),
        (r'<meta property="og:description" content=".*?">', f'<meta property="og:description" content="{html.escape(R.OG_DESC)}">'),
        (r'<meta name="twitter:title" content=".*?">', f'<meta name="twitter:title" content="{html.escape(R.OG_TITLE)}">'),
        (r'<meta name="twitter:description" content=".*?">', f'<meta name="twitter:description" content="{html.escape(R.OG_DESC)}">'),
    ]:
        if len(re.findall(pat, head)) != 1:
            raise SystemExit(f'index.html <head>: {pat}')
        head = re.sub(pat, lambda _m: new, head)
    head = one(head, f'<link rel="canonical" href="{BASE}">', f'<link rel="canonical" href="{URL}">', 'canonical')
    head = one(head, f'<meta property="og:url" content="{BASE}">', f'<meta property="og:url" content="{URL}">', 'og:url')
    head = one(head, '<meta property="og:locale" content="uz_UZ">', '<meta property="og:locale" content="ru_RU">', 'og:locale')
    if HREFLANG not in head:
        raise SystemExit("index.html: hreflang juftligi (uz/ru/x-default) <head> da yo'q")

    # Bosh sahifadagi til yo'naltiruvchisi ru.html da bo'lmaydi — o'rniga til tanlovi yoziladi
    route = re.search(r'<!-- Til: .*?-->\n<script id="langRoute">.*?</script>', head, re.S)
    if not route:
        raise SystemExit("index.html: langRoute skripti topilmadi")
    head = head[:route.start()] + BOOT + head[route.end():]
    head = ru_ld(head, body_uz)
    return head.replace('<head>\n', '<head>\n' + NOTE, 1)


def ru_body(body):
    body = re.sub(r'<!--.*?-->\n?', '', body, flags=re.S)            # izohlar (o'zbekcha) kerak emas
    n_attr = body.count('data-lang=')
    n_span = len(OPEN.findall(body))
    if n_attr != n_span:
        raise SystemExit(f'index.html: {n_attr - n_span} ta data-lang span emas yoki boshqacha yozilgan')
    body = keep_lang(body)

    # Kurs kartalari -> ruscha kurs sahifalari
    body, n = re.subn(r'href="[^"]+" data-href-ru="([^"]+)"', r'href="\1"', body)
    if n != len(R.COURSES):
        raise SystemExit(f'kurs kartalari: {n} ta, {len(R.COURSES)} ta kutilgan')
    for uz, (ru, _) in R.COURSES.items():
        body = body.replace(f'href="{uz}"', f'href="{ru}"')

    body, n = re.subn(r'<div class="lang-btns".*?</div>', lambda _m: R.LANG_BTNS, body, flags=re.S)
    if n != 1:
        raise SystemExit('til almashtirgich topilmadi')
    for a, b in R.ATTRS:
        body = one(body, a, b, a[:40])

    # Bo'sh qolgan qatorlar
    body = re.sub(r'\n[ \t]+(?=\n)', '\n', body)
    return re.sub(r'\n{3,}', '\n\n', body)


def check(page):
    for bad in ('data-lang=', 'data-href-ru="', 'class="show"', 'id="langRoute"', 'window.__toRu = true'):
        if bad in page:
            raise SystemExit(f'ru.html da qolgan: {bad}')
    left = leftover_uz(page, extra={'UZ', 'RU', 'EN', 'Google', 'Yandex', 'Maps', 'WhatsApp'})
    if left:
        raise SystemExit("ru.html: o'zbekcha so'zlar qoldi: " + ', '.join(left))
    for m in re.finditer(r'<script type="application/ld\+json">\n(.*?)\n</script>', page, re.S):
        json.loads(m.group(1))


def sync_sitemap():
    path = ROOT / 'sitemap.xml'
    xml = path.read_text()
    xml = re.sub(r'\n  <url>\n    <loc>' + re.escape(URL) + r'</loc>.*?</url>', '', xml, flags=re.S)
    m = re.search(r'  <url>\n    <loc>' + re.escape(BASE) + r'</loc>.*?</url>', xml, re.S)
    block = m.group(0)
    tail = re.sub(r'\s*<xhtml:link[^>]*/>', '', block[block.index('</loc>') + len('</loc>'):])
    links = '\n'.join(f'    <xhtml:link rel="alternate" hreflang="{c}" href="{u}"/>'
                      for c, u in (('uz', BASE), ('ru', URL), ('x-default', BASE)))
    entry = lambda loc: f'  <url>\n    <loc>{loc}</loc>\n{links}{tail}'  # noqa: E731
    path.write_text(xml.replace(block, entry(BASE) + '\n' + entry(URL)))


def main():
    for key, lim in (('TITLE', 60), ('DESC', 155)):
        if len(getattr(R, key)) > lim:
            raise SystemExit(f'{key}: {len(getattr(R, key))} > {lim}')
    src = (ROOT / 'index.html').read_text()
    i = src.index('<body>')
    head, body = src[:i], src[i:]
    page = ru_head(head, body) + ru_body(body)
    check(page)
    (ROOT / 'ru.html').write_text(page)
    sync_sitemap()
    import sitemap_lastmod  # noqa: E402
    sitemap_lastmod.main()
    print('ru.html yaratildi')


if __name__ == '__main__':
    main()
