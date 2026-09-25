# -*- coding: utf-8 -*-
"""Maqola sahifalarini yaratadi.

Sayt qobig'i (nav, mobil menyu, footer, skriptlar) mavjud kurs sahifasidan
olinadi — shunda maqolalar dizaynda hech qachon qolib ketmaydi.
"""
import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from articles import ARTICLES  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'dasturlash-kurslari.html').read_text()

# --- qobiqni ajratib olamiz ---
top = SRC[SRC.index('<body class="js">'):SRC.index('<main id="main">')]
bottom = SRC[SRC.index('<footer>'):]

BASE = 'https://parvozcode.uz/'
ORG = {
    "@type": "EducationalOrganization",
    "name": "Parvoz O'quv Markazi",
    "url": BASE,
}


def esc(t):
    return html.escape(t, quote=True)


def strip_tags(t):
    return re.sub(r'<[^>]+>', '', t)


def build(a):
    url = BASE + a['slug'] + '.html'
    crumb_url, crumb_name = a['course']

    faq_html = ''.join(
        f'''
      <div class="faq-item">
        <button class="faq-q" type="button" aria-expanded="false">{esc(q)}<span class="faq-ico" aria-hidden="true">+</span></button>
        <div class="faq-a"><p>{esc(ans)}</p></div>
      </div>''' for q, ans in a['faq'])

    body_html = ''.join(
        f'\n    <h2>{esc(h)}</h2>\n    ' + '\n    '.join(paras)
        for h, paras in a['sections'])

    graph = [
        {
            "@type": "Article",
            "headline": a['h1'],
            "description": a['desc'],
            "url": url,
            "inLanguage": "uz",
            "datePublished": a['date'],
            "dateModified": a['date'],
            "author": ORG,
            "publisher": ORG,
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "about": {"@type": "Thing", "name": "Bolalar ta'limi"},
        },
        {
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": {"@type": "Answer", "text": ans},
                } for q, ans in a['faq']
            ],
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Bosh sahifa", "item": BASE},
                {"@type": "ListItem", "position": 2, "name": "Maqolalar", "item": BASE + "maqolalar.html"},
                {"@type": "ListItem", "position": 3, "name": a['h1']},
            ],
        },
    ]
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph},
                    ensure_ascii=False, indent=2)

    return f'''<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">

<title>{esc(a['title'])}</title>
<meta name="description" content="{esc(a['desc'])}">
<link rel="canonical" href="{url}">

<meta property="og:site_name" content="Parvoz O'quv Markazi">
<meta property="og:title" content="{esc(a['h1'])}">
<meta property="og:description" content="{esc(a['desc'])}">
<meta property="og:image" content="{BASE}assets/preview.jpg">
<meta property="og:url" content="{url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="uz_UZ">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(a['h1'])}">
<meta name="twitter:description" content="{esc(a['desc'])}">
<meta name="twitter:image" content="{BASE}assets/preview.jpg">

<meta name="theme-color" content="#071029" id="themeColorMeta">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">

<script>
(function () {{
  var t;
  try {{ t = localStorage.getItem('parvoz-theme'); }} catch (e) {{}}
  if (t !== 'light' && t !== 'dark') {{
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }}
  document.documentElement.setAttribute('data-theme', t);
}})();
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/config.js"></script>
<script src="assets/analytics.js" defer></script>

<script type="application/ld+json">
{ld}
</script>
</head>
{top}<main id="main">
<div class="wrap">
  <article class="doc art">
    <nav class="crumbs" aria-label="Navigatsiya zanjiri">
      <a href="index.html">Bosh sahifa</a> <span>&rsaquo;</span>
      <a href="maqolalar.html">Maqolalar</a> <span>&rsaquo;</span>
      <span>{esc(strip_tags(a['h1'])[:38])}…</span>
    </nav>

    <h1>{esc(a['h1'])}</h1>
    <p class="doc-date">Yangilangan: {a['date']}</p>

    <p class="art-lede">{a['lede']}</p>
{body_html}

    <h2>Tez-tez so'raladigan savollar</h2>
    <div class="faq-list">{faq_html}
    </div>

    <div class="art-cta">
      <h3>Bolangizni bepul sinov darsiga olib keling</h3>
      <p>Birinchi dars to'liq bepul, oldindan to'lov yo'q. Bola darsdan keyin qaytishni xohlamasa — hech qanday majburiyat yo'q.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="index.html#yozilish">🎁 Bepul darsga yozilish</a>
        <a class="btn btn-ghost" href="{crumb_url}">{esc(crumb_name)}</a>
      </div>
    </div>

    <p class="art-back"><a href="maqolalar.html">← Barcha maqolalar</a></p>
  </article>
</div>
</main>

{bottom}'''


def build_index():
    cards = ''.join(f'''
      <a class="art-card" href="{a['slug']}.html">
        <h2>{esc(a['h1'])}</h2>
        <p>{esc(a['desc'])}</p>
        <span class="art-more">O'qish →</span>
      </a>''' for a in ARTICLES)

    ld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "CollectionPage",
                "name": "Ota-onalar uchun maqolalar",
                "description": "Bolalar ta'limi bo'yicha ota-onalar eng ko'p beradigan savollarga javoblar.",
                "url": BASE + "maqolalar.html",
                "inLanguage": "uz",
                "isPartOf": {"@type": "WebSite", "name": "Parvoz O'quv Markazi", "url": BASE},
            },
            {
                "@type": "ItemList",
                "itemListElement": [
                    {"@type": "ListItem", "position": i + 1,
                     "url": BASE + a['slug'] + '.html', "name": a['h1']}
                    for i, a in enumerate(ARTICLES)
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Bosh sahifa", "item": BASE},
                    {"@type": "ListItem", "position": 2, "name": "Maqolalar"},
                ],
            },
        ],
    }, ensure_ascii=False, indent=2)

    desc = ("Bolani kursga berishdan oldin ota-onalar eng ko'p beradigan savollarga "
            "aniq javoblar: yosh, narx, qaysi yo'nalish va nimaga e'tibor berish kerak.")

    return f'''<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">

<title>Ota-onalar uchun maqolalar | Parvoz O'quv Markazi</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{BASE}maqolalar.html">

<meta property="og:site_name" content="Parvoz O'quv Markazi">
<meta property="og:title" content="Ota-onalar uchun maqolalar">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{BASE}assets/preview.jpg">
<meta property="og:url" content="{BASE}maqolalar.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="uz_UZ">
<meta name="twitter:card" content="summary_large_image">

<meta name="theme-color" content="#071029" id="themeColorMeta">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">

<script>
(function () {{
  var t;
  try {{ t = localStorage.getItem('parvoz-theme'); }} catch (e) {{}}
  if (t !== 'light' && t !== 'dark') {{
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }}
  document.documentElement.setAttribute('data-theme', t);
}})();
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/config.js"></script>
<script src="assets/analytics.js" defer></script>

<script type="application/ld+json">
{ld}
</script>
</head>
{top}<main id="main">
<div class="wrap">
  <div class="doc art">
    <nav class="crumbs" aria-label="Navigatsiya zanjiri">
      <a href="index.html">Bosh sahifa</a> <span>&rsaquo;</span>
      <span>Maqolalar</span>
    </nav>

    <h1>Ota-onalar uchun maqolalar</h1>
    <p class="art-lede">Bolani kursga berishdan oldin eng ko'p beriladigan savollar — va ularga aniq javoblar. Reklama emas, amaliy maslahat.</p>

    <div class="art-grid">{cards}
    </div>

    <div class="art-cta">
      <h3>Savolingizga javob topmadingizmi?</h3>
      <p>Qo'ng'iroq qiling yoki Telegramda yozing — javob beramiz.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="tel:+998972344442">📞 +998 97 234 44 42</a>
        <a class="btn btn-ghost" href="https://t.me/parvozcode" target="_blank" rel="noopener">Telegram</a>
      </div>
    </div>
  </div>
</div>
</main>

{bottom}'''


if __name__ == '__main__':
    n = 0
    for a in ARTICLES:
        (ROOT / f"{a['slug']}.html").write_text(build(a))
        n += 1
    (ROOT / 'maqolalar.html').write_text(build_index())
    print(f'{n} ta maqola + 1 ta ro\'yxat sahifasi yaratildi')
