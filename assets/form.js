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
      errName: "Ismingizni to'liq kiriting",
      errPhone: "Telefon raqamini to'g'ri kiriting",
      errConsent: "Davom etish uchun maxfiylik siyosatiga rozilik belgisini qo'ying",
      doneT: 'Arizangiz qabul qilindi!',
      doneP: "Tez orada qo'ng'iroq qilamiz va bepul sinov darsining vaqtini kelishib olamiz.",
      orCall: " — yoki bevosita qo'ng'iroq qiling: ",
      fail: "Arizani yuborib bo'lmadi",
    },
    ru: {
      course: ['Выберите направление', 'Программирование', 'Робототехника', 'Математика', 'Шахматы', 'Английский язык', 'Ещё не выбрал(а)'],
      time: ['Удобное время', 'Утро (10:00–12:00)', 'День (13:00–15:00)', 'Вечер (16:00–18:00)', 'Не важно'],
      note: 'Возраст ребёнка, ваши вопросы...',
      sending: 'Отправка...',
      errName: 'Введите имя полностью',
      errPhone: 'Введите правильный номер телефона',
      errConsent: 'Чтобы продолжить, отметьте согласие с политикой конфиденциальности',
      doneT: 'Заявка принята!',
      doneP: 'Скоро перезвоним и договоримся о времени бесплатного пробного урока.',
      orCall: ' — или позвоните нам: ',
      fail: 'Не удалось отправить заявку',
    },
    en: {
      course: ['Choose a course', 'Programming', 'Robotics', 'Mathematics', 'Chess', 'English', 'Not decided yet'],
      time: ['Preferred time', 'Morning (10:00–12:00)', 'Afternoon (13:00–15:00)', 'Evening (16:00–18:00)', 'Either works'],
      note: "Child's age, your questions...",
      sending: 'Sending...',
      errName: 'Please enter your full name',
      errPhone: 'Please enter a valid phone number',
      errConsent: 'Please tick the privacy policy consent to continue',
      doneT: 'Request received!',
      doneP: "We'll call you soon to arrange a time for the free trial lesson.",
      orCall: ' — or call us: ',
      fail: 'Could not send the request',
    },
  };
  var T = function () { return L[document.documentElement.lang] || L.uz; };
  // Kurs qiymatlari bazadagi nomlar bilan mos bo'lishi kerak
  var COURSE_VALUES = ['', 'Dasturlash', 'Robototexnika', 'Matematika', 'Shaxmat', 'Ingliz tili', ''];
  var TIME_VALUES = ['', 'Ertalab (10:00-12:00)', 'Tushdan keyin (13:00-15:00)', 'Kechqurun (16:00-18:00)', 'Farqi yo`q'];

  function fill(sel, labels, values) {
    sel.innerHTML = labels.map(function (t, i) {
      return '<option value="' + (values[i] || '') + '">' + t + '</option>';
    }).join('');
  }

  function applyLang() {
    var d = T();
    // Ariza yuborilgandan keyin forma yo'q — tasdiq matnini yangi tilda qayta chizamiz
    if (box.querySelector('.f-done')) { showDone(false); return; }
    ['leadCourse', 'leadTime'].forEach(function (id, k) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var i = sel.selectedIndex;                     // til almashganda tanlov saqlanadi
      fill(sel, k ? d.time : d.course, k ? TIME_VALUES : COURSE_VALUES);
      if (i > 0) sel.selectedIndex = i;
    });
    var note = document.getElementById('leadNote');
    if (note) note.placeholder = d.note;
  }

  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Muvaffaqiyat: forma o'rnida tasdiq. Telefonda sahifa qisqarib, tasdiq ekrandan
  // yuqorida qolib ketardi — uni ko'rinadigan joyga olib kelamiz va fokuslaymiz
  function showDone(focus) {
    box.innerHTML =
      '<div class="f-done" role="status" tabindex="-1"><div class="fd-ico" aria-hidden="true">🎉</div>' +
      '<b>' + T().doneT + '</b><p>' + T().doneP + '</p></div>';
    if (!focus) return;
    var done = box.querySelector('.f-done');
    done.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    done.focus({ preventScroll: true });
  }

  // Xato: matn e'lon qilinadi (role=alert), maydon belgilanadi va fokuslanadi,
  // xabar pastki yopishqoq tugma ostida qolmaydi
  function showErr(text, field) {
    msg.textContent = text;
    msg.className = 'f-msg bad';
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus({ preventScroll: true }); }
    msg.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  applyLang();
  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(applyLang, 0); });
  });

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
  });
  form.addEventListener('change', function (e) {
    if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    msg.textContent = '';
    msg.className = 'f-msg';
    var consent = form.querySelector('.f-consent input');

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

    if (payload.full_name.length < 2) return showErr(T().errName, form.elements.full_name);
    if (payload.phone.replace(/\D/g, '').length < 9) return showErr(T().errPhone, form.elements.phone);
    // Rozilik belgisi majburiy (forma novalidate — brauzer o'zi tekshirmaydi)
    if (consent && !consent.checked) return showErr(T().errConsent, consent);

    btn.disabled = true;
    var oldText = btn.innerHTML;
    btn.innerHTML = T().sending;

    fetch(C.SUPABASE_URL + '/functions/v1/submit-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      // HTML xato sahifasi (502) yoki uzilgan javob — JSON emas: umumiy xabarga tushadi
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          var er = new Error(res.d.error || '');
          er.status = res.status;
          throw er;
        }
        if (window.parvozTrack) {
          window.parvozTrack('Lead', { course: payload.course_name || 'aniqlanmagan' });
        }
        showDone(true);
      })
      .catch(function (err) {
        // Server matni o'zbekcha va faqat foydalanuvchiga tegishli xatolarda (400, 429) mazmunli;
        // tarmoq/baza xatolarining texnik matni ko'rsatilmaydi
        var own = (err.status === 400 || err.status === 429) && err.message && document.documentElement.lang === 'uz';
        showErr((own ? err.message : T().fail) + T().orCall + (C.PHONE || ''));
        btn.disabled = false;
        btn.innerHTML = oldText;
      });
  });
})();
