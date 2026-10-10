# -*- coding: utf-8 -*-
"""Inglizcha bosh sahifani (en.html) index.html dan yaratadi.

    python3 tools/gen_home_en.py

gen_home_ru.py bilan bir xil usul: index.html (uch tilli, qo'lda tahrirlanadi) manba;
generator <span data-lang="en"> lardan faqat inglizchasini qoldiradi, <head>, JSON-LD va atributlarni
inglizcha qiladi. Inglizcha kurs sahifalari yo'q, shuning uchun kurs kartalari en.html ichidagi
"What each course teaches" bo'limiga olib boradi (matn home_en.py da), FAQ ga esa
home_en.EXTRA_FAQ qo'shiladi (JSON-LD sahifadagi savol-javob bilan doim mos).

en.html qo'lda tahrirlanmaydi: matnni index.html dagi inglizcha spanda (yoki home_en.py da)
o'zgartiring va shu buyruqni qayta ishga tushiring.
"""
import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_home_ru as G   # noqa: E402
import home_en as E       # noqa: E402

ROOT, BASE = G.ROOT, G.BASE
URL = BASE + 'en.html'
G.KEEP = 'en'             # G.keep_lang() qaysi tilni qoldirishini shu belgilaydi
BOOT = "<script>\ntry { localStorage.setItem('parvoz-lang', 'en'); } catch (e) {}\n</script>"
NOTE = ('<!-- Bu fayl tools/gen_home_en.py tomonidan index.html dan yaratiladi — qo\'lda tahrirlamang.\n'
        '     Matnni index.html dagi inglizcha spanlarda (yoki tools/home_en.py da) o\'zgartirib, generatorni qayta ishga tushiring. -->\n')
esc = html.escape


def visible_faq(body_uz):
    """index.html dagi FAQ: o'zbekcha savol -> (inglizcha savol, inglizcha javob)."""
    faq = {}
    for item in re.findall(r'<div class="faq-item">(.*?)</div></div>\s*</div>', body_uz, re.S):
        q = re.search(r'<button class="faq-q"[^>]*>(.*?)</button>', item, re.S).group(1)
        a = re.search(r'<div class="faq-a-inner">(.*)', item, re.S).group(1)
        pick = lambda frag, lang: G.span_text(re.search(  # noqa: E731
            rf'<span data-lang="{lang}"(?: class="show")?>(.*?)</span>', frag, re.S).group(1))
        faq[pick(q, 'uz')] = (pick(q, 'en'), pick(a, 'en'))
    return faq


def en_ld(head, body_uz):
    blocks = list(re.finditer(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', head, re.S))
    if len(blocks) != 2:
        raise SystemExit(f'index.html: 2 ta JSON-LD kutilgan, {len(blocks)} ta topildi')
    main, faq = (json.loads(m.group(2)) for m in blocks)

    org = next(x for x in main['@graph'] if '@type' in x and 'LocalBusiness' in x['@type'])
    org['description'] = E.ORG_DESC
    org['address'].update(E.ADDRESS)
    for a in org['areaServed']:
        a['name'] = E.AREA[a['name']]
    cat = org['hasOfferCatalog']
    cat['name'] = E.CATALOG
    for offer in cat['itemListElement']:
        slug = offer['url'][len(BASE):]
        anchor, name = E.COURSES[slug]
        offer['url'] = offer['itemOffered']['url'] = URL + anchor
        offer['itemOffered']['name'] = name
    main['@graph'].append({"@type": "WebPage", "@id": URL, "url": URL, "name": E.TITLE,
                           "inLanguage": "en", "isPartOf": {"@id": BASE + "#website"},
                           "about": {"@id": BASE + "#organization"}})

    vis = visible_faq(body_uz)
    ents = []
    for e in faq['mainEntity']:
        if e['name'] not in vis:
            raise SystemExit(f"FAQ JSON-LD dagi savol sahifada yo'q: {e['name']}")
        q, a = vis[e['name']]
        ents.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})
    for q, a in E.EXTRA_FAQ:
        ents.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})
    faq['mainEntity'] = ents

    dump = lambda d: json.dumps(d, ensure_ascii=False, indent=2).replace('</', '<\\/')  # noqa: E731
    head = head[:blocks[1].start(2)] + dump(faq) + head[blocks[1].end(2):]
    return head[:blocks[0].start(2)] + dump(main) + head[blocks[0].end(2):]


def en_head(head, body_uz):
    head = G.one(head, '<html lang="uz">', '<html lang="en">', '<html lang>')
    for pat, new in [
        (r'<title>.*?</title>', f'<title>{esc(E.TITLE)}</title>'),
        (r'<meta name="description" content=".*?">', f'<meta name="description" content="{esc(E.DESC)}">'),
        (r'<meta property="og:title" content=".*?">', f'<meta property="og:title" content="{esc(E.OG_TITLE)}">'),
        (r'<meta property="og:description" content=".*?">', f'<meta property="og:description" content="{esc(E.OG_DESC)}">'),
        (r'<meta name="twitter:title" content=".*?">', f'<meta name="twitter:title" content="{esc(E.OG_TITLE)}">'),
        (r'<meta name="twitter:description" content=".*?">', f'<meta name="twitter:description" content="{esc(E.OG_DESC)}">'),
    ]:
        if len(re.findall(pat, head)) != 1:
            raise SystemExit(f'index.html <head>: {pat}')
        head = re.sub(pat, lambda _m: new, head)
    head = G.one(head, f'<link rel="canonical" href="{BASE}">', f'<link rel="canonical" href="{URL}">', 'canonical')
    head = G.one(head, f'<meta property="og:url" content="{BASE}">', f'<meta property="og:url" content="{URL}">', 'og:url')
    head = G.one(head, '<meta property="og:locale" content="uz_UZ">', '<meta property="og:locale" content="en_US">', 'og:locale')
    if G.HREFLANG not in head:
        raise SystemExit("index.html: hreflang to'plami (uz/ru/en/x-default) <head> da yo'q")

    route = re.search(r'<!-- Til: .*?-->\n<script id="langRoute">.*?</script>', head, re.S)
    if not route:
        raise SystemExit("index.html: langRoute skripti topilmadi")
    head = head[:route.start()] + BOOT + head[route.end():]
    head = en_ld(head, body_uz)
    return head.replace('<head>\n', '<head>\n' + NOTE, 1)


def details_section():
    items = []
    for sid, icon, name, lines in E.DETAILS:
        intro, rest = lines[0], lines[1:]
        li = ''.join(f'<li>{esc(x)}</li>' for x in rest)
        items.append(f'''      <div class="feat" id="{sid}" data-reveal>
        <div class="feat-ico" aria-hidden="true">{icon}</div>
        <div>
          <h3><strong>{esc(name)}</strong></h3>
          <p>{esc(intro)}</p>
          <ul>{li}</ul>
        </div>
      </div>''')
    return f'''<!-- ============================ COURSE DETAILS (en) ============================ -->
<div class="wrap">
  <section id="course-details">
    <div class="sec-head" data-reveal>
      <span class="sec-eyebrow">{esc(E.DETAILS_EYEBROW)}</span>
      <h2 class="sec-title">{esc(E.DETAILS_TITLE)}</h2>
      <p class="sec-sub">{esc(E.DETAILS_SUB)}</p>
    </div>
    <div class="features-grid">
{chr(10).join(items)}
    </div>
  </section>
</div>

'''


def extra_faq_items():
    return ''.join(f'''      <div class="faq-item">
        <button class="faq-q" type="button" aria-expanded="false">
          <span>{esc(q)}</span>
          <span class="faq-plus" aria-hidden="true">+</span>
        </button>
        <div class="faq-a"><div class="faq-a-inner">{esc(a)}</div></div>
      </div>
''' for q, a in E.EXTRA_FAQ)


def en_body(body):
    body = re.sub(r'<!--.*?-->\n?', '', body, flags=re.S)
    n_attr = body.count('data-lang=')
    n_span = len(G.OPEN.findall(body))
    if n_attr != n_span:
        raise SystemExit(f'index.html: {n_attr - n_span} ta data-lang span emas yoki boshqacha yozilgan')
    body = G.keep_lang(body)

    # Kurs kartalari -> shu sahifadagi kurs bo'limlari
    body, n = re.subn(r'href="[^"]+" data-href-ru="[^"]+"', 'href="@@"', body)
    if n != len(E.COURSES):
        raise SystemExit(f'kurs kartalari: {n} ta, {len(E.COURSES)} ta kutilgan')
    for anchor, _ in E.COURSES.values():
        body = body.replace('href="@@"', f'href="{anchor}"', 1)
    for uz in E.COURSES:
        if f'href="{uz}"' in body:
            raise SystemExit(f'en.html da {uz} ga havola qoldi')

    body, n = re.subn(r'<div class="lang-btns".*?</div>', lambda _m: E.LANG_BTNS, body, flags=re.S)
    if n != 1:
        raise SystemExit('til almashtirgich topilmadi')
    for a, b in E.ATTRS:
        body = G.one(body, a, b, a[:40])

    # Kurslar batafsil bo'limi: "Why Parvoz" dan oldin
    marker = '<div class="wrap">\n  <section id="nega-parvoz">'
    body = G.one(body, marker, details_section() + marker, 'nega-parvoz bo\'limi')

    # Qo'shimcha savol-javoblar: FAQ ro'yxati oxiriga
    tail = re.compile(r'(</div></div>\n      </div>\n)(    </div>\n\s*<p style="text-align:center;margin-top:26px">)')
    if len(tail.findall(body)) != 1:
        raise SystemExit("FAQ ro'yxati oxiri topilmadi")
    body = tail.sub(lambda m: m.group(1) + extra_faq_items() + m.group(2), body)

    body = re.sub(r'\n[ \t]+(?=\n)', '\n', body)
    return re.sub(r'\n{3,}', '\n\n', body)


UZ_LEFT_OK = {'UZ', 'RU', 'EN', 'Google', 'Yandex', 'Maps', 'WhatsApp', 'PARVOZ', 'Parvoz', 'Telegram', 'Instagram',
              'Click', 'Payme', 'UZS', 'IT', 'HTML', 'CSS', 'Scratch', 'Python', 'Dahbed', 'Gelion', 'Mone', 'Caf',
              'Samarkand', 'Uzbekistan', 'Uzbek', 'Russian', 'Code', 'Learn', 'Build', 'Fly', 'Gmail'}


def check(page):
    for bad in ('data-lang=', 'data-href-ru="', 'class="show"', 'id="langRoute"', 'window.__toRu = true'):
        if bad in page:
            raise SystemExit(f'en.html da qolgan: {bad}')
    body = page[page.index('<body'):]
    # lang="ru"/"uz" bilan belgilangan havolalar (maqolalar bo'limi) ataylab o'z tilida
    vis = re.sub(r'<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<a\b[^>]*\blang="(?:ru|uz)"[^>]*>.*?</a>', ' ', body, flags=re.S)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', vis))
    # Kirill faqat manzil/aloqa uchun maxsus ko'rsatilgan joylarda bo'lishi mumkin
    cyr = sorted(set(re.findall(r'[А-Яа-яЁё]+', text)))
    allowed = {'ул', 'Дагбитская', 'этаж'}
    stray = [w for w in cyr if w not in allowed]
    if stray:
        raise SystemExit("en.html: ruscha so'zlar qoldi: " + ', '.join(stray[:12]))
    uz_markers = ['Bepul', 'bepul', 'Yozilish', 'Narxlar', 'Jadval', 'Kurslar', 'Dasturlash', 'Aloqa', "so'm", 'Maxfiylik']
    left = [w for w in uz_markers if re.search(rf'\b{re.escape(w)}', text)]
    if left:
        raise SystemExit("en.html: o'zbekcha so'zlar qoldi: " + ', '.join(left))
    for m in re.finditer(r'<script type="application/ld\+json">\n(.*?)\n</script>', page, re.S):
        json.loads(m.group(1))


def main():
    for key, lim in (('TITLE', 70), ('DESC', 160)):
        if len(getattr(E, key)) > lim:
            raise SystemExit(f'{key}: {len(getattr(E, key))} > {lim}')
    src = (ROOT / 'index.html').read_text()
    i = src.index('<body>')
    head, body = src[:i], src[i:]
    page = en_head(head, body) + en_body(body)
    check(page)
    (ROOT / 'en.html').write_text(page)
    G.sync_sitemap()
    import sitemap_lastmod  # noqa: E402
    sitemap_lastmod.main()
    print('en.html yaratildi')


if __name__ == '__main__':
    main()
