# -*- coding: utf-8 -*-
"""Ruscha bosh sahifa (ru.html) uchun tarjimalar.

Sahifa matnining o'zi index.html dagi <span data-lang="ru"> lardan olinadi — bu yerda
faqat o'sha spanlarga kirmagan narsalar: <head>, JSON-LD va atributlar (aria-label, alt).
"""
from urllib.parse import quote

TITLE = 'IT-курсы для детей в Самарканде — учебный центр Parvoz'
DESC = ('Курсы для детей в Самарканде: программирование, робототехника, математика, шахматы '
        'и английский язык. Первый урок бесплатно, принимаем с 6 лет.')
OG_TITLE = 'Учебный центр Parvoz — Learn. Build. Fly.'
OG_DESC = ('IT-курсы для детей в Самарканде: программирование, робототехника, математика, '
           'шахматы, английский. Первый урок бесплатно!')

# Tashkilot tuguni (index.html dagi o'zbekcha tavsifning tarjimasi)
ORG_DESC = ('IT и интеллектуальный учебный центр для детей в Самарканде: курсы программирования, '
            'робототехники, математики, шахмат и английского языка. Принимаем с 6 лет, '
            'первый урок бесплатно.')
ADDRESS = {'streetAddress': 'ул. Дагбитская, 11', 'addressLocality': 'Самарканд',
           'addressRegion': 'Самаркандская область'}
AREA = {'Samarqand': 'Самарканд', 'Samarqand viloyati': 'Самаркандская область'}
CATALOG = 'Курсы'
# O'zbekcha kurs sahifasi -> (ruscha sahifa, katalogdagi nom)
COURSES = {
    'dasturlash-kurslari.html': ('kursy-programmirovaniya.html', 'Курс программирования (для детей)'),
    'robototexnika-kurslari.html': ('robototehnika.html', 'Курс робототехники (для детей)'),
    'matematika-kurslari.html': ('matematika.html', 'Курс математики (для детей)'),
    'shaxmat-kurslari.html': ('shahmaty.html', 'Курс шахмат (для детей)'),
    'ingliz-tili-kurslari.html': ('angliyskiy.html', 'Курс английского языка (для детей)'),
}

# Spanlarga kirmagan matnlar (atributlar, havola matni) — o'zbekcha -> ruscha
ATTRS = [
    ('aria-label="Parvoz — bosh sahifa"', 'aria-label="Parvoz — главная"'),
    ('aria-label="Asosiy menyu"', 'aria-label="Основное меню"'),
    ('aria-label="Rejimni almashtirish"', 'aria-label="Переключить тему"'),
    ('aria-label="Menyuni ochish"', 'aria-label="Открыть меню"'),
    ('alt="Markazdagi hayot — foto tez orada"', 'alt="Жизнь в центре — фото скоро"'),
    ('alt="Dasturlash darsi — foto tez orada"', 'alt="Урок программирования — фото скоро"'),
    ('alt="Robototexnika darsi — foto tez orada"', 'alt="Урок робототехники — фото скоро"'),
    ('alt="Shaxmat turniri — foto tez orada"', 'alt="Шахматный турнир — фото скоро"'),
    ('aria-label="Foto kattalashtirilgan ko\'rinishda"', 'aria-label="Фото в увеличенном виде"'),
    ('aria-label="Yopish"', 'aria-label="Закрыть"'),
    ('aria-label="Parvoz O\'quv Markazi"', 'aria-label="Учебный центр Parvoz"'),
    ('aria-label="Qo\'ng\'iroq qilish"', 'aria-label="Позвонить"'),
    ('aria-label="Sahifa boshiga qaytish"', 'aria-label="Наверх"'),
    ("<span>© 2026 Parvoz O'quv Markazi · ", '<span>© 2026 Учебный центр Parvoz · '),
    # WhatsApp'dagi tayyor xabar
    ('?text=Assalomu%20alaykum!%20Bepul%20sinov%20darsi%20haqida%20ma%27lumot%20olmoqchiman.',
     '?text=' + quote('Здравствуйте! Хочу узнать о бесплатном пробном уроке.', safe='!')),
]

# Til almashtirgich: ruscha sahifada UZ va EN — index.html ga havola, RU — shu sahifa
LANG_BTNS = '''<div class="lang-btns" role="group" aria-label="Выбор языка">
      <a class="lang-btn" href="index.html" hreflang="uz" lang="uz" data-set-lang="uz">UZ</a>
      <button class="lang-btn active" data-set-lang="ru" type="button">RU</button>
      <a class="lang-btn" href="index.html" lang="en" data-set-lang="en">EN</a>
    </div>'''
