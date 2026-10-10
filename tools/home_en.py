# -*- coding: utf-8 -*-
"""Inglizcha bosh sahifa (en.html) uchun tarjimalar.

Sahifa matnining o'zi index.html dagi <span data-lang="en"> lardan olinadi — bu yerda faqat o'sha
spanlarga kirmagan narsalar: <head>, JSON-LD, atributlar (aria-label, alt) va inglizcha sahifada
kurs sahifalari o'rnini bosadigan "Courses in detail" bo'limi (faktlar o'zbekcha kurs sahifalaridan).
"""
from urllib.parse import quote

TITLE = "Kids' Coding, Robotics, Chess & Math Courses in Samarkand | Parvoz"
DESC = ('After-school courses for kids in Samarkand: programming, robotics, math, chess and English. '
        'Ages 6+, first lesson free. Dahbed St. 11, +998 97 234 44 42.')
OG_TITLE = 'Parvoz Learning Center — Learn. Build. Fly.'
OG_DESC = ('IT and brain-training courses for kids in Samarkand: programming, robotics, math, chess, '
           'English. First lesson free!')

ORG_DESC = ("Children's IT and intellectual learning center in Samarkand, Uzbekistan: programming, robotics, "
            'math, chess and English courses. Ages 6+, first lesson free.')
ADDRESS = {'streetAddress': 'Dahbed street, 11, 2nd floor', 'addressLocality': 'Samarkand',
           'addressRegion': 'Samarkand Region'}
AREA = {'Samarqand': 'Samarkand', 'Samarqand viloyati': 'Samarkand Region'}
CATALOG = 'Courses'

# O'zbekcha kurs sahifasi -> (en.html ichidagi bo'lim, katalogdagi nom)
COURSES = {
    'dasturlash-kurslari.html': ('#course-coding', 'Programming course for kids'),
    'robototexnika-kurslari.html': ('#course-robotics', 'Robotics course for kids'),
    'matematika-kurslari.html': ('#course-math', 'Math course for kids'),
    'shaxmat-kurslari.html': ('#course-chess', 'Chess course for kids'),
    'ingliz-tili-kurslari.html': ('#course-english', 'English course for kids'),
}

# Spanlarga kirmagan matnlar (atributlar, havola matni) — o'zbekcha -> inglizcha
ATTRS = [
    ('aria-label="Parvoz — bosh sahifa"', 'aria-label="Parvoz — home"'),
    ('aria-label="Asosiy menyu"', 'aria-label="Main menu"'),
    ('aria-label="Rejimni almashtirish"', 'aria-label="Toggle theme"'),
    ('aria-label="Menyuni ochish"', 'aria-label="Open menu"'),
    ('alt="Shaxmat darsi: ustoz namoyish taxtasida o\'quvchilarga yurishni ko\'rsatmoqda"', 'alt="Chess lesson: the teacher shows a move to students on a demonstration board"'),
    ('alt="Parvoz O\'quv Markazi binosi va kirish eshigi, Samarqand"', 'alt="Parvoz Learning Center building and entrance, Samarkand"'),
    ('alt="Robototexnika darsi: o\'quvchilar kompyuter va elektron sxemalar bilan ishlamoqda (video)"', 'alt="Robotics lesson: students work with computers and electronic circuits (video)"'),
    ('alt="Shaxmat darsi: o\'quvchilar shaxmat taxtalari oldida ustozni tinglamoqda"', 'alt="Chess lesson: students at chess boards listening to the teacher"'),
    ('alt="Parvoz markazi darslaridan lavhalar: o\'quvchilar kompyuterda ishlamoqda (video)"', 'alt="Highlights from Parvoz lessons: students working on computers (video)"'),
    ('alt="Shaxmat ustozi namoyish taxtasi yonida"', 'alt="Chess teacher next to the demonstration board"'),
    ('aria-label="Foto yoki video kattalashtirilgan ko\'rinishda"', 'aria-label="Photo or video, enlarged"'),
    ('aria-label="Yopish"', 'aria-label="Close"'),
    ('aria-label="Parvoz O\'quv Markazi"', 'aria-label="Parvoz Learning Center"'),
    ('aria-label="Qo\'ng\'iroq qilish"', 'aria-label="Call us"'),
    ('aria-label="Sahifa boshiga qaytish"', 'aria-label="Back to top"'),
    ("<span>© 2026 Parvoz O'quv Markazi · ", '<span>© 2026 Parvoz Learning Center · '),
    ('?text=Assalomu%20alaykum!%20Bepul%20sinov%20darsi%20haqida%20ma%27lumot%20olmoqchiman.',
     '?text=' + quote("Hello! I'd like to know more about the free trial lesson.", safe='!')),
]

LANG_BTNS = '''<div class="lang-btns" role="group" aria-label="Choose language">
      <a class="lang-btn" href="index.html" hreflang="uz" lang="uz" data-set-lang="uz">UZ</a>
      <a class="lang-btn" href="ru.html" hreflang="ru" lang="ru" data-set-lang="ru">RU</a>
      <button class="lang-btn active" data-set-lang="en" type="button">EN</button>
    </div>'''

# --- Kurslar haqida batafsil (o'zbekcha kurs sahifalaridagi faktlar) -------------------------------
DETAILS_EYEBROW = '🔎 Course details'
DETAILS_TITLE = 'What each course teaches'
DETAILS_SUB = ('Every course: ages 6+, 3 lessons a week (2 hours each), 300,000 UZS per month, '
               'all equipment provided, first lesson free.')
DETAILS = [
    ('course-coding', '💻', 'Programming', [
        'Your child moves from playing computer games to making them. Lessons are built around real projects, '
        'not memorized theory — students see their own result on screen from the very first lesson.',
        'Algorithmic thinking: breaking a big task into small steps.',
        'Games and animations in Scratch (block-based coding for younger students).',
        'Python basics: variables, conditions, loops, functions.',
        'Web basics: building a first web page with HTML and CSS.',
        'Project work: from idea to finished product, plus debugging skills.',
    ]),
    ('course-robotics', '🤖', 'Robotics', [
        'Students build robots with their own hands and program them — the full path from an idea to a working device.',
        'Construction and mechanics: gears, levers, stability.',
        'Sensors (distance, light, motion) and motors: precise control of speed and turns.',
        'Programming robots, starting with block-based coding and moving to real code.',
        'The engineering cycle: idea, prototype, test, fix, improve; teamwork and presenting a project.',
    ]),
    ('course-math', '🧮', 'Mathematics', [
        'Math as a way of thinking rather than a list of rules to memorize: students learn to reach the solution themselves.',
        'Mental arithmetic and fast calculation.',
        'Logic puzzles and non-standard problems.',
        'Geometry basics and spatial thinking.',
        'Olympiad strategies and strengthening the school curriculum.',
    ]),
    ('course-chess', '♟', 'Chess', [
        'Chess teaches a child to think ahead. The course starts from zero — no prior knowledge needed — and goes up to tournament games.',
        'Rules and piece movement; opening principles.',
        'Tactics and combinations; endgame technique.',
        'Evaluating a position and making a plan; tournament rules (playing with a clock, recording games).',
        'Weekly tournaments and competitions.',
    ]),
    ('course-english', '🗣️', 'English', [
        'Learning to speak, not to memorize rules: lessons are built on live conversation and play.',
        'Listening through audio, songs and video; everyday vocabulary (family, school, travel, food, technology).',
        'Grammar through games; correct pronunciation.',
        'IT vocabulary — a natural bridge to the programming and robotics courses.',
        'Explanations start in Uzbek or Russian and shift toward English as the level grows.',
    ]),
]

# --- Qo'shimcha savol-javoblar (faqat tasdiqlangan faktlar: llms.txt / markaz ma'lumotlari) -------
EXTRA_FAQ = [
    ('What is Parvoz Learning Center?',
     "Parvoz Learning Center (also known as Parvoz Code) is a children's IT and intellectual education "
     'center in Samarkand, Uzbekistan. It teaches programming, robotics, math, chess and English to children from age 6. '
     'The center was founded in 2025.'),
    ('Where is Parvoz Learning Center located?',
     'Dahbed street 11, 2nd floor, Samarkand, Uzbekistan (Russian: ул. Дагбитская, 11, 2 этаж). '
     'It is near the Gelion intersection, opposite Mone Café.'),
    ('What is the phone number and how can I contact the center?',
     'Phone: +998 97 234 44 42. You can also write on Telegram (@parvozcode) or Instagram (@parvoz_code), '
     'or use the enrollment form on this page.'),
    ('How much do the courses cost?',
     '300,000 UZS per month for any course, with no extra fees. Lessons are 3 days a week, 2 hours each.'),
    ('What are the group times and opening hours?',
     'Groups meet in the morning (10:00–12:00), afternoon (13:00–15:00) or evening (16:00–18:00). '
     'The center is open Monday to Saturday, 09:00–18:00; closed on Sunday.'),
    ('In what language are the lessons taught?',
     'In Uzbek and Russian. In the English course, explanations start in Uzbek or Russian and shift toward English as the level grows.'),
    ('Is Parvoz Code the same as Parvoz Learning Center?',
     'Yes, it is one center. The official name is Parvoz Learning Center; on maps and social media it also appears as Parvoz Code. Website: parvozcode.uz.'),
    ('Are there scholarships or free places?',
     'Yes, a scholarship (free study) is available for talented students. Ask for details at +998 97 234 44 42.'),
    ('Does the center hold open lessons and tournaments?',
     'Yes, regularly. Dates are announced in advance on Telegram (@parvozcode) and Instagram (@parvoz_code).'),
]
