# -*- coding: utf-8 -*-
"""llms-full.txt — saytning asosiy mazmuni bitta matn faylda (AI assistentlar uchun).

    python3 tools/gen_llms_full.py

llms.txt — qisqa xarita; llms-full.txt — shu xaritadagi sahifalarning to'liq matni. Matn sahifalarning
<main> qismidan olinadi, shuning uchun sayt bilan bir xil bo'ladi: faktni faqat sahifada o'zgartiring,
so'ng generatorni qayta ishga tushiring. Manba tartibi: markaz faktlari (llms.txt) -> o'zbekcha
kurs va maqolalar -> ruscha kurs va maqolalar.
"""
import datetime
import html
import pathlib
import re
import sys
import zoneinfo
from html.parser import HTMLParser

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from articles import ARTICLES        # noqa: E402
from articles_ru import ARTICLES_RU  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://parvozcode.uz/'

UZ_COURSES = ['dasturlash-kurslari', 'robototexnika-kurslari', 'matematika-kurslari',
              'shaxmat-kurslari', 'ingliz-tili-kurslari']
RU_COURSES = ['kursy-programmirovaniya', 'robototehnika', 'matematika', 'shahmaty', 'angliyskiy']

SKIP_CLASS = ('faq-plus', 'crumbs', 'art-cta', 'art-back', 'cta-row', 'doc-date', 'lang-switch')


class Md(HTMLParser):
    """<main> ichidagi matnni oddiy markdown'ga aylantiradi."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.stack, self.skip = [], [], 0
        self.href = None
        self.cell = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class', '') or ''
        hide = tag in ('script', 'style', 'svg', 'nav') or any(c in cls.split() for c in SKIP_CLASS)
        self.stack.append((tag, hide))
        if hide:
            self.skip += 1
            return
        if self.skip:
            return
        if tag in ('h1', 'h2', 'h3'):
            self.out.append('\n\n' + '#' * {'h1': 1, 'h2': 2, 'h3': 3}[tag] + ' ')
        elif tag == 'div' and 'info-row' in cls.split():
            self.out.append('\n- ')
        elif tag in ('p', 'div', 'section', 'article', 'ul', 'ol'):
            self.out.append('\n')
        elif tag == 'li':
            self.out.append('\n- ')
        elif tag == 'div' and 'info-row' in cls.split():
            self.out.append('\n- ')
        elif tag == 'span' and 'v' in cls.split():
            self.out.append(': ')
        elif tag == 'tr':
            self.out.append('\n- ')
            self.cell = 0
        elif tag in ('td', 'th'):
            self.out.append(': ' if self.cell else '')
            self.cell += 1
        elif tag == 'button':
            self.out.append('\n\n**Savol / Question:** ')
        elif tag in ('strong', 'b'):
            self.out.append('**')
        elif tag == 'br':
            self.out.append(' ')
        elif tag == 'a':
            self.href = a.get('href')

    def handle_endtag(self, tag):
        while self.stack:
            t, hide = self.stack.pop()
            if hide:
                self.skip -= 1
            if t == tag:
                if not hide and not self.skip:
                    if tag in ('strong', 'b'):
                        self.out.append('**')
                    elif tag in ('p', 'h1', 'h2', 'h3'):
                        self.out.append('\n')
                    elif tag == 'a':
                        self.href = None
                break

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(re.sub(r'\s+', ' ', data))

    def text(self):
        t = ''.join(self.out)
        t = re.sub(r'\*\*\s*\*\*', '', t)
        t = re.sub(r'[ \t]+\n', '\n', t)
        t = re.sub(r'\n[ \t]+', '\n', t)
        t = re.sub(r'\n{3,}', '\n\n', t)
        return t.strip()


def page_text(slug):
    src = (ROOT / f'{slug}.html').read_text()
    m = re.search(r'<main id="main">(.*?)</main>', src, re.S)
    if not m:
        raise SystemExit(f'{slug}.html: <main> topilmadi')
    p = Md()
    p.feed(m.group(1))
    title = html.unescape(re.search(r'<title>(.*?)</title>', src, re.S).group(1)).strip()
    return title, p.text()


def facts():
    """llms.txt dagi 'Asosiy ma'lumotlar' bloki — markaz faktlarining yagona manbai."""
    t = (ROOT / 'llms.txt').read_text()
    head = t[:t.index('## Kurslar')].rstrip()
    return head


def section(heading, slugs):
    out = [f'\n\n---\n\n# {heading}\n']
    for s in slugs:
        title, text = page_text(s)
        out.append(f'\n\n## {title}\n\nManba / Source: {BASE}{s}.html\n\n{text}\n')
    return ''.join(out)


def main():
    today = datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Samarkand')).date().isoformat()
    parts = [facts(),
             f'\n\n> Bu fayl llms.txt ning to\'liq varianti: har bir sahifaning matni. Yangilangan: {today}. '
             f'Qisqa xarita: {BASE}llms.txt'
             f'\n> This is the full-text companion of llms.txt: the content of every page. Updated: {today}.']
    parts.append(section("Kurslar va maqolalar (o'zbekcha)",
                         UZ_COURSES + [a['slug'] for a in ARTICLES]))
    parts.append(section('Курсы и статьи (на русском)',
                         RU_COURSES + [a['slug'] for a in ARTICLES_RU]))
    text = ''.join(parts).rstrip() + '\n'
    if '<' in re.sub(r'<https?://[^>]+>', '', text) and re.search(r'</?(div|span|p|li)\b', text):
        raise SystemExit('llms-full.txt: HTML teglari qolgan')
    (ROOT / 'llms-full.txt').write_text(text)
    print(f'llms-full.txt: {len(text):,} belgi')


if __name__ == '__main__':
    main()
