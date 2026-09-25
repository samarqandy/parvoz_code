# -*- coding: utf-8 -*-
"""Maqola sahifalarini yaratadi (o'zbekcha va ruscha).

Sayt qobig'i (nav, mobil menyu, footer, skriptlar) mavjud kurs sahifasidan
olinadi — shunda maqolalar dizaynda hech qachon qolib ketmaydi. Ruscha
sahifalar uchun qobiqdagi matnlar CHROME_RU lug'ati bo'yicha almashtiriladi.

    python3 tools/gen_articles.py
"""
import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from articles import ARTICLES            # noqa: E402  (o'zbekcha)
from articles_ru import ARTICLES_RU      # noqa: E402  (ruscha)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'dasturlash-kurslari.html').read_text()

TOP = SRC[SRC.index('<body class="js">'):SRC.index('<main id="main">')]
BOTTOM = SRC[SRC.index('<footer>'):]

BASE = 'https://parvozcode.uz/'

# Qobiqdagi matnlar — ruscha sahifalar uchun
CHROME_RU = [
    ("Asosiy kontentga o'tish", "Перейти к основному содержанию"),
    ('>Kurslar<', '>Курсы<'),
    ('>Nega Parvoz?<', '>Почему Parvoz?<'),
    ('>Narxlar<', '>Цены<'),
    ('>Jadval<', '>Расписание<'),
    ('>Aloqa<', '>Контакты<'),
    ('🎁 Bepul dars', '🎁 Бесплатный урок'),
    ('🏠 Bosh sahifa', '🏠 Главная'),
    ('📚 Kurslar', '📚 Курсы'),
    ('💰 Narxlar', '💰 Цены'),
    ('📅 Dars jadvali', '📅 Расписание'),
    ('📍 Aloqa', '📍 Контакты'),
    ("☀️ Yorug' rejim", '☀️ Светлая тема'),
    ('🎁 Bepul sinov darsiga yozilish', '🎁 Записаться на бесплатный урок'),
    ('aria-label="Parvoz — bosh sahifa"', 'aria-label="Parvoz — главная"'),
    ('aria-label="Asosiy menyu"', 'aria-label="Основное меню"'),
    ('aria-label="Rejimni almashtirish"', 'aria-label="Переключить тему"'),
    ('aria-label="Menyuni ochish"', 'aria-label="Открыть меню"'),
    ('>Dasturlash<', '>Программирование<'),
    ('>Robototexnika<', '>Робототехника<'),
    ('>Matematika<', '>Математика<'),
    ('>Shaxmat<', '>Шахматы<'),
    ('>Ingliz tili<', '>Английский язык<'),
    ("Xaritada ko'rish", 'Посмотреть на карте'),
    ('Ota-onalar uchun maqolalar', 'Статьи для родителей'),
    ('Maxfiylik siyosati', 'Политика конфиденциальности'),
    ("© 2026 Parvoz O'quv Markazi · Samarqand", '© 2026 Учебный центр Parvoz · Самарканд'),
    ("Samarqanddagi bolalar uchun zamonaviy ta'lim markazi: dasturlash, robototexnika, matematika, shaxmat va ingliz tili.",
     'Современный детский учебный центр в Самарканде: программирование, робототехника, математика, шахматы и английский язык.'),
    ('aria-label="Parvoz O\'quv Markazi"', 'aria-label="Учебный центр Parvoz"'),
    ('aria-label="Qo\'ng\'iroq qilish"', 'aria-label="Позвонить"'),
    ('"\\u2600\\ufe0f Yorug\' rejim"', '"\\u2600\\ufe0f \\u0421\\u0432\\u0435\\u0442\\u043b\\u0430\\u044f \\u0442\\u0435\\u043c\\u0430"'),
    ('"\\ud83c\\udf19 Qorong\'i rejim"', '"\\ud83c\\udf19 \\u0422\\u0451\\u043c\\u043d\\u0430\\u044f \\u0442\\u0435\\u043c\\u0430"'),
    ('maqolalar.html', 'stati.html'),
]

# Sahifa ichidagi matnlar
UI = {
    'uz': {
        'home': 'Bosh sahifa', 'articles': 'Maqolalar', 'crumbs': 'Navigatsiya zanjiri',
        'updated': 'Yangilangan', 'faq': "Tez-tez so'raladigan savollar",
        'cta_h': 'Bolangizni bepul sinov darsiga olib keling',
        'cta_p': "Birinchi dars to'liq bepul, oldindan to'lov yo'q. Bola darsdan keyin qaytishni xohlamasa — hech qanday majburiyat yo'q.",
        'cta_btn': '🎁 Bepul darsga yozilish',
        'back': '← Barcha maqolalar',
        'other': '🇷🇺 Читать по-русски',
        'index_h': 'Ota-onalar uchun maqolalar',
        'index_lede': "Bolani kursga berishdan oldin eng ko'p beriladigan savollar — va ularga aniq javoblar. Reklama emas, amaliy maslahat.",
        'index_desc': ("Bolani kursga berishdan oldin ota-onalar eng ko'p beradigan savollarga aniq javoblar: "
                       "yosh, narx, qaysi yo'nalish va nimaga e'tibor berish kerak."),
        'index_title': "Ota-onalar uchun maqolalar | Parvoz O'quv Markazi",
        'more': "O'qish →",
        'ask_h': 'Savolingizga javob topmadingizmi?',
        'ask_p': "Qo'ng'iroq qiling yoki Telegramda yozing — javob beramiz.",
        'lang': 'uz', 'locale': 'uz_UZ',
    },
    'ru': {
        'home': 'Главная', 'articles': 'Статьи', 'crumbs': 'Навигационная цепочка',
        'updated': 'Обновлено', 'faq': 'Частые вопросы',
        'cta_h': 'Приведите ребёнка на бесплатный пробный урок',
        'cta_p': 'Первый урок полностью бесплатный, без предоплаты. Если ребёнок не захочет возвращаться — никаких обязательств.',
        'cta_btn': '🎁 Записаться на бесплатный урок',
        'back': '← Все статьи',
        'other': "🇺🇿 O'zbekcha o'qish",
        'index_h': 'Статьи для родителей',
        'index_lede': 'Вопросы, которые чаще всего задают перед выбором курса — и конкретные ответы на них. Не реклама, а практический совет.',
        'index_desc': ('Конкретные ответы на вопросы, которые родители задают перед записью ребёнка на курсы: '
                       'возраст, стоимость, выбор направления и на что обращать внимание.'),
        'index_title': 'Статьи для родителей | Учебный центр Parvoz',
        'more': 'Читать →',
        'ask_h': 'Не нашли ответ на свой вопрос?',
        'ask_p': 'Позвоните или напишите в Telegram — ответим.',
        'lang': 'ru', 'locale': 'ru_RU',
    },
}

ORG = {"@type": "EducationalOrganization", "name": "Parvoz O'quv Markazi", "url": BASE}


def esc(t):
    return html.escape(t, quote=True)


def chrome(lang):
    top, bottom = TOP, BOTTOM
    if lang == 'ru':
        for a, b in CHROME_RU:
            top = top.replace(a, b)
            bottom = bottom.replace(a, b)
    return top, bottom


def index_slug(lang):
    return 'maqolalar.html' if lang == 'uz' else 'stati.html'


def head(*, lang, title, desc, url, alt_url, page_type='article', ld=''):
    """Ikkala tildagi sahifa uchun umumiy <head>."""
    u = UI[lang]
    uz_url, ru_url = (url, alt_url) if lang == 'uz' else (alt_url, url)
    return f'''<!DOCTYPE html>
<html lang="{u['lang']}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">

<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="uz" href="{uz_url}">
<link rel="alternate" hreflang="ru" href="{ru_url}">
<link rel="alternate" hreflang="x-default" href="{uz_url}">

<meta property="og:site_name" content="Parvoz O'quv Markazi">
<meta property="og:title" content="{esc(title.split(' | ')[0])}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{BASE}assets/preview.jpg">
<meta property="og:url" content="{url}">
<meta property="og:type" content="{page_type}">
<meta property="og:locale" content="{u['locale']}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title.split(' | ')[0])}">
<meta name="twitter:description" content="{esc(desc)}">
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
'''


def build(a, lang, alt_slug, date):
    u = UI[lang]
    url = BASE + a['slug'] + '.html'
    alt_url = BASE + alt_slug + '.html'
    top, bottom = chrome(lang)
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
            "inLanguage": u['lang'],
            "datePublished": date,
            "dateModified": date,
            "author": ORG,
            "publisher": ORG,
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "about": {"@type": "Thing", "name": "Bolalar ta'limi"},
        },
        {
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": ans}}
                for q, ans in a['faq']
            ],
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": u['home'], "item": BASE},
                {"@type": "ListItem", "position": 2, "name": u['articles'],
                 "item": BASE + index_slug(lang)},
                {"@type": "ListItem", "position": 3, "name": a['h1']},
            ],
        },
    ]
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph},
                    ensure_ascii=False, indent=2)

    return head(lang=lang, title=a['title'], desc=a['desc'], url=url,
                alt_url=alt_url, ld=ld) + f'''{top}<main id="main">
<div class="wrap">
  <article class="doc art">
    <nav class="crumbs" aria-label="{esc(u['crumbs'])}">
      <a href="index.html">{esc(u['home'])}</a> <span>&rsaquo;</span>
      <a href="{index_slug(lang)}">{esc(u['articles'])}</a> <span>&rsaquo;</span>
      <span>{esc(a['h1'][:38])}…</span>
    </nav>

    <h1>{esc(a['h1'])}</h1>
    <p class="doc-date">{esc(u['updated'])}: {date} · <a class="art-lang" href="{alt_slug}.html">{esc(u['other'])}</a></p>

    <p class="art-lede">{a['lede']}</p>
{body_html}

    <h2>{esc(u['faq'])}</h2>
    <div class="faq-list">{faq_html}
    </div>

    <div class="art-cta">
      <h3>{esc(u['cta_h'])}</h3>
      <p>{esc(u['cta_p'])}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="index.html#yozilish">{esc(u['cta_btn'])}</a>
        <a class="btn btn-ghost" href="{crumb_url}">{esc(crumb_name)}</a>
      </div>
    </div>

    <p class="art-back"><a href="{index_slug(lang)}">{esc(u['back'])}</a></p>
  </article>
</div>
</main>

{bottom}'''


def build_index(items, lang, alt_slug):
    u = UI[lang]
    url = BASE + index_slug(lang)
    alt_url = BASE + alt_slug
    top, bottom = chrome(lang)

    cards = ''.join(f'''
      <a class="art-card" href="{a['slug']}.html">
        <h2>{esc(a['h1'])}</h2>
        <p>{esc(a['desc'])}</p>
        <span class="art-more">{esc(u['more'])}</span>
      </a>''' for a in items)

    ld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "CollectionPage", "name": u['index_h'],
             "description": u['index_desc'], "url": url, "inLanguage": u['lang'],
             "isPartOf": {"@type": "WebSite", "name": "Parvoz O'quv Markazi", "url": BASE}},
            {"@type": "ItemList",
             "itemListElement": [
                 {"@type": "ListItem", "position": i + 1,
                  "url": BASE + a['slug'] + '.html', "name": a['h1']}
                 for i, a in enumerate(items)]},
            {"@type": "BreadcrumbList",
             "itemListElement": [
                 {"@type": "ListItem", "position": 1, "name": u['home'], "item": BASE},
                 {"@type": "ListItem", "position": 2, "name": u['articles']}]},
        ],
    }, ensure_ascii=False, indent=2)

    return head(lang=lang, title=u['index_title'], desc=u['index_desc'], url=url,
                alt_url=alt_url, page_type='website', ld=ld) + f'''{top}<main id="main">
<div class="wrap">
  <div class="doc art">
    <nav class="crumbs" aria-label="{esc(u['crumbs'])}">
      <a href="index.html">{esc(u['home'])}</a> <span>&rsaquo;</span>
      <span>{esc(u['articles'])}</span>
    </nav>

    <h1>{esc(u['index_h'])}</h1>
    <p class="doc-date"><a class="art-lang" href="{alt_slug}">{esc(u['other'])}</a></p>
    <p class="art-lede">{esc(u['index_lede'])}</p>

    <div class="art-grid">{cards}
    </div>

    <div class="art-cta">
      <h3>{esc(u['ask_h'])}</h3>
      <p>{esc(u['ask_p'])}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="tel:+998972344442">📞 +998 97 234 44 42</a>
        <a class="btn btn-ghost" href="https://t.me/parvozcode" target="_blank" rel="noopener">Telegram</a>
      </div>
    </div>
  </div>
</div>
</main>

{bottom}'''


def main():
    ru_by_uz = {r['for_']: r for r in ARTICLES_RU}
    missing = [a['slug'] for a in ARTICLES if a['slug'] not in ru_by_uz]
    if missing:
        raise SystemExit('Ruscha tarjimasi yo\'q: ' + ', '.join(missing))

    n = 0
    for a in ARTICLES:
        ru = ru_by_uz[a['slug']]
        (ROOT / f"{a['slug']}.html").write_text(build(a, 'uz', ru['slug'], a['date']))
        (ROOT / f"{ru['slug']}.html").write_text(build(ru, 'ru', a['slug'], a['date']))
        n += 2

    (ROOT / 'maqolalar.html').write_text(build_index(ARTICLES, 'uz', 'stati.html'))
    (ROOT / 'stati.html').write_text(build_index(
        [ru_by_uz[a['slug']] for a in ARTICLES], 'ru', 'maqolalar.html'))
    print(f'{n} ta maqola + 2 ta ro\'yxat sahifasi yaratildi')


if __name__ == '__main__':
    main()
