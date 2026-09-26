/* Ariza formasi — ma'lumot Supabase edge funksiyasiga yuboriladi. */
(function () {
  var form = document.getElementById('leadForm');
  if (!form) return;
  var C = window.PARVOZ_CONFIG || {};
  var msg = document.getElementById('leadMsg');
  var btn = document.getElementById('leadBtn');
  var box = document.getElementById('leadBox');

  /* --- Tilga mos variantlar --- */
  var L = {
    uz: {
      course: ["Yo'nalishni tanlang", 'Dasturlash', 'Robototexnika', 'Matematika', 'Shaxmat', 'Ingliz tili', 'Hali tanlamadim'],
      time: ['Qulay vaqt', 'Ertalab (10:00–12:00)', 'Tushdan keyin (13:00–15:00)', 'Kechqurun (16:00–18:00)', 'Farqi yo`q'],
      note: 'Bolaning yoshi, savollaringiz...',
      sending: 'Yuborilmoqda...',
    },
    ru: {
      course: ['Выберите направление', 'Программирование', 'Робототехника', 'Математика', 'Шахматы', 'Английский язык', 'Ещё не выбрал(а)'],
      time: ['Удобное время', 'Утро (10:00–12:00)', 'День (13:00–15:00)', 'Вечер (16:00–18:00)', 'Не важно'],
      note: 'Возраст ребёнка, ваши вопросы...',
      sending: 'Отправка...',
    },
    en: {
      course: ['Choose a course', 'Programming', 'Robotics', 'Mathematics', 'Chess', 'English', 'Not decided yet'],
      time: ['Preferred time', 'Morning (10:00–12:00)', 'Afternoon (13:00–15:00)', 'Evening (16:00–18:00)', 'Either works'],
      note: "Child's age, your questions...",
      sending: 'Sending...',
    },
  };
  // Kurs qiymatlari bazadagi nomlar bilan mos bo'lishi kerak
  var COURSE_VALUES = ['', 'Dasturlash', 'Robototexnika', 'Matematika', 'Shaxmat', 'Ingliz tili', ''];
  var TIME_VALUES = ['', 'Ertalab (10:00-12:00)', 'Tushdan keyin (13:00-15:00)', 'Kechqurun (16:00-18:00)', 'Farqi yo`q'];

  function fill(sel, labels, values) {
    sel.innerHTML = labels.map(function (t, i) {
      return '<option value="' + (values[i] || '') + '">' + t + '</option>';
    }).join('');
  }

  function applyLang() {
    var lang = document.documentElement.lang;
    var d = L[lang] || L.uz;
    fill(document.getElementById('leadCourse'), d.course, COURSE_VALUES);
    fill(document.getElementById('leadTime'), d.time, TIME_VALUES);
    document.getElementById('leadNote').placeholder = d.note;
  }
  applyLang();
  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(applyLang, 0); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'f-msg';

    var payload = {
      full_name: form.elements.full_name.value.trim(),
      phone: form.elements.phone.value.trim(),
      course_name: form.elements.course_name.value,
      preferred_time: form.elements.preferred_time.value,
      note: form.elements.note.value.trim(),
      website: form.elements.website.value,      // honeypot
      page: location.pathname + location.hash,
      source: 'website',
    };

    if (payload.full_name.length < 2) {
      msg.textContent = "Ismingizni to'liq kiriting";
      msg.className = 'f-msg bad';
      return;
    }
    if (payload.phone.replace(/\D/g, '').length < 9) {
      msg.textContent = "Telefon raqamini to'g'ri kiriting";
      msg.className = 'f-msg bad';
      return;
    }

    btn.disabled = true;
    var oldText = btn.innerHTML;
    btn.innerHTML = (L[document.documentElement.lang] || L.uz).sending;

    fetch(C.SUPABASE_URL + '/functions/v1/submit-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Xatolik yuz berdi');
        if (window.parvozTrack) {
          window.parvozTrack('Lead', { course: payload.course_name || 'aniqlanmagan' });
        }
        box.innerHTML =
          '<div class="f-done"><div class="fd-ico">🎉</div>' +
          '<b>Arizangiz qabul qilindi!</b>' +
          '<p>Tez orada qo\'ng\'iroq qilamiz va bepul sinov darsining vaqtini kelishib olamiz.</p></div>';
      })
      .catch(function (err) {
        msg.textContent = err.message + ' — yoki bevosita qo\'ng\'iroq qiling: ' + (C.PHONE || '');
        msg.className = 'f-msg bad';
        btn.disabled = false;
        btn.innerHTML = oldText;
      });
  });
})();
