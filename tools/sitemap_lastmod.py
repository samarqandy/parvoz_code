# -*- coding: utf-8 -*-
"""sitemap.xml dagi <lastmod> sanalarini fayllarning haqiqiy o'zgarish sanasiga moslaydi.

Qo'lda yangilash esdan chiqib, sanalar eskirib qolardi (SEO_AUDIT §4).

    python3 tools/sitemap_lastmod.py

Sana qoidasi: fayl commit qilinmagan o'zgarishga ega bo'lsa — bugun (Samarqand vaqti),
aks holda — git'dagi oxirgi commit sanasi. Commit qilishdan oldin ishga tushiring.
gen_articles.py oxirida o'zi chaqiradi.
"""
import datetime
import pathlib
import re
import subprocess
import zoneinfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://parvozcode.uz/'


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def file_date(rel, dirty, today):
    if rel in dirty:
        return today
    out = git('log', '-1', '--format=%cs', '--', rel).strip()
    return out or today


def main():
    today = datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Samarkand')).date().isoformat()
    dirty = {line[3:].strip() for line in git('status', '--porcelain').splitlines() if line.strip()}
    path = ROOT / 'sitemap.xml'
    xml = path.read_text()
    changed = []

    # Har bir <url> bloki alohida: ikki tilli sahifalarda <loc> bilan <lastmod> orasida
    # hreflang (<xhtml:link>) qatorlari turadi
    def fix(m):
        block = m.group(0)
        loc = re.search(r'<loc>([^<]+)</loc>', block).group(1)
        old = re.search(r'<lastmod>([^<]+)</lastmod>', block)
        if not old:
            raise SystemExit(f'<lastmod> yo\'q: {loc}')
        rel = 'index.html' if loc == BASE else loc[len(BASE):]
        if not (ROOT / rel).exists():
            raise SystemExit(f'sitemap.xml da mavjud bo\'lmagan fayl: {rel}')
        new = file_date(rel, dirty, today)
        if new != old.group(1):
            changed.append(f'{rel}: {old.group(1)} -> {new}')
        return block.replace(old.group(0), f'<lastmod>{new}</lastmod>')

    xml = re.sub(r'<url>.*?</url>', fix, xml, flags=re.S)
    if xml.count('<url>') != len(re.findall(r'<lastmod>', xml)):
        raise SystemExit("Har bir <url> da bitta <lastmod> bo'lishi kerak")
    path.write_text(xml)
    print('\n'.join(changed) if changed else 'sitemap.xml: sanalar joyida')


if __name__ == '__main__':
    main()
