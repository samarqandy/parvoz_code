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

# Yandex Metrika hisoblagichi ham o'sha sahifadan olinadi — ID bir joyda turadi.
METRIKA = SRC[SRC.index('<!-- Yandex.Metrika counter -->'):SRC.index('</head>')].strip()

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
    # Kurs sahifalariga havolalar — ruscha sahifalardan ruscha kurs sahifalariga
    ('href="dasturlash-kurslari.html"', 'href="kursy-programmirovaniya.html"'),
    ('href="robototexnika-kurslari.html"', 'href="robototehnika.html"'),
    ('href="matematika-kurslari.html"', 'href="matematika.html"'),
    ('href="shaxmat-kurslari.html"', 'href="shahmaty.html"'),
    ('href="ingliz-tili-kurslari.html"', 'href="angliyskiy.html"'),
    # Bosh sahifa — ruscha sahifalardan ruscha bosh sahifaga (index.html#kurslar -> ru.html#kurslar)
    ('href="index.html', 'href="ru.html'),
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
        'other': 'Читать по-русски', 'other_lang': 'ru',
        'index_h': 'Ota-onalar uchun maqolalar',
        'index_lede': "Bolani kursga berishdan oldin eng ko'p beriladigan savollar — va ularga aniq javoblar. Reklama emas, amaliy maslahat.",
        'index_desc': ("Bolani kursga berishdan oldin ota-onalar eng ko'p beradigan savollarga aniq javoblar: "
                       "yosh, narx, qaysi yo'nalish va nimaga e'tibor berish kerak."),
        'index_title': "Ota-onalar uchun maqolalar | Parvoz O'quv Markazi",
        'more': "O'qish →",
        'ask_h': 'Savolingizga javob topmadingizmi?',
        'ask_p': "Qo'ng'iroq qiling yoki Telegramda yozing — javob beramiz.",
        'lang': 'uz', 'locale': 'uz_UZ',
        'home_href': 'index.html', 'home_url': BASE,
    },
    'ru': {
        'home': 'Главная', 'articles': 'Статьи', 'crumbs': 'Навигационная цепочка',
        'updated': 'Обновлено', 'faq': 'Частые вопросы',
        'cta_h': 'Приведите ребёнка на бесплатный пробный урок',
        'cta_p': 'Первый урок полностью бесплатный, без предоплаты. Если ребёнок не захочет возвращаться — никаких обязательств.',
        'cta_btn': '🎁 Записаться на бесплатный урок',
        'back': '← Все статьи',
        'other': "O'zbekcha o'qish", 'other_lang': 'uz',
        'index_h': 'Статьи для родителей',
        'index_lede': 'Вопросы, которые чаще всего задают перед выбором курса — и конкретные ответы на них. Не реклама, а практический совет.',
        'index_desc': ('Конкретные ответы на вопросы, которые родители задают перед записью ребёнка на курсы: '
                       'возраст, стоимость, выбор направления и на что обращать внимание.'),
        'index_title': 'Статьи для родителей | Учебный центр Parvoz',
        'more': 'Читать →',
        'ask_h': 'Не нашли ответ на свой вопрос?',
        'ask_p': 'Позвоните или напишите в Telegram — ответим.',
        'lang': 'ru', 'locale': 'ru_RU',
        'home_href': 'ru.html', 'home_url': BASE + 'ru.html',
    },
}

# Bosh sahifadagi tashkilot tuguni bilan bir xil @id — qidiruv tizimlari 30 ta nomsiz
# "tashkilot" emas, bitta markazni ko'rsin (SEO_AUDIT §14)
ORG = {"@type": "EducationalOrganization", "@id": BASE + "#organization",
       "name": "Parvoz O'quv Markazi", "url": BASE, "logo": BASE + "assets/icon-512.png"}
WEBSITE = {"@type": "WebSite", "@id": BASE + "#website", "name": "Parvoz O'quv Markazi", "url": BASE}


def esc(t):
    return html.escape(t, quote=True)


# Til havolalaridagi bayroqlar. Emoji bayroq (🇷🇺, 🇺🇿) Windows'da bayroq emas, "RU"/"UZ"
# harflari bo'lib chiqadi — shuning uchun SVG. id/clipPath yo'q: sahifada bir necha nusxa bo'lsa
# ham to'qnashmaydi. gen_courses_ru.py ham ishlatadi; maxfiylik.html da qo'lda qo'yilgan.
FLAG = {
    'ru': ('<svg class="flag flag-ru" viewBox="0 0 9 6" aria-hidden="true" focusable="false">'
           '<path fill="#fff" d="M0 0h9v2H0z"/><path fill="#0039a6" d="M0 2h9v2H0z"/>'
           '<path fill="#d52b1e" d="M0 4h9v2H0z"/></svg>'),
    # 1:2; ko'k, oq, yashil yo'llar orasida qizil hoshiya; yarim oy va 12 yulduz (3/4/5 qator)
    'uz': ('<svg class="flag flag-uz" viewBox="0 0 500 250" aria-hidden="true" focusable="false">'
           '<path fill="#1eb53a" d="M0 0h500v250H0z"/><path fill="#0099b5" d="M0 0h500v125H0z"/>'
           '<path fill="#ce1126" d="M0 80h500v90H0z"/><path fill="#fff" d="M0 85h500v80H0z"/>'
           '<circle cx="70" cy="40" r="30" fill="#fff"/><circle cx="80" cy="40" r="30" fill="#0099b5"/>'
           '<path fill="#fff" d="M136.00 10.00L137.35 14.15L141.71 14.15L138.18 16.71L139.53 20.85L136.00 18.29L132.47 20.85L133.82 16.71L130.29 14.15L134.65 14.15ZM160.00 10.00L161.35 14.15L165.71 14.15L162.18 16.71L163.53 20.85L160.00 18.29L156.47 20.85L157.82 16.71L154.29 14.15L158.65 14.15ZM184.00 10.00L185.35 14.15L189.71 14.15L186.18 16.71L187.53 20.85L184.00 18.29L180.47 20.85L181.82 16.71L178.29 14.15L182.65 14.15ZM112.00 34.00L113.35 38.15L117.71 38.15L114.18 40.71L115.53 44.85L112.00 42.29L108.47 44.85L109.82 40.71L106.29 38.15L110.65 38.15ZM136.00 34.00L137.35 38.15L141.71 38.15L138.18 40.71L139.53 44.85L136.00 42.29L132.47 44.85L133.82 40.71L130.29 38.15L134.65 38.15ZM160.00 34.00L161.35 38.15L165.71 38.15L162.18 40.71L163.53 44.85L160.00 42.29L156.47 44.85L157.82 40.71L154.29 38.15L158.65 38.15ZM184.00 34.00L185.35 38.15L189.71 38.15L186.18 40.71L187.53 44.85L184.00 42.29L180.47 44.85L181.82 40.71L178.29 38.15L182.65 38.15ZM88.00 58.00L89.35 62.15L93.71 62.15L90.18 64.71L91.53 68.85L88.00 66.29L84.47 68.85L85.82 64.71L82.29 62.15L86.65 62.15ZM112.00 58.00L113.35 62.15L117.71 62.15L114.18 64.71L115.53 68.85L112.00 66.29L108.47 68.85L109.82 64.71L106.29 62.15L110.65 62.15ZM136.00 58.00L137.35 62.15L141.71 62.15L138.18 64.71L139.53 68.85L136.00 66.29L132.47 68.85L133.82 64.71L130.29 62.15L134.65 62.15ZM160.00 58.00L161.35 62.15L165.71 62.15L162.18 64.71L163.53 68.85L160.00 66.29L156.47 68.85L157.82 64.71L154.29 62.15L158.65 62.15ZM184.00 58.00L185.35 62.15L189.71 62.15L186.18 64.71L187.53 68.85L184.00 66.29L180.47 68.85L181.82 64.71L178.29 62.15L182.65 62.15Z"/></svg>'),
}


# <head> dagi til skripti (gen_courses_ru.py ham ishlatadi)
LANG_BOOT = {
    'ru': "\n<script>\ntry { localStorage.setItem('parvoz-lang', 'ru'); } catch (e) {}\n</script>",
    'uz': ("\n<script>\ntry { if (localStorage.getItem('parvoz-lang') === 'ru') "
           "localStorage.setItem('parvoz-lang', 'uz'); } catch (e) {}\n</script>"),
}


# Footer'da ikki qator bor: o'zbekcha va ruscha maqolalar. Ruscha almashtirishdan keyin
# ikkalasi ham "Статьи для родителей → stati.html" bo'lib qoladi — o'zbekcha qatorni tiklaymiz
RU_HUB = '<li><a href="stati.html">Статьи для родителей</a></li>'
UZ_HUB = '<li><a href="maqolalar.html" lang="uz">Ota-onalar uchun maqolalar</a></li>'


def to_ru(text):
    """Sayt qobig'idagi matnlarni ruschaga o'giradi (gen_courses_ru.py ham ishlatadi)."""
    for a, b in CHROME_RU:
        text = text.replace(a, b)
    if '<footer>' in text:
        dup = re.search(re.escape(RU_HUB) + r'(\s*)' + re.escape(RU_HUB), text)
        if not dup:
            raise SystemExit("Footer'dagi maqolalar qatorlari kutilgan ko'rinishda emas")
        text = text[:dup.start()] + RU_HUB + dup.group(1) + UZ_HUB + text[dup.end():]
    return text


def lang_link(u, href):
    """Boshqa tildagi nusxaga havola — bayroq bilan."""
    o = u['other_lang']
    return f'<a class="art-lang" href="{href}" hreflang="{o}" lang="{o}">{FLAG[o]}{esc(u["other"])}</a>'


def chrome(lang):
    top, bottom = TOP, BOTTOM
    if lang == 'ru':
        top, bottom = to_ru(top), to_ru(bottom)
    return top, bottom


def index_slug(lang):
    return 'maqolalar.html' if lang == 'uz' else 'stati.html'


def head(*, lang, title, desc, url, alt_url, page_type='article', ld=''):
    """Ikkala tildagi sahifa uchun umumiy <head>."""
    u = UI[lang]
    uz_url, ru_url = (url, alt_url) if lang == 'uz' else (alt_url, url)

    # Til tanlovi: oxirgi ko'rilgan sahifa tili. index.html ruscha tanlovni ko'rsa, odamni
    # ru.html ga o'tkazadi — shuning uchun o'zbekcha sahifa ruscha tanlovni o'zbekchaga
    # almashtiradi (inglizchaga tegmaydi: inglizcha faqat index.html da bor).
    lang_boot = LANG_BOOT[lang]

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
</script>{lang_boot}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/config.js"></script>
<script src="assets/analytics.js" defer></script>

{METRIKA}

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
            "image": BASE + "assets/preview.jpg",
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
                {"@type": "ListItem", "position": 1, "name": u['home'], "item": u['home_url']},
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
      <a href="{u['home_href']}">{esc(u['home'])}</a> <span>&rsaquo;</span>
      <a href="{index_slug(lang)}">{esc(u['articles'])}</a> <span>&rsaquo;</span>
      <span>{esc(a['h1'][:38])}…</span>
    </nav>

    <h1>{esc(a['h1'])}</h1>
    <p class="doc-date">{esc(u['updated'])}: {date} · {lang_link(u, alt_slug + '.html')}</p>

    <p class="art-lede">{a['lede']}</p>
{body_html}

    <h2>{esc(u['faq'])}</h2>
    <div class="faq-list">{faq_html}
    </div>

    <div class="art-cta">
      <h3>{esc(u['cta_h'])}</h3>
      <p>{esc(u['cta_p'])}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="{u['home_href']}#yozilish">{esc(u['cta_btn'])}</a>
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
             "isPartOf": WEBSITE},
            {"@type": "ItemList",
             "itemListElement": [
                 {"@type": "ListItem", "position": i + 1,
                  "url": BASE + a['slug'] + '.html', "name": a['h1']}
                 for i, a in enumerate(items)]},
            {"@type": "BreadcrumbList",
             "itemListElement": [
                 {"@type": "ListItem", "position": 1, "name": u['home'], "item": u['home_url']},
                 {"@type": "ListItem", "position": 2, "name": u['articles']}]},
        ],
    }, ensure_ascii=False, indent=2)

    return head(lang=lang, title=u['index_title'], desc=u['index_desc'], url=url,
                alt_url=alt_url, page_type='website', ld=ld) + f'''{top}<main id="main">
<div class="wrap">
  <div class="doc art">
    <nav class="crumbs" aria-label="{esc(u['crumbs'])}">
      <a href="{u['home_href']}">{esc(u['home'])}</a> <span>&rsaquo;</span>
      <span>{esc(u['articles'])}</span>
    </nav>

    <h1>{esc(u['index_h'])}</h1>
    <p class="doc-date">{lang_link(u, alt_slug)}</p>
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

    # Sitemap sanalari ham shu yerda yangilanadi — qo'lda esdan chiqib qolmasin
    import sitemap_lastmod  # noqa: E402
    sitemap_lastmod.main()


if __name__ == '__main__':
    main()
