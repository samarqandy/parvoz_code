/* ============================================================
   PARVOZ DAVOMAT — o'qituvchi/administrator paneli
   ============================================================ */
const SUPABASE_URL = 'https://pthqtdcbphqixeuqkgwa.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aHF0ZGNicGhxaXhldXFrZ3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDM4ODgsImV4cCI6MjEwNTQ3OTg4OH0.S0gqEi-dwcfLlkgiB44xZj64KtpLoCDVOz66P3SD3TY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
sb.auth.onAuthStateChange((_e, s) => { if (s) state.session = s; });

/* ---------------- Holat ---------------- */
const state = {
  session: null,
  me: null,            // { email, role, full_name, course_ids }
  courses: [],
  students: [],
  today: [],          // tanlangan kundagi yozuvlar
  day: null,          // YYYY-MM-DD — null bo'lsa bugun
  loadedDay: null,    // state.today qaysi kun uchun yuklangan (yarim tundan keyin yangilash uchun)
  dayLoading: false,  // kun almashtirilganda — javob kelguncha tugmalar bloklanadi
  err: { students: false, today: false },   // oxirgi yuklash xato bilan tugadimi
  resumeAt: 0,        // oxirgi "ilovaga qaytildi" yangilanishi (ms)
  repTab: (() => { try { return localStorage.getItem('parvoz-rep-tab') || 'grid'; } catch (_) { return 'grid'; } })(),
  leads: [],
  leadFilter: 'new',
  view: 'today',
  courseFilter: 'all',
  search: '',
  botUsername: null,
  tgMode: null,
  pay: null,          // { ym, rows } — tanlangan oy va 11 oy oldingi to'lovlar
  payYm: null,        // YYYY-MM — null bo'lsa joriy oy
  payTab: (() => { try { return localStorage.getItem('parvoz-pay-tab') || 'unpaid'; } catch (_) { return 'unpaid'; } })(),
  payQ: '',
  payMode: (() => { try { return localStorage.getItem('parvoz-pay-mode') === 'fin' ? 'fin' : 'list'; } catch (_) { return 'list'; } })(),
  tpls: {},           // app_config.msg_templates — admin saqlagan shablonlar
  fees: new Map(),    // student_fees: o'quvchi id -> shaxsiy oylik narx (faqat admin)
  tplKind: 'in',      // muharrirda ochiq tur
  tplDraft: {},       // saqlanmagan tahrirlar: { kind: { on, text } }
  timer: null,
  deferredInstall: null,
};

/* ============================================================
   TIL — o'zbekcha va ruscha. Tanlov saytniki bilan bitta kalitda.
   ============================================================ */
const LANGS = ['uz', 'ru'];
const LANG_NAME = { uz: "O'zbekcha", ru: 'Русский' };

function currentLang() {
  let l = null;
  try { l = localStorage.getItem('parvoz-lang'); } catch (_) {}
  return LANGS.includes(l) ? l : 'uz';
}

function setLang(l) {
  if (!LANGS.includes(l)) return;
  // Saqlanmagan shablon — avval so'raymiz (til yozilib bo'lgach "chiqmaslik"ni tanlash
  // aralash tilli ekran qoldirardi)
  if (typeof TPL_KINDS !== 'undefined' && TPL_KINDS.some(tplDirty)) {
    if (!confirm(t('leaveUnsaved'))) return;
    state.leaving = true;
  }
  try {
    localStorage.setItem('parvoz-lang', l);
    // Qayta yuklangach o'sha kun / oyda qolamiz (kechagi davomatni tuzatayotgan o'qituvchi bugunga sakramasin)
    sessionStorage.setItem('parvoz-restore', JSON.stringify({ day: state.day, payYm: state.payYm, repYm: $('repMonth')?.value || null }));
  } catch (_) {}
  location.reload();
}

const STR = {
  uz: {
    /* --- kirish --- */
    authTitle: 'Davomat tizimi',
    authSub: "Parvoz O'quv Markazi · ichki tizim",
    fName: 'Ism-familiya',
    fEmail: 'Email',
    fPass: 'Parol',
    signIn: 'Kirish',
    backSite: 'Saytga qaytish',
    setupTitle: 'Birinchi sozlash',
    setupSub: 'Administrator hisobini yarating',
    setupBtn: 'Hisob yaratish',
    badCreds: "Email yoki parol noto'g'ri",
    noAccess: 'Bu hisobga davomat tizimiga kirish ruxsati berilmagan.',

    /* --- menyu --- */
    navToday: 'Davomat', navLeads: 'Arizalar', navStudents: "O'quvchilar",
    navReport: 'Hisobot', navTeam: 'Jamoa', navSettings: 'Sozlamalar', navMore: 'Yana',
    tToday: 'Bugungi davomat', tLeads: 'Arizalar', tStudents: "O'quvchilar",
    tReport: 'Oylik hisobot', tTeam: 'Jamoa', tSettings: 'Sozlamalar',
    roleAdmin: 'Administrator', roleTeacher: "O'qituvchi",

    /* --- holatlar --- */
    mIn: 'Keldi', mOut: 'Ketdi', mAbsent: 'Kelmadi', mExcused: 'Sababli', mDone: 'Tugadi',
    r1: 'Kasal', r2: 'Oilaviy sabab', r3: "Ta'til / safar", r4: 'Maktab ishi',

    /* --- kun tanlash va guruhni belgilash --- */
    tabGrid: 'Jurnal', tabCharts: 'Diagrammalar', tabList: "Ro'yxat",
    chDaily: "Kunlar bo'yicha davomat",
    chDailySub: "Har kuni nechta o'quvchi keldi, sababli yoki sababsiz qoldi",
    chCourses: "Kurslar bo'yicha davomat",
    chCoursesSub: "O'rtacha davomat — har bir kurs o'z dars kunlariga nisbatan",
    asTable: "Jadval ko'rinishida", colDate: 'Sana', colCourse: 'Kurs',
    closedDay: 'Dam olish kuni', noMark: 'Belgilanmagan', futureDay: 'Hali kelmagan kun',
    gridHint: "Katakni bosing — o'sha kunni tuzatish uchun",
    tooOld: "30 kundan eski kunni tuzatib bo'lmaydi",
    wdShort: 'Ya,Du,Se,Ch,Pa,Ju,Sh',
    offline: 'Internet yo\'q',
    offlineRetry: 'Internet yo\'q. Ulanishni tekshiring va qaytadan kiring.',
    today: 'Bugun', yesterday: 'Kecha', backToToday: 'Bugunga qaytish',
    pastDay: 'O\'tgan kun — ota-onaga xabar yuborilmaydi',
    pickDay: 'Kunni tanlash', prevDay: 'Oldingi kun', nextDay: 'Keyingi kun',
    allArrived: 'Hammasi keldi', markGroup: 'Guruhni belgilash',
    groupAsk: '{course} guruhidagi {n} o\'quvchiga «{label}» qo\'yilsinmi?',
    groupDone: '{n} ta belgilandi',
    groupDoneSkip: '{n} ta belgilandi, {k} tasi o\'tkazib yuborildi',
    groupNone: 'Belgilanadigan o\'quvchi qolmadi',
    undo: 'Bekor qilish',
    undoAlsoOut: "«{in}» o'chirilsa, «{out}» ham o'chadi. Davom etilsinmi?",
    replaceAsk: "{name} bugun allaqachon belgilangan: {cur}. «{label}» qo'yilsa, bu belgi o'chadi. Davom etilsinmi?",
    loadFail: "Ma'lumot yuklanmadi — internetni tekshiring",
    retry: 'Qayta urinish',
    loading: 'Yuklanmoqda…',
    serverErr: "Server javob bermadi. Birozdan keyin qayta urinib ko'ring.",
    teacherExists: "Bu email allaqachon ro'yxatda — uni ro'yxatdan tahrirlang",
    selfRole: "O'z rolingizni o'zgartira olmaysiz",
    badPhone: "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67",
    nameReq: 'Ismni kiriting',
    dupStudent: "{course} kursida «{name}» allaqachon bor. Baribir qo'shilsinmi?",
    courseClosed: 'Yopiq kurs',
    payBadDate: "Sana kelajakda bo'lishi mumkin emas",
    leaveUnsaved: "Saqlanmagan shablon o'zgarishlari yo'qoladi. Davom etilsinmi?",
    close: 'Yopish',
    colorName: 'sky:Havorang,green:Yashil,teal:Firuza,violet:Binafsha,rose:Pushti,gold:Tillarang',

    /* --- statistika --- */
    sStudents: "O'quvchi", sPending: 'Kutilmoqda',
    sWorkdays: 'Ish kuni', sVisits: 'Tashrif', sAvg: "O'rtacha",

    /* --- umumiy --- */
    all: 'Barchasi', save: 'Saqlash', saved: 'Saqlandi', deleted: "O'chirildi",
    edit: 'Tahrirlash', del: "O'chirish", add: "Qo'shish",
    copied: 'Nusxalandi', archive: 'Arxiv', error: 'Xatolik',

    /* --- bugungi davomat --- */
    noCourseT: 'Sizga hali kurs biriktirilmagan',
    noCourseP: "Administrator sizga fan biriktirgandan so'ng o'quvchilar shu yerda ko'rinadi.",
    noStudentT: "O'quvchi topilmadi",
    noSearch: "Qidiruvga mos o'quvchi yo'q.",
    addFirst: "Avval o'quvchilarni qo'shing.",
    addStudent: "O'quvchi qo'shish",
    search: 'Qidirish',
    searchStudent: "\u{1F50D} O'quvchini qidirish...",
    fresh: 'Hali belgilanmagan',
    sinceHere: '{time} dan beri markazda',
    noTg: 'Ota-ona Telegramga ulanmagan',
    marksOf: '{name} \u2014 bugungi belgilar',
    marksHint: "Bugungi belgilar. Xato bosilgan bo'lsa \u2014 o'chiring.",
    undoAria: '{label} belgisini bekor qilish',
    undone: 'Belgi bekor qilindi',
    reasonOf: '{name} \u2014 sabab',
    reason: 'Sabab',
    reasonPh: 'Masalan: shifokorga bordi',
    reasonHint: "Sabab ota-onaga boradigan xabarda ko'rinadi.",
    markAs: '{label} belgilash',
    sentToParent: '\u{1F4E8} {name}: {label} \u2014 ota-onaga xabar yuborildi',
    markedOk: '\u2714\uFE0F {name}: {label}',
    tgOff: ' (Telegram ulanmagan)',

    /* --- arizalar --- */
    lNew: 'Yangi', lContacted: "Bog'lanildi", lEnrolled: 'Yozildi', lRejected: 'Rad etildi',
    leadsSub: 'Saytdan kelgan murojaatlar',
    noLeadT: "Ariza yo'q",
    noLeadNew: "Yangi arizalar shu yerda ko'rinadi.",
    noLeadOther: "Bu bo'limda ariza yo'q.",
    call: "Qo'ng'iroq",
    status: 'Holat',
    statusUpdated: 'Holat yangilandi',
    delLead: "Bu arizani o'chirasizmi?",

    /* --- o'quvchilar --- */
    shownN: '{n} ta ko\'rsatilmoqda',
    searchPh: '\u{1F50D} Qidirish...',
    noStudentsT: "O'quvchi yo'q",
    addFirstOne: "Birinchi o'quvchini qo'shing.",
    tgLinked: 'Telegram \u2713', tgNotLinked: 'Ulanmagan', tgNoPhone: 'Raqam kiritilmagan',
    parentLink: 'Ota-ona ulanishi',
    newStudent: "Yangi o'quvchi", editStudent: "O'quvchini tahrirlash",
    fNameReq: 'Ism-familiya *', fCourseReq: 'Kurs *', fChoose: 'Tanlang...',
    fParent: 'Ota-ona ismi', fPhone: 'Ota-ona telefoni',
    fPhoneHint: 'Telegram havolasi faqat shu raqam egasiga ochiladi.',
    fActive: 'Faol (arxivda emas)',
    studentAdded: "O'quvchi qo'shildi",
    delStudent: '{name} va uning BARCHA davomat tarixi o\'chiriladi. Davom etasizmi?',

    /* --- ota-ona havolasi --- */
    tgLink: 'Telegram ulanishi',
    linkedTo: '{name} \u2014 ulangan',
    goesTo: 'Xabarlar <b>{phone}</b> raqami egasining Telegramiga boradi.',
    linkedOn: 'Ulangan sana: {date}',
    unlink: 'Ulanishni uzish',
    unlinkHint: "Raqam o'zgargan bo'lsa: ulanishni uzing, yangi raqamni kiriting va yangi havola bering.",
    unlinkAsk: "{name} uchun Telegram xabarlari to'xtatiladi. Davom etasizmi?",
    unlinked: 'Ulanish uzildi',
    phoneNeeded: 'Telefon raqami kerak',
    noParentPhone: 'Ota-onaning raqami kiritilmagan',
    noParentPhoneP: 'Havola faqat markazga qoldirilgan raqam egasiga ochiladi. Avval raqamni kiriting.',
    enterPhone: 'Raqamni kiritish',
    parentLinkT: 'Ota-ona havolasi',
    linkFailed: 'Havola yaratilmadi',
    sendTo: 'Havolani <b>{phone}</b> raqamli ota-onaga yuboring.',
    copyLink: 'Havolani nusxalash',
    sendLink: '\u{1F4E4} Yuborish',
    step1: 'Ota-ona havolani bosadi.',
    step2: "Bot <b>\u00ab\u{1F4F1} Raqamimni tasdiqlash\u00bb</b> tugmasini ko'rsatadi.",
    step3: 'Raqam yuqoridagi raqamga mos kelsa \u2014 ulanadi.',
    linkTtl: "Havola <b>{h} soat</b> amal qiladi va bir marta ishlaydi. Boshqa odam ochsa \u2014 hech narsa ko'rmaydi.",
    linkCopied: '\u{1F517} Havola nusxalandi',
    copyLinkPrompt: 'Havolani nusxalang:',
    shareText: "Assalomu alaykum! {name} ning markazga kelgan-ketganini Telegramda kuzatish uchun shu havolani oching va raqamingizni tasdiqlang:",
    textCopied: '\u{1F4CB} Matn nusxalandi \u2014 ota-onaga yuboring',
    copyTextPrompt: 'Matnni nusxalang:',

    /* --- hisobot --- */
    reportSub: 'Davomat statistikasi',
    month: 'Oy',
    noData: "Ma'lumot yo'q",
    noDataP: 'Bu oyda davomat yozuvlari topilmadi.',
    noDaysP: "Bu oyda yozuv yo'q",
    colStudent: "O'quvchi", colDays: 'Kunlar', colAtt: 'Davomat', colLast: 'Oxirgi',
    colAbsExc: 'Kelmadi / Sababli', archiveShort: 'arxiv',
    csvFirst: 'Avval hisobot yuklansin',
    csvDone: 'CSV yuklandi',
    csvCourse: 'Kurs', csvCameDays: 'Kelgan kunlar', csvWorkDays: 'Ish kunlari',
    csvPct: 'Davomat %', csvLast: 'Oxirgi tashrif',
    csvCameDates: 'Kelgan sanalar', csvAbsentDates: 'Kelmagan sanalar', csvExcusedDates: 'Sababli sanalar',

    /* --- jamoa --- */
    teamSub: "O'qituvchilar va ularning fanlari",
    teacher: "O'qituvchi", course: 'Kurs', courses: "\u{1F4DA} Kurslar",
    allCourses: 'Barcha kurslar', noCourseAssigned: 'Kurs biriktirilmagan',
    closed: 'Yopiq', nStudents: "{n} ta o'quvchi",
    newTeacher: "Yangi o'qituvchi", editTeacher: "O'qituvchini tahrirlash",
    fEmailReq: 'Email *', fRole: 'Rol',
    passKeep: "(o'zgartirmasangiz bo'sh qoldiring)",
    roleTeacherOpt: "O'qituvchi \u2014 faqat o'z fanlari",
    roleAdminOpt: 'Administrator \u2014 barcha huquqlar',
    assignedCourses: 'Biriktirilgan fanlar',
    delTeacher: "{email} hisobini o'chirasizmi?",
    newCourse: 'Yangi kurs', editCourse: 'Kursni tahrirlash',
    fNameStar: 'Nomi *', fIcon: 'Belgi (emoji)', fColor: 'Rang', fOpen: 'Ochiq (faol)',
    fFee: "Oylik narx, so'm", fFeePh: 'Masalan: 300 000',
    fFeeHint: "To'lov yozilganda summa o'zi qo'yiladi va qarz taxminan hisoblanadi. Bo'sh qoldirsangiz — narx belgilanmagan.",
    perMonth: "{n} so'm/oy",
    fStFee: "Shaxsiy oylik narx, so'm", fStFeePh: "Kurs narxi: {n}", fStFeePhNone: 'Kurs narxi belgilanmagan',
    fStFeeHint: "Chegirma yoki alohida kelishuv bo'lsa. Bo'sh qoldirsangiz — kurs narxi olinadi. Faqat admin ko'radi.",
    stFeeFail: "O'quvchi saqlandi, lekin shaxsiy narx saqlanmadi: {e}",
    payOwnFee: "Shaxsiy narx: {n} so'm/oy", payOwnFeeCourse: 'kurs narxi: {n}', payOwnChip: 'Shaxsiy narx',
    delCourse: '"{name}" kursi o\'chirilsinmi?',

    /* --- sozlamalar --- */
    setLang: 'Til',
    setInstall: "\u{1F4F1} Ilovani o'rnatish",
    setInstallP: "Telefoningizga ilova sifatida o'rnating \u2014 brauzersiz, bitta bosishda ochiladi.",
    setInstallBtn: "O'rnatish",
    setTeam: '\u{1F465} Jamoa',
    setTeamP: "O'qituvchi qo'shish, ularga fan biriktirish va kurslarni boshqarish.",
    setTeamBtn: "O'qituvchilar va kurslar",
    setBot: '\u{1F916} Telegram bot',
    setBotP: 'Bot ota-onalarga farzandi kelgani va ketgani haqida avtomatik xabar yuboradi.',
    navPay: "To'lovlar", tPay: "Oylik to'lovlar", tPaySub: "Kim to'ladi, kim qarzdor",
    payPaid: "To'ladi", payUnpaid: "To'lamadi", payMark: "To'landi",
    payTabUnpaid: 'Qarzdorlar', payTabPaid: "To'laganlar", payTabAll: 'Hammasi',
    payCollected: "Yig'ildi, so'm", payDebtors2: '2+ oy qarz',
    payAmount: "Summa (so'm)", payDate: "To'langan sana", payNote: 'Izoh',
    payNotePh: 'Masalan: naqd, Click, chegirma',
    payDelete: "To'lovni o'chirish", payDeleteQ: "{name}: {month} uchun to'lov o'chirilsinmi?",
    paySaved: "{name}: to'lov yozildi", payRemoved: "To'lov o'chirildi",
    payAlready: "Bu oy uchun to'lov allaqachon yozilgan — ro'yxat yangilandi",
    payArrears: '{n} oy qarz', payArrearsList: "To'lanmagan oylar",
    paySum: "{n} so'm", payNoAmount: 'summasiz', payBadAmount: "Summa noto'g'ri",
    payQuick: 'Tez tanlash', paySearch: 'Ism yoki telefon',
    payNoneUnpaid: "Hamma to'lagan", payNoneUnpaidP: "Bu oy uchun qarzdor yo'q.",
    payNonePaid: "Hali hech kim to'lamagan", payNonePaidP: "To'lov yozilganda shu yerda ko'rinadi.",
    payNoStudents: "O'quvchi yo'q", payNoStudentsP: "Bu oyda (yoki tanlangan kursda) o'quvchi topilmadi.",
    payPrevMonth: 'Oldingi oy', payNextMonth: 'Keyingi oy', payPickMonth: 'Oyni tanlash',
    payFutureNote: "Keyingi oy — oldindan to'lovlarni yozish uchun",
    payFinBtn: 'Moliya hisoboti', payListBtn: "Ro'yxat",
    finCur: "{m}: yig'ildi, so'm", finTotal: "{n} oyda jami, so'm", finDebt: "Qarz ≈, so'm",
    finSumT: "Oylar bo'yicha yig'ilgan pul", finSumP: "So'm. To'lov qaysi oy uchun yozilgan bo'lsa, o'sha oyda hisoblanadi.",
    finCountT: "To'lagan va to'lamagan o'quvchilar", finCountP: "Arxivdagi o'quvchilar to'lamaganlarga qo'shilmaydi.",
    finCourseT: "Kurslar bo'yicha yig'ilgan pul", finCourseP: "So'nggi {n} oy ichida",
    finColMonth: 'Oy', finColSum: "Yig'ildi, so'm", finColDebt: "Qarz ≈, so'm",
    finDebtNote: "Qarz ≈ — hozirgi oylik narx (shaxsiy yoki kurs) bo'yicha taxmin; narxi yo'q o'quvchilar kirmaydi.",
    finTipSum: "Yig'ildi: {n} so'm", finTipPays: "To'lovlar: {n}", finTipNoAmt: 'Summasiz: {n}', finTipShare: 'Ulushi: {n}%',
    finEmpty: "Hali to'lov yozilmagan", finEmptyP: "To'lovlar yozilgach, bu yerda oylar bo'yicha hisobot chiqadi.",
    finCsvFile: 'parvoz-moliya', mln: 'mln', thousand: 'ming',
    payCsvName: "O'quvchi", payCsvStatus: 'Holat', payCsvOwed: "To'lanmagan oylar",
    payCsvDebt: "Taxminiy qarz, so'm (oylik narx bo'yicha)", payCsvRate: "Oylik narx, so'm", payDebt: "≈ {n} so'm",
    payDebtTotal: "Jami qarz ≈ {n} so'm", payDebtBasis: "oylik narx (shaxsiy yoki kurs) × to'lanmagan oylar",
    payDebtNoFee: "{n} ta o'quvchida narx belgilanmagan", payFeeChip: 'Kurs narxi',
    payFeeNudge: "Kurs narxini Jamoa → Kurslar bo'limida belgilasangiz, summa o'zi qo'yiladi.",
    delHasPayments: "Bu o'quvchida to'lovlar yozilgan — o'chirib bo'lmaydi. O'rniga uni arxivlang.",
    setTpl: '\u{1F4AC} Ota-onaga xabarlar',
    setTplP: "Farzand kelganda, ketganda yoki darsga kelmaganda ota-onaga Telegramda boradigan matn. Faqat bugungi belgilashda yuboriladi. To'lov eslatmasi faqat To'lovlar bo'limidan qo'lda yuboriladi, «qabul qilindi» xabari esa to'lov yozilganda ketadi.",
    tplPaidTab: 'Qabul qilindi', vSumma: 'Summa',
    tplOnPaidP: "O'chirilsa, to'lov yoziladi, lekin ota-onaga xabar bormaydi",
    payTell: "Ota-onaga Telegramda «to'lov qabul qilindi» xabari",
    payNotifSoon: ' · 📨 ota-onaga xabar ketadi', payNotifBtn: "Ota-onaga «qabul qilindi» xabarini yuborish",
    payNotifDone: 'Ota-onaga xabar yuborildi', payNotifBadge: 'Ota-onaga xabar yuborilgan',
    payNotifNoTg: 'Ota-ona Telegramga ulanmagan — xabar yuborilmadi',
    payNotifMuted: "Bu xabar Sozlamalarda o'chirilgan",
    payNotifBadName: "O'quvchi ismida raqam yoki havola bor — ismni tekshiring, xabar yuborilmadi",
    payNotifFail: "Ota-onaga xabar yetmadi — to'lovni ochib, qayta yuborishingiz mumkin",
    tplPayTab: "To'lov", tplPayManual: "Bu xabar avtomatik ketmaydi — faqat To'lovlar bo'limidan qo'lda yuboriladi.",
    vOy: 'Oy', vOylar: 'Qarz oylar',
    remBtn: 'Eslatma yuborish ({n})', remNoBot: 'Avval Sozlamalarda Telegram botni ulang',
    remTitle: "To'lov eslatmasi", remBySearch: "Qidiruv bo'yicha: {n} ta",
    remSumDebt: '{n} qarzdor', remSumOk: '{n} tasiga yuboriladi', remSumNoTg: '{n} tasi Telegramga ulanmagan',
    remSumRecent: '{n} tasiga yaqinda yuborilgan', remSumBad: '{n} tasida ismni tekshiring',
    remWillGet: 'Kimga yuboriladi ({n})', remAll: 'Hammasi', remNone: 'Hech biri', remSkipped: 'Yuborilmaydi ({n})',
    remR_no_tg: 'Telegramga ulanmagan', remR_recent: 'yaqinda eslatilgan · {d}', remR_bad_name: 'ismni tekshiring',
    remR_blocked: 'botni bloklagan', remR_no_chat: 'chat topilmadi', remR_unknown: "yetkazilgani noma'lum",
    remR_paid: "to'lov yozilgan", remR_inactive: 'arxivda', remR_not_started: "bu oyda hali o'qimagan", remR_failed: 'yuborilmadi',
    remSend: "{n} ta o'quvchi uchun eslatma yuborish",
    remConfirm: "{n} ta o'quvchining ota-onasiga Telegram xabari yuboriladi. Davom etasizmi?",
    remProgress: 'Yuborilmoqda: {n} / {total}…', remDone: '✅ {n} ta yuborildi', remNotReached: 'Yetib bormadi yoki yuborilmadi ({n})',
    remAllReached: "Hammasiga yuborildi", remClose: 'Yopish',
    remBroke: "Aloqa uzildi — ba'zi xabarlar yuborilgan bo'lishi mumkin, ro'yxat yangilandi",
    remAbort_token: 'Bot ulanishi ishlamayapti — Sozlamalarda tokenni qayta ulang',
    remAbort_format: 'Shablonni Telegram qabul qilmadi — matnni tekshiring',
    remAbort_rate_limited: "Telegram vaqtincha cheklov qo'ydi — birozdan keyin urinib ko'ring",
    remAbort_network: "Telegram bilan aloqa yo'q",
    remBadgeSent: 'Eslatma yuborilgan', remBadgeUnknown: "Eslatma yetkazilgani noma'lum", remBadgeFailed: 'Eslatma yetkazilmadi',
    tplOn: 'Xabar yuborilsin',
    tplOnP: "O'chirilsa, belgi qo'yiladi, lekin ota-onaga xabar bormaydi",
    tplText: 'Xabar matni',
    tplVars: "Bosing — matnga qo'shiladi",
    tplHint: "*matn* — qalin yozuv. Qiymati bo'sh o'zgaruvchi turgan qator yuborilmaydi (masalan, sabab yozilmasa).",
    tplPrev: "Ota-ona shunday ko'radi",
    tplMuted: 'Bu xabar yuborilmaydi',
    tplReset: 'Standart matn',
    tplSave: 'Saqlash',
    tplSaved: 'Shablon saqlandi',
    tplUnsaved: 'saqlanmagan',
    tplOff: "o'chiq",
    tplDefault: 'Standart matn',
    tplCustom: "O'zgartirilgan",
    tplErrIsm: "Xabarda {ism} bo'lishi shart — oilada bir nechta farzand o'qishi mumkin",
    tplErrVar: "Bu xabarda ishlatib bo'lmaydi: {v}",
    tplErrLen: 'Xabar {n} belgidan oshmasin',
    tplSampleName: 'Ali Valiyev',
    vIsm: 'Ism', vVaqt: 'Soat', vKurs: 'Kurs', vSana: 'Sana', vSabab: 'Sabab',
    botNone: 'Bot ulanmagan', reconnect: 'Qayta ulash',
    newToken: 'Yangi token (BotFather)', saveToken: 'Tokenni saqlash',
    tokenNeeded: 'Token kiriting',
    botLinked: '\u{1F916} Bot ulandi: @{name}',
    fastOn: '\u26A1 Tezkor rejim', slowOn: '\u23F3 Sekin rejim',
    fastLinked: '\u26A1 Bot tezkor rejimga ulandi',
    fastOnToast: '\u26A1 Tezkor rejim yoqildi',
    fastFailed: '\u26A0\uFE0F Tezkor rejim yoqilmadi: ',
    setNotify: '\u{1F514} Ariza xabarnomalari',
    setNotifyP: "Saytdan yangi ariza kelganda Telegramga darhol xabar olish uchun o'zingizni ulang.",
    setNotifyBtn: '\u{1F517} Meni ulash havolasini olish',
    nobodyLinked: "Hech kim ulanmagan \u2014 arizalar haqida xabar bormaydi",
    tgUser: 'Telegram foydalanuvchi', linkedBadge: 'Ulangan',
    logout: 'Chiqish',
    panelName: 'Parvoz Davomat',
    notifyLink: 'Xabarnomalarga ulanish',
    notifyLinkP: 'Quyidagi tugmani bosing \u2014 Telegram ochiladi va "Start" bosganingizdan keyin saytdan kelgan arizalar shu chatga yuboriladi. Havola 30 daqiqa amal qiladi.',
    openInTg: 'Telegramda ochish',
    linkLabel: 'Havola:',
    toDark: "Qorong'i rejimga o'tish", toLight: "Yorug' rejimga o'tish",
    parentsLinkedN: '\u2705 {n} ta ota-ona Telegramga ulandi',
  },
  ru: {
    authTitle: 'Система посещаемости',
    authSub: 'Учебный центр Parvoz · внутренняя система',
    fName: 'Имя и фамилия',
    fEmail: 'Email',
    fPass: 'Пароль',
    signIn: 'Войти',
    backSite: 'Вернуться на сайт',
    setupTitle: 'Первая настройка',
    setupSub: 'Создайте аккаунт администратора',
    setupBtn: 'Создать аккаунт',
    badCreds: 'Неверный email или пароль',
    noAccess: 'У этого аккаунта нет доступа к системе посещаемости.',

    navToday: 'Посещаемость', navLeads: 'Заявки', navStudents: 'Ученики',
    navReport: 'Отчёт', navTeam: 'Команда', navSettings: 'Настройки', navMore: 'Ещё',
    tToday: 'Посещаемость сегодня', tLeads: 'Заявки', tStudents: 'Ученики',
    tReport: 'Месячный отчёт', tTeam: 'Команда', tSettings: 'Настройки',
    roleAdmin: 'Администратор', roleTeacher: 'Преподаватель',

    mIn: 'Пришёл', mOut: 'Ушёл', mAbsent: 'Не пришёл', mExcused: 'По причине', mDone: 'Завершено',
    r1: 'Болезнь', r2: 'Семейные обстоятельства', r3: 'Отпуск / поездка', r4: 'Дела в школе',

    tabGrid: 'Журнал', tabCharts: 'Графики', tabList: 'Список',
    chDaily: 'Посещаемость по дням',
    chDailySub: 'Сколько учеников пришло, отсутствовало по причине и без',
    chCourses: 'Посещаемость по курсам',
    chCoursesSub: 'Средняя посещаемость — каждый курс относительно своих учебных дней',
    asTable: 'В виде таблицы', colDate: 'Дата', colCourse: 'Курс',
    closedDay: 'Выходной', noMark: 'Не отмечен', futureDay: 'Этот день ещё не наступил',
    gridHint: 'Нажмите на ячейку, чтобы исправить этот день',
    tooOld: 'Дни старше 30 дней исправить нельзя',
    wdShort: 'Вс,Пн,Вт,Ср,Чт,Пт,Сб',
    offline: 'Нет интернета',
    offlineRetry: 'Нет интернета. Проверьте подключение и войдите снова.',
    today: 'Сегодня', yesterday: 'Вчера', backToToday: 'Вернуться к сегодня',
    pastDay: 'Прошедший день — родителям уведомление не отправляется',
    pickDay: 'Выбрать день', prevDay: 'Предыдущий день', nextDay: 'Следующий день',
    allArrived: 'Все пришли', markGroup: 'Отметить группу',
    groupAsk: 'Поставить «{label}» всем {n} ученикам группы {course}?',
    groupDone: 'Отмечено: {n}',
    groupDoneSkip: 'Отмечено: {n}, пропущено: {k}',
    groupNone: 'Некого отмечать',
    undo: 'Отменить',
    undoAlsoOut: 'Если удалить «{in}», «{out}» тоже удалится. Продолжить?',
    replaceAsk: '{name} уже отмечен(а) сегодня: {cur}. Если поставить «{label}», эта отметка удалится. Продолжить?',
    loadFail: 'Данные не загрузились — проверьте интернет',
    retry: 'Повторить',
    loading: 'Загрузка…',
    serverErr: 'Сервер не ответил. Попробуйте ещё раз чуть позже.',
    teacherExists: 'Этот email уже есть в списке — измените его через список',
    selfRole: 'Свою роль изменить нельзя',
    badPhone: 'Неверный номер телефона. Например: +998 90 123 45 67',
    nameReq: 'Введите имя',
    dupStudent: 'В курсе {course} уже есть «{name}». Всё равно добавить?',
    courseClosed: 'Курс закрыт',
    payBadDate: 'Дата не может быть в будущем',
    leaveUnsaved: 'Несохранённые изменения шаблона пропадут. Продолжить?',
    close: 'Закрыть',
    colorName: 'sky:Голубой,green:Зелёный,teal:Бирюзовый,violet:Фиолетовый,rose:Розовый,gold:Золотой',

    sStudents: 'Учеников', sPending: 'Ожидается',
    sWorkdays: 'Рабочих дней', sVisits: 'Посещений', sAvg: 'В среднем',

    all: 'Все', save: 'Сохранить', saved: 'Сохранено', deleted: 'Удалено',
    edit: 'Изменить', del: 'Удалить', add: 'Добавить',
    copied: 'Скопировано', archive: 'Архив', error: 'Ошибка',

    noCourseT: 'Вам ещё не назначен предмет',
    noCourseP: 'Когда администратор назначит вам предмет, ученики появятся здесь.',
    noStudentT: 'Ученик не найден',
    noSearch: 'По запросу никого нет.',
    addFirst: 'Сначала добавьте учеников.',
    addStudent: 'Добавить ученика',
    search: 'Поиск',
    searchStudent: '\u{1F50D} Поиск ученика...',
    fresh: 'Ещё не отмечен',
    sinceHere: 'в центре с {time}',
    noTg: 'Родитель не подключён к Telegram',
    marksOf: '{name} \u2014 отметки за сегодня',
    marksHint: 'Отметки за сегодня. Если нажали по ошибке \u2014 удалите.',
    undoAria: 'Отменить отметку «{label}»',
    undone: 'Отметка отменена',
    reasonOf: '{name} \u2014 причина',
    reason: 'Причина',
    reasonPh: 'Например: пошёл к врачу',
    reasonHint: 'Причина будет видна в сообщении родителю.',
    markAs: 'Отметить «{label}»',
    sentToParent: '\u{1F4E8} {name}: {label} \u2014 родителю отправлено сообщение',
    markedOk: '\u2714\uFE0F {name}: {label}',
    tgOff: ' (Telegram не подключён)',

    lNew: 'Новая', lContacted: 'Связались', lEnrolled: 'Записан', lRejected: 'Отклонена',
    leadsSub: 'Обращения с сайта',
    noLeadT: 'Заявок нет',
    noLeadNew: 'Новые заявки появятся здесь.',
    noLeadOther: 'В этом разделе заявок нет.',
    call: 'Позвонить',
    status: 'Статус',
    statusUpdated: 'Статус обновлён',
    delLead: 'Удалить эту заявку?',

    shownN: 'показано: {n}',
    searchPh: '\u{1F50D} Поиск...',
    noStudentsT: 'Учеников нет',
    addFirstOne: 'Добавьте первого ученика.',
    tgLinked: 'Telegram \u2713', tgNotLinked: 'Не подключён', tgNoPhone: 'Номер не указан',
    parentLink: 'Подключение родителя',
    newStudent: 'Новый ученик', editStudent: 'Изменить ученика',
    fNameReq: 'Имя и фамилия *', fCourseReq: 'Предмет *', fChoose: 'Выберите...',
    fParent: 'Имя родителя', fPhone: 'Телефон родителя',
    fPhoneHint: 'Ссылка в Telegram откроется только у владельца этого номера.',
    fActive: 'Активен (не в архиве)',
    studentAdded: 'Ученик добавлен',
    delStudent: '{name} и ВСЯ история посещаемости будут удалены. Продолжить?',

    tgLink: 'Подключение Telegram',
    linkedTo: '{name} \u2014 подключён',
    goesTo: 'Сообщения приходят в Telegram владельцу номера <b>{phone}</b>.',
    linkedOn: 'Дата подключения: {date}',
    unlink: 'Отключить',
    unlinkHint: 'Если номер изменился: отключите, впишите новый номер и выдайте новую ссылку.',
    unlinkAsk: 'Сообщения в Telegram для {name} прекратятся. Продолжить?',
    unlinked: 'Подключение снято',
    phoneNeeded: 'Нужен номер телефона',
    noParentPhone: 'Номер родителя не указан',
    noParentPhoneP: 'Ссылка откроется только у владельца номера, оставленного центру. Сначала впишите номер.',
    enterPhone: 'Вписать номер',
    parentLinkT: 'Ссылка для родителя',
    linkFailed: 'Ссылка не создана',
    sendTo: 'Отправьте ссылку родителю с номером <b>{phone}</b>.',
    copyLink: 'Скопировать ссылку',
    sendLink: '\u{1F4E4} Отправить',
    step1: 'Родитель нажимает на ссылку.',
    step2: 'Бот показывает кнопку <b>\u00ab\u{1F4F1} Подтвердить мой номер\u00bb</b>.',
    step3: 'Если номер совпадает с указанным выше \u2014 подключение готово.',
    linkTtl: 'Ссылка действует <b>{h} ч.</b> и срабатывает один раз. Если её откроет кто-то другой \u2014 он ничего не увидит.',
    linkCopied: '\u{1F517} Ссылка скопирована',
    copyLinkPrompt: 'Скопируйте ссылку:',
    shareText: 'Здравствуйте! Чтобы видеть в Telegram, когда {name} приходит в центр и уходит, откройте эту ссылку и подтвердите свой номер:',
    textCopied: '\u{1F4CB} Текст скопирован \u2014 отправьте родителю',
    copyTextPrompt: 'Скопируйте текст:',

    reportSub: 'Статистика посещаемости',
    month: 'Месяц',
    noData: 'Нет данных',
    noDataP: 'За этот месяц записей не найдено.',
    noDaysP: 'За этот месяц записей нет',
    colStudent: 'Ученик', colDays: 'Дней', colAtt: 'Посещаемость', colLast: 'Последний',
    colAbsExc: 'Не пришёл / По причине', archiveShort: 'архив',
    csvFirst: 'Сначала загрузите отчёт',
    csvDone: 'CSV скачан',
    csvCourse: 'Предмет', csvCameDays: 'Дней присутствия', csvWorkDays: 'Рабочих дней',
    csvPct: 'Посещаемость %', csvLast: 'Последнее посещение',
    csvCameDates: 'Даты присутствия', csvAbsentDates: 'Даты отсутствия', csvExcusedDates: 'Даты по причине',

    teamSub: 'Преподаватели и их предметы',
    teacher: 'Преподаватель', course: 'Предмет', courses: '\u{1F4DA} Предметы',
    allCourses: 'Все предметы', noCourseAssigned: 'Предмет не назначен',
    closed: 'Закрыт', nStudents: 'учеников: {n}',
    newTeacher: 'Новый преподаватель', editTeacher: 'Изменить преподавателя',
    fEmailReq: 'Email *', fRole: 'Роль',
    passKeep: '(оставьте пустым, если не меняете)',
    roleTeacherOpt: 'Преподаватель \u2014 только свои предметы',
    roleAdminOpt: 'Администратор \u2014 все права',
    assignedCourses: 'Назначенные предметы',
    delTeacher: 'Удалить аккаунт {email}?',
    newCourse: 'Новый предмет', editCourse: 'Изменить предмет',
    fNameStar: 'Название *', fIcon: 'Значок (эмодзи)', fColor: 'Цвет', fOpen: 'Открыт (активен)',
    fFee: 'Цена в месяц, сум', fFeePh: 'Например: 300 000',
    fFeeHint: 'Подставляется при записи оплаты, по ней примерно считается долг. Пусто — цена не задана.',
    perMonth: '{n} сум/мес.',
    fStFee: 'Личная цена в месяц, сум', fStFeePh: 'Цена курса: {n}', fStFeePhNone: 'Цена курса не задана',
    fStFeeHint: 'Если есть скидка или отдельная договорённость. Пусто — берётся цена курса. Видит только администратор.',
    stFeeFail: 'Ученик сохранён, но личная цена не сохранилась: {e}',
    payOwnFee: 'Личная цена: {n} сум/мес.', payOwnFeeCourse: 'цена курса: {n}', payOwnChip: 'Личная цена',
    delCourse: 'Удалить предмет «{name}»?',

    setLang: 'Язык',
    setInstall: '\u{1F4F1} Установить приложение',
    setInstallP: 'Установите как приложение на телефон \u2014 без браузера, в одно нажатие.',
    setInstallBtn: 'Установить',
    setTeam: '\u{1F465} Команда',
    setTeamP: 'Добавляйте преподавателей, назначайте им предметы и управляйте предметами.',
    setTeamBtn: 'Преподаватели и предметы',
    setBot: '\u{1F916} Telegram-бот',
    setBotP: 'Бот автоматически сообщает родителям, когда ребёнок пришёл и ушёл.',
    navPay: 'Оплаты', tPay: 'Ежемесячные оплаты', tPaySub: 'Кто оплатил, кто должен',
    payPaid: 'Оплатил', payUnpaid: 'Не оплатил', payMark: 'Оплачено',
    payTabUnpaid: 'Должники', payTabPaid: 'Оплатили', payTabAll: 'Все',
    payCollected: 'Собрано, сум', payDebtors2: 'Долг 2+ мес.',
    payAmount: 'Сумма (сум)', payDate: 'Дата оплаты', payNote: 'Комментарий',
    payNotePh: 'Например: наличные, Click, скидка',
    payDelete: 'Удалить оплату', payDeleteQ: 'Удалить оплату {name} за {month}?',
    paySaved: '{name}: оплата записана', payRemoved: 'Оплата удалена',
    payAlready: 'Оплата за этот месяц уже записана — список обновлён',
    payArrears: 'долг {n} мес.', payArrearsList: 'Неоплаченные месяцы',
    paySum: '{n} сум', payNoAmount: 'без суммы', payBadAmount: 'Неверная сумма',
    payQuick: 'Быстрый выбор', paySearch: 'Имя или телефон',
    payNoneUnpaid: 'Все оплатили', payNoneUnpaidP: 'Должников за этот месяц нет.',
    payNonePaid: 'Пока никто не оплатил', payNonePaidP: 'Оплаты появятся здесь.',
    payNoStudents: 'Нет учеников', payNoStudentsP: 'В этом месяце (или курсе) учеников не найдено.',
    payPrevMonth: 'Предыдущий месяц', payNextMonth: 'Следующий месяц', payPickMonth: 'Выбрать месяц',
    payFutureNote: 'Следующий месяц — для записи предоплат',
    payFinBtn: 'Финансовый отчёт', payListBtn: 'Список',
    finCur: '{m}: собрано, сум', finTotal: 'За {n} мес., сум', finDebt: 'Долг ≈, сум',
    finSumT: 'Собрано по месяцам', finSumP: 'Сум. Оплата считается в том месяце, за который она записана.',
    finCountT: 'Оплатили и не оплатили', finCountP: 'Архивные ученики не считаются должниками.',
    finCourseT: 'Собрано по курсам', finCourseP: 'За последние {n} мес.',
    finColMonth: 'Месяц', finColSum: 'Собрано, сум', finColDebt: 'Долг ≈, сум',
    finDebtNote: 'Долг ≈ — оценка по текущей месячной цене (личной или курса); ученики без цены не учитываются.',
    finTipSum: 'Собрано: {n} сум', finTipPays: 'Оплат: {n}', finTipNoAmt: 'Без суммы: {n}', finTipShare: 'Доля: {n}%',
    finEmpty: 'Оплат пока нет', finEmptyP: 'Когда появятся оплаты, здесь будет отчёт по месяцам.',
    finCsvFile: 'parvoz-finansy', mln: 'млн', thousand: 'тыс.',
    payCsvName: 'Ученик', payCsvStatus: 'Статус', payCsvOwed: 'Неоплаченные месяцы',
    payCsvDebt: 'Примерный долг, сум (по месячной цене)', payCsvRate: 'Месячная цена, сум', payDebt: '≈ {n} сум',
    payDebtTotal: 'Всего долг ≈ {n} сум', payDebtBasis: 'месячная цена (личная или курса) × неоплаченные месяцы',
    payDebtNoFee: 'без цены — учеников: {n}', payFeeChip: 'Цена курса',
    payFeeNudge: 'Задайте цену курса в разделе Команда → Курсы — сумма будет подставляться сама.',
    delHasPayments: 'У ученика есть оплаты — удалить нельзя. Переведите его в архив.',
    setTpl: '\u{1F4AC} Сообщения родителям',
    setTplP: 'Текст, который родитель получает в Telegram, когда ребёнок пришёл, ушёл или не пришёл. Отправляется только при отметке за сегодня. Напоминание об оплате отправляется только вручную из раздела «Оплаты», а сообщение «оплата принята» — при записи оплаты.',
    tplPaidTab: 'Принята', vSumma: 'Сумма',
    tplOnPaidP: 'Если выключить, оплата сохранится, но родитель сообщение не получит',
    payTell: 'Сообщение родителю в Telegram «оплата принята»',
    payNotifSoon: ' · 📨 родителю уйдёт сообщение', payNotifBtn: 'Отправить родителю «оплата принята»',
    payNotifDone: 'Сообщение родителю отправлено', payNotifBadge: 'Родителю отправлено сообщение',
    payNotifNoTg: 'Родитель не подключён к Telegram — сообщение не отправлено',
    payNotifMuted: 'Это сообщение выключено в Настройках',
    payNotifBadName: 'В имени ученика есть номер или ссылка — проверьте имя, сообщение не отправлено',
    payNotifFail: 'Сообщение родителю не доставлено — откройте оплату, чтобы отправить снова',
    tplPayTab: 'Оплата', tplPayManual: 'Это сообщение не уходит автоматически — только вручную из раздела «Оплаты».',
    vOy: 'Месяц', vOylar: 'Долг. месяцы',
    remBtn: 'Напомнить ({n})', remNoBot: 'Сначала подключите Telegram-бота в Настройках',
    remTitle: 'Напоминание об оплате', remBySearch: 'По поиску: {n}',
    remSumDebt: 'должников: {n}', remSumOk: 'отправим: {n}', remSumNoTg: 'не подключены к Telegram: {n}',
    remSumRecent: 'недавно напоминали: {n}', remSumBad: 'проверьте имя: {n}',
    remWillGet: 'Получат ({n})', remAll: 'Все', remNone: 'Никого', remSkipped: 'Не получат ({n})',
    remR_no_tg: 'не подключён к Telegram', remR_recent: 'недавно напоминали · {d}', remR_bad_name: 'проверьте имя',
    remR_blocked: 'заблокировал бота', remR_no_chat: 'чат не найден', remR_unknown: 'доставка не подтверждена',
    remR_paid: 'оплата записана', remR_inactive: 'в архиве', remR_not_started: 'ещё не учился в этом месяце', remR_failed: 'не отправлено',
    remSend: 'Отправить напоминание (получателей: {n})',
    remConfirm: 'Родителям {n} учеников будет отправлено сообщение в Telegram. Продолжить?',
    remProgress: 'Отправка: {n} / {total}…', remDone: '✅ Отправлено: {n}', remNotReached: 'Не доставлено или не отправлено ({n})',
    remAllReached: 'Отправлено всем', remClose: 'Закрыть',
    remBroke: 'Связь прервалась — часть сообщений могла уйти, список обновлён',
    remAbort_token: 'Бот не работает — переподключите токен в Настройках',
    remAbort_format: 'Telegram не принял шаблон — проверьте текст',
    remAbort_rate_limited: 'Telegram временно ограничил отправку — попробуйте позже',
    remAbort_network: 'Нет связи с Telegram',
    remBadgeSent: 'Напоминание отправлено', remBadgeUnknown: 'Доставка напоминания не подтверждена', remBadgeFailed: 'Напоминание не доставлено',
    tplOn: 'Отправлять сообщение',
    tplOnP: 'Если выключить, отметка сохранится, но родитель сообщение не получит',
    tplText: 'Текст сообщения',
    tplVars: 'Нажмите — вставится в текст',
    tplHint: '*текст* — жирный. Строка с пустой переменной не отправляется (например, если причина не указана).',
    tplPrev: 'Так увидит родитель',
    tplMuted: 'Это сообщение не отправляется',
    tplReset: 'По умолчанию',
    tplSave: 'Сохранить',
    tplSaved: 'Шаблон сохранён',
    tplUnsaved: 'не сохранено',
    tplOff: 'выкл.',
    tplDefault: 'Стандартный текст',
    tplCustom: 'Изменён',
    tplErrIsm: 'В сообщении должно быть {ism} — в семье может учиться несколько детей',
    tplErrVar: 'В этом сообщении нельзя использовать: {v}',
    tplErrLen: 'Не более {n} символов',
    tplSampleName: 'Ali Valiyev',
    vIsm: 'Имя', vVaqt: 'Время', vKurs: 'Курс', vSana: 'Дата', vSabab: 'Причина',
    botNone: 'Бот не подключён', reconnect: 'Переподключить',
    newToken: 'Новый токен (BotFather)', saveToken: 'Сохранить токен',
    tokenNeeded: 'Введите токен',
    botLinked: '\u{1F916} Бот подключён: @{name}',
    fastOn: '\u26A1 Быстрый режим', slowOn: '\u23F3 Медленный режим',
    fastLinked: '\u26A1 Бот подключён в быстром режиме',
    fastOnToast: '\u26A1 Быстрый режим включён',
    fastFailed: '\u26A0\uFE0F Быстрый режим не включился: ',
    setNotify: '\u{1F514} Уведомления о заявках',
    setNotifyP: 'Подключите себя, чтобы получать в Telegram уведомление сразу о новой заявке с сайта.',
    setNotifyBtn: '\u{1F517} Получить ссылку для подключения',
    nobodyLinked: 'Никто не подключён \u2014 уведомления о заявках не приходят',
    tgUser: 'Пользователь Telegram', linkedBadge: 'Подключён',
    logout: 'Выйти',
    panelName: 'Parvoz Davomat',
    notifyLink: 'Подключение к уведомлениям',
    notifyLinkP: 'Нажмите кнопку ниже \u2014 откроется Telegram, и после нажатия «Start» заявки с сайта будут приходить в этот чат. Ссылка действует 30 минут.',
    openInTg: 'Открыть в Telegram',
    linkLabel: 'Ссылка:',
    toDark: 'Перейти на тёмную тему', toLight: 'Перейти на светлую тему',
    parentsLinkedN: '\u2705 Родителей подключилось: {n}',
  },
};

// t('key') yoki t('key', {name: 'Ali'}) — {name} o'rniga qo'yiladi
function t(key, vars) {
  const dict = STR[currentLang()] || STR.uz;
  let out = dict[key] ?? STR.uz[key] ?? key;
  if (vars) for (const k in vars) out = out.split('{' + k + '}').join(vars[k]);
  return out;
}

/* ---------------- Ikonkalar ---------------- */
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21V12h6v9"/><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="4" width="3" height="14" rx="1"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a6 6 0 0 0-12 0"/><circle cx="12" cy="8" r="4"/><path d="m21 8-2 2-1-1"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  home2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
  checks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="m2 2 20 20"/><path d="M8.8 4.3A5.99 5.99 0 0 1 18 9v2c0 1.2.3 2 .8 2.8"/><path d="M6 9v2c0 2-1 3-2 4.5V17h13"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  bellOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 9h-6a3 3 0 0 0 0 6h6z"/><circle cx="15.5" cy="12" r=".6" fill="currentColor"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
};

/* ---------------- Yordamchilar ---------------- */
const $ = (id) => document.getElementById(id);

// Yuklanish ekranini yopamiz va "ochilmadi" kuzatuvchisini to'xtatamiz
function hideBoot() {
  $('boot')?.classList.add('hidden');
  window.__bootOk?.();
}

// davomat.html dagi tayyor matnlarni tanlangan tilga o'tkazamiz
function applyStaticText() {
  document.documentElement.lang = currentLang();
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-lang-pick]').forEach((b) => {
    b.textContent = LANG_NAME[b.dataset.langPick];
    b.classList.toggle('on', currentLang() === b.dataset.langPick);
  });
}

// Sessiya bo'lmasa kirish ekranini ko'rsatamiz
function showBootError(what, detail) {
  $('boot')?.classList.add('hidden');
  $('app')?.classList.add('hidden');
  $('auth')?.classList.add('hidden');
  $('bootErr')?.classList.remove('hidden');
  if ($('bootErrWhat')) $('bootErrWhat').textContent = what;
  if ($('bootErrDetail')) $('bootErrDetail').textContent = detail || '';
}
function showAuth() {
  hideBoot();
  $('app')?.classList.add('hidden');
  $('auth')?.classList.remove('hidden');
}
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// toast('matn') yoki toast('matn', 'ok', { label: 'Bekor qilish', fn })
function toast(msg, kind = '', action) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  // Xato — darhol o'qiladi (alert), qolganlari — navbat bilan (#toasts: role=status)
  if (kind === 'bad') el.setAttribute('role', 'alert');
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);

  let timer;
  if (action && typeof action.fn === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-act';
    btn.textContent = action.label || t('undo');
    btn.addEventListener('click', () => {
      clearTimeout(timer);
      el.remove();
      action.fn();
    });
    el.appendChild(btn);
  }

  $('toasts').appendChild(el);
  timer = setTimeout(() => el.remove(), action ? 6500 : 4200);
}

async function edge(fn, payload, { keepalive = false } = {}) {
  let token = SUPABASE_ANON;
  // keepalive — sahifa yopilayotganda: kutishga vaqt yo'q, oxirgi ma'lum sessiya bilan darhol yuboramiz
  if (keepalive) token = state.session?.access_token ?? SUPABASE_ANON;
  else try {
    const { data } = await sb.auth.getSession();
    if (data.session) { state.session = data.session; token = data.session.access_token; }
  } catch (_) { token = state.session?.access_token ?? SUPABASE_ANON; }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST', keepalive,
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Tarmoq yiqildi — buni ruxsat xatosi bilan aralashtirmaymiz
    const err = new Error(t('offline'));
    err.offline = true;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Xatolik (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const TZ = 'Asia/Samarkand';
const dayKey = (iso) => new Intl.DateTimeFormat('en-CA',
  { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const hhmm = (iso) => new Intl.DateTimeFormat('uz-UZ',
  { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const todayKey = () => dayKey(new Date());

// Brauzer uz-UZ oy nomlarini "M09" deb beradi — o'zimiz formatlaymiz
// uz-UZ oylarni "M09" deb chiqaradi, ru-RU esa kelishikni chalkashtiradi —
// shuning uchun nomlarni o'zimiz yozamiz.
const DATE_NAMES = {
  uz: {
    m: ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'],
    d: ['yakshanba','dushanba','seshanba','chorshanba','payshanba','juma','shanba'],
    fmt: (day, m, d) => `${day}-${m}, ${d}`,
  },
  ru: {
    m: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
    d: ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'],
    fmt: (day, m, d) => `${day} ${m}, ${d}`,
  },
};
function uzDate(d = new Date()) {
  const key = dayKey(d);                       // YYYY-MM-DD (Samarqand)
  const [y, m, day] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const n = DATE_NAMES[currentLang()] || DATE_NAMES.uz;
  return n.fmt(day, n.m[m - 1], n.d[wd]);
}
const currentYm = () => todayKey().slice(0, 7);

/* --- Tanlangan kun. state.day null bo'lsa — bugun. --- */
const selDay = () => state.day || todayKey();
const isToday = () => selDay() === todayKey();
const shiftDay = (key, n) => {
  const d = new Date(`${key}T00:00:00+05:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
};
// Qisqa sana: "27-sentabr" / "27 сентября"
function shortDate(key) {
  const [, m, d] = key.split('-').map(Number);
  const n = DATE_NAMES[currentLang()] || DATE_NAMES.uz;
  return currentLang() === 'ru' ? `${d} ${n.m[m - 1]}` : `${d}-${n.m[m - 1]}`;
}
// Kun tanlagich yorlig'i: "Bugun · 27-sentabr", "Kecha · 26-sentabr", yoki "24-sentabr"
const dayLabel = (key) => key === todayKey() ? `${t('today')} · ${shortDate(key)}`
  : key === shiftDay(todayKey(), -1) ? `${t('yesterday')} · ${shortDate(key)}`
  : shortDate(key);
// Hafta kuni — guruhlar shunga qarab o'qiydi, yakshanba esa markaz yopiq
function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  const n = DATE_NAMES[currentLang()] || DATE_NAMES.uz;
  return n.d[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const OFF = 5 * 3600 * 1000;
  return [new Date(Date.UTC(y, m - 1, 1) - OFF).toISOString(), new Date(Date.UTC(y, m, 1) - OFF).toISOString()];
}

const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const courseById = (id) => state.courses.find((c) => c.id === id) || { name: '—', icon: '📘', color: 'sky' };

/* Kurs belgisi. Bayroq emojisi (🇬🇧) Windows'da bayroq emas, "GB" harflari bo'lib ko'rinadi —
   shuning uchun HTML'da uni SVG bayroq bilan chizamiz. Faqat matn turadigan joyda (<option>,
   diagramma yozuvi) SVG qo'yib bo'lmaydi: u yerda bayroq tushirib qoldiriladi. */
const FLAG_SVG = {
  // Union Jack, 2:1. clipPath ishlatilmaydi: bir sahifada bir necha nusxa bo'lsa id'lar to'qnashardi
  '🇬🇧': '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true" focusable="false">'
    + '<path fill="#012169" d="M0 0h60v30H0z"/>'
    + '<path stroke="#fff" stroke-width="6" d="M0 0l60 30M60 0L0 30"/>'
    + '<path fill="#c8102e" d="M-8.94-4.47L30 15l-.89 1.79L-9.83-2.68zM30 15l38.94 19.47.89-1.79L30.89 13.21z'
    + 'M68.94-4.47L30 15l-.89-1.79 38.94-19.47zM30 15l-38.94 19.47.89 1.79L30.89 16.79z"/>'
    + '<path fill="#fff" d="M25 0h10v30H25zM0 10h60v10H0z"/>'
    + '<path fill="#c8102e" d="M27 0h6v30h-6zM0 12h60v6H0z"/></svg>',
};
const isFlagEmoji = (s) => /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(String(s || ''));
const cIcon = (c) => FLAG_SVG[c.icon] || esc(c.icon);                       // HTML uchun
const cText = (c) => (c.icon && !isFlagEmoji(c.icon) ? c.icon + ' ' : '') + c.name;   // matn uchun
const isAdmin = () => state.me?.role === 'admin';

// Foydalanuvchiga ko'rinadigan kurslar
function myCourses() {
  if (isAdmin()) return state.courses.filter((c) => c.active);
  const ids = new Set(state.me?.course_ids ?? []);
  return state.courses.filter((c) => c.active && ids.has(c.id));
}

/* ---------------- Tema ---------------- */
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem('parvoz-theme', mode); } catch (_) {}
  const meta = $('themeColor');
  if (meta) meta.setAttribute('content', mode === 'light' ? '#f2f6fd' : '#070e20');
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.innerHTML = mode === 'light' ? I.sun : I.moon;
    b.setAttribute('aria-label', mode === 'light' ? t('toDark') : t('toLight'));
  });
}

/* ============================================================
   AUTENTIFIKATSIYA
   ============================================================ */
let needsBootstrap = false;

async function initAuth() {
  setTheme(currentTheme());
  applyStaticText();
  try {
    const st = await edge('admin-api', { action: 'status' });
    needsBootstrap = !!st.needs_bootstrap;
  } catch (_) { /* status ishlamasa ham login ko'rinadi */ }

  if (needsBootstrap) {
    $('authTitle').textContent = t('setupTitle');
    $('authSub').textContent = t('setupSub');
    $('authName').closest('.field').classList.remove('hidden');
    $('authSubmit').textContent = t('setupBtn');
    $('authPass').autocomplete = 'new-password';
  }

  let session = null;
  try { session = (await sb.auth.getSession()).data.session; } catch (_) {}
  if (session) { state.session = session; await enterApp(); }
  else showAuth();
}

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('authEmail').value.trim();
  const password = $('authPass').value;
  $('authErr').textContent = '';
  $('authSubmit').disabled = true;
  try {
    if (needsBootstrap) {
      await edge('admin-api', { action: 'bootstrap', email, password, full_name: $('authName').value.trim() });
      needsBootstrap = false;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? t('badCreds') : error.message);
    state.session = data.session;
    await enterApp();
  } catch (err) {
    $('authErr').textContent = err.message;
  } finally {
    $('authSubmit').disabled = false;
  }
});

async function logout() {
  await sb.auth.signOut();
  clearInterval(state.timer);
  location.reload();
}

/* ============================================================
   ILOVAGA KIRISH
   ============================================================ */
async function enterApp() {
  try {
    state.me = await edge('admin-api', { action: 'me' });
  } catch (err) {
    // Internet yo'qligi — ruxsat yo'qligi EMAS. Sessiyani saqlab qolamiz,
    // aks holda o'qituvchi har uzilishda qaytadan parol kiritishga majbur bo'ladi.
    if (err.offline || !navigator.onLine) {
      showAuth();
      $('authErr').textContent = t('offlineRetry');
      return;
    }
    // Server vaqtincha ishlamayapti (5xx) — bu ham ruxsat yo'qligi emas: sessiyani
    // saqlab, "Qayta urinish" tugmali xato kartasini ko'rsatamiz
    if (err.status !== 401 && err.status !== 403) {
      showBootError(t('serverErr'), err.message);
      return;
    }
    await sb.auth.signOut();
    state.session = null;
    showAuth();
    $('authErr').textContent = t('noAccess');
    return;
  }

  $('auth').classList.add('hidden');
  hideBoot();
  $('app').classList.remove('hidden');

  buildNav();
  renderUserCard();
  renderLangBtn();
  restoreAfterLangSwitch();
  await refreshAll();
  go(location.hash.replace('#', '') || 'today');

  if (isAdmin()) {
    await checkWebhook(true);
  }
  clearInterval(state.timer);
  state.timer = setInterval(refreshLinks, 30000);
}

// Til almashtirilgandan keyin: tanlangan kun va oylar tiklanadi (bir martalik)
function restoreAfterLangSwitch() {
  let r = null;
  try { r = JSON.parse(sessionStorage.getItem('parvoz-restore') || 'null'); sessionStorage.removeItem('parvoz-restore'); } catch (_) {}
  if (!r) return;
  if (r.day && r.day < todayKey() && r.day >= shiftDay(todayKey(), -30)) state.day = r.day;
  if (r.payYm) state.payYm = r.payYm;
  if (r.repYm) state.repYm = r.repYm;
}

async function refreshAll() {
  const res = await Promise.allSettled([loadCourses(), loadStudents(), loadToday(), loadConfig(), loadLeadsData(), loadFees()]);
  state.err.students = res[0].status === 'rejected' || res[1].status === 'rejected';
  if (res[2].status === 'rejected') dayFailed();
  renderCounts();
}

// So'rov xatosi — bo'sh ro'yxat EMAS. Xato bo'lsa eski ma'lumot saqlanadi va xato
// yuqoriga uzatiladi; aks holda internet uzilganda o'quvchilar ro'yxati "yo'qolib"
// qolardi va o'qituvchi belgilangan bolalarni qayta belgilardi.
function rowsOf({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

async function loadCourses() {
  state.courses = rowsOf(await sb.from('courses').select('*').order('sort'));
}
async function loadStudents() {
  state.students = rowsOf(await sb.from('students').select('*').order('full_name'));
}
// Shaxsiy narxlar — faqat admin (RLS o'qituvchiga bo'sh qaytaradi)
async function loadFees() {
  if (!isAdmin()) { state.fees = new Map(); return; }
  const { data, error } = await sb.from('student_fees').select('student_id,monthly_fee');
  if (!error) state.fees = new Map((data ?? []).map((r) => [r.student_id, r.monthly_fee]));
}
async function loadToday() {
  const key = selDay();
  const start = new Date(`${key}T00:00:00+05:00`).toISOString();
  const end = new Date(new Date(start).getTime() + 86400000).toISOString();
  const data = rowsOf(await sb.from('attendance').select('*')
    .gte('occurred_at', start).lt('occurred_at', end).order('occurred_at'));
  // Javob kelguncha boshqa kun tanlangan bo'lsa — eskirgan javobni tashlaymiz
  if (key !== selDay()) return false;
  state.today = data;
  state.loadedDay = key;
  state.err.today = false;
  return true;
}
async function loadLeadsData() {
  state.leads = rowsOf(await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(300));
}

async function loadConfig() {
  const data = rowsOf(await sb.from('app_config').select('key,value').in('key', ['bot_username', 'tg_mode', 'msg_templates']));
  const cfg = Object.fromEntries(data.map((r) => [r.key, r.value]));
  state.botUsername = cfg.bot_username ?? null;
  state.tgMode = cfg.tg_mode ?? null;
  state.tpls = parseTpls(cfg.msg_templates);
}

async function refreshLinks() {
  // Yarim tun o'tdi — "Bugun" endi boshqa kun: belgilarni qayta yuklaymiz
  // (viewToday yangi kunni o'zi yuklay boshlaydi — ensureDay)
  if (state.loadedDay && state.loadedDay !== selDay() && state.view === 'today' && !typing()) render();
  refreshLeadsQuiet(true);
  const before = state.students.filter((s) => s.telegram_chat_id).length;
  try { await loadStudents(); } catch (_) { return; }   // internet yo'q — eski ro'yxat qoladi
  state.err.students = false;
  const after = state.students.filter((s) => s.telegram_chat_id).length;
  if (after !== before) {
    if (after > before) toast(t('parentsLinkedN', { n: after - before }), 'ok');
    if (!typing()) render();
  }
}

// Kun yuklanmadi. Qo'lda shu kunning ma'lumoti bo'lsa (qisqa uzilish) — u qoladi va belgilash
// mumkin. Qo'ldagi ma'lumot boshqa kunniki bo'lsa (masalan, yarim tundan keyin) — uni bugun
// deb ko'rsatmaymiz: ro'yxat tozalanadi va tugmalar yuklanguncha bloklanadi.
function dayFailed() {
  if (state.loadedDay === selDay()) return;
  state.today = [];
  state.err.today = true;
}

// Arizalar: yangi ariza sahifa ochiq turganda ham ko'rinsin (30 soniyalik taymer va
// Arizalar bo'limiga o'tilganda). O'zgarish bo'lsa — hisoblagich va ro'yxat yangilanadi.
let leadsAt = 0;
async function refreshLeadsQuiet(force = false) {
  if (!force && Date.now() - leadsAt < 10000) return;
  leadsAt = Date.now();
  const sig = () => state.leads.map((l) => l.id + l.status).join();
  const before = sig();
  try { await loadLeadsData(); } catch (_) { return; }
  if (sig() === before) return;
  renderCounts();
  if (state.view === 'leads' && !typing() && !$('sheet').open) { $('page').innerHTML = viewLeadsShell(); loadLeads(); }
}

// Foydalanuvchi sahifadagi maydonga yozyaptimi — qayta chizib kursorni buzmaymiz
function typing() {
  const a = document.activeElement;
  return !!a && $('page').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
}

// Ilova qayta ochilganda (telefon qulfdan chiqdi, boshqa ilovadan qaytildi):
// bugungi belgilar, arizalar va o'quvchilarni yangilaymiz — ko'pi bilan 20 soniyada bir
async function refreshOnResume() {
  if (!state.me || Date.now() - state.resumeAt < 20000) return;
  state.resumeAt = Date.now();
  // Kun almashgan bo'lsa (yarim tun) — render() eski belgilarni yashirib, yangi kunni yuklay boshlaydi
  if (state.loadedDay !== selDay() && state.view === 'today') render();
  const sameDay = state.loadedDay === selDay() && !state.dayLoading;
  const res = await Promise.allSettled([loadStudents(), loadLeadsData(), sameDay ? loadToday() : null]);
  if (res[0].status === 'fulfilled') state.err.students = false;
  if (res[2].status === 'rejected') dayFailed();
  renderCounts();
  if (!typing() && ['today', 'leads', 'students'].includes(state.view)) render();
}

/* ============================================================
   NAVIGATSIYA
   ============================================================ */
const VIEWS = [
  { id: 'today',    label: t('navToday'),    icon: 'check', title: t('tToday') },
  { id: 'leads',    label: t('navLeads'),    icon: 'inbox', title: t('tLeads') },
  { id: 'students', label: t('navStudents'), icon: 'users', title: t('tStudents') },
  { id: 'report',   label: t('navReport'),   icon: 'chart', title: t('tReport') },
  { id: 'payments', label: t('navPay'),      icon: 'wallet', title: t('tPay'), admin: true },
  { id: 'team',     label: t('navTeam'),     icon: 'team',  title: t('tTeam'), admin: true },
  { id: 'settings', label: t('navSettings'), icon: 'gear',  title: t('tSettings') },
];

function visibleViews() { return VIEWS.filter((v) => !v.admin || isAdmin()); }

function buildNav() {
  const items = visibleViews();
  $('sideNav').innerHTML = items.map((v) =>
    `<button class="nav-item" data-go="${v.id}" type="button">${I[v.icon]}<span>${v.label}</span>
      <span class="nav-count" data-count="${v.id}" hidden></span></button>`).join('');

  // Telefonda 5 tadan ko'p bo'lsa oxirgilari "Yana" oynasiga tushadi (5 ta bo'lsa — hammasi
  // pastda: o'qituvchi uchun bitta bandli "Yana" oynasi keraksiz qadam edi)
  const MAX = items.length === 5 ? 5 : 4;
  const main = items.length > MAX ? items.slice(0, MAX) : items;
  const rest = items.length > MAX ? items.slice(MAX) : [];
  $('tabbarInner').innerHTML =
    main.map((v) => `<button class="tab-item" data-go="${v.id}" type="button">${I[v.icon]}<span>${v.label}</span>
      <span class="nav-count" data-count="${v.id}" hidden></span></button>`).join('') +
    (rest.length ? `<button class="tab-item" id="moreTab" type="button">${I.dots}<span>${t('navMore')}</span></button>` : '');

  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  const more = $('moreTab');
  if (more) more.addEventListener('click', () => {
    openSheet(t('navMore'), `<div class="check-list">${rest.map((v) =>
      `<button class="check-item" data-go-more="${v.id}" type="button">${I[v.icon]}<span>${v.label}</span></button>`).join('')}</div>`,
      () => document.querySelectorAll('[data-go-more]').forEach((b) =>
        b.addEventListener('click', () => { closeSheet(); go(b.dataset.goMore); })));
  });
}

// Yangi arizalar sonini navigatsiyada ko'rsatamiz
function renderCounts() {
  const n = state.leads.filter((l) => l.status === 'new').length;
  document.querySelectorAll('[data-count="leads"]').forEach((el) => {
    el.textContent = n;
    el.hidden = n === 0;
  });
}

/* ---------------- Sarlavhadagi boshqaruvlar ---------------- */

// Til tugmasi: hozirgi tilning kodi + ro'yxat
function renderLangBtn() {
  const l = currentLang();
  const ico = $('langIco'); if (ico) ico.innerHTML = I.globe;
  const code = $('langCode'); if (code) code.textContent = l.toUpperCase();
  $('langBtn')?.setAttribute('aria-label', t('setLang'));
  const menu = $('langMenu');
  if (menu) menu.innerHTML = LANGS.map((x) =>
    `<button class="menu-item ${x === l ? 'on' : ''}" data-lang="${x}" role="menuitem" type="button">
      <span>${LANG_NAME[x]}</span>${x === l ? I.check : ''}</button>`).join('');
}

// Hisob tugmasi: avatar + ism, rol, email va chiqish
function renderUserCard() {
  const me = state.me;
  if (!me) return;
  const name = me.full_name || me.email.split('@')[0];
  const av = $('userInitials');
  if (av) { av.textContent = initials(name); av.style.setProperty('--acc', 'var(--gold)'); }
  const menu = $('userMenu');
  if (menu) menu.innerHTML = `
    <div class="menu-head">
      <span class="avatar" style="--acc:var(--gold)">${esc(initials(name))}</span>
      <span class="menu-who"><b>${esc(name)}</b><small>${isAdmin() ? t('roleAdmin') : t('roleTeacher')}</small></span>
    </div>
    <div class="menu-mail">${esc(me.email)}</div>
    <button class="menu-item danger" id="logoutBtn" role="menuitem" type="button">${I.out}<span>${t('logout')}</span></button>`;
}

// Bitta vaqtda bitta menyu ochiq turadi
function closeMenus(except) {
  document.querySelectorAll('.menu').forEach((m) => {
    if (m === except) return;
    m.hidden = true;
    m.previousElementSibling?.setAttribute('aria-expanded', 'false');
  });
}

function toggleMenu(btn, menu) {
  const open = menu.hidden;
  closeMenus(open ? menu : null);
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

function go(view) {
  if (!visibleViews().some((v) => v.id === view)) view = 'today';
  state.view = view;
  history.replaceState(null, '', '#' + view);
  document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  // Bo'lim "Yana" ichida bo'lsa — "Yana" tugmasi faol ko'rinadi
  $('moreTab')?.classList.toggle('active', !document.querySelector(`.tabbar [data-go="${view}"]`));
  $('pageTitle').textContent = VIEWS.find((v) => v.id === view).title;
  $('pageTitle').title = $('pageTitle').textContent;
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  try { renderView(); } catch (err) {
    console.error(err);
    $('page').innerHTML = `<div class="card"><div class="empty"><div class="e-ico">⚠️</div>
      <b>${t('error')}</b><p>${esc(err.message)}</p>
      <button class="btn btn-primary" data-retry type="button">${t('retry')}</button></div></div>`;
  }
}

function renderView() {
  const el = $('page');
  if (state.view === 'today') {
    el.innerHTML = viewToday();
    $('pageTitle').textContent = isToday() ? t('tToday') : t('navToday');
  }
  else if (state.view === 'leads') { el.innerHTML = viewLeadsShell(); loadLeads(); refreshLeadsQuiet(); }
  else if (state.view === 'students') el.innerHTML = viewStudents();
  else if (state.view === 'report') { el.innerHTML = viewReportShell(); loadReport(); }
  else if (state.view === 'payments') { el.innerHTML = viewPayShell(); loadPayments(); }
  else if (state.view === 'team') { el.innerHTML = viewTeamShell(); loadTeam(); }
  else { el.innerHTML = viewSettings(); if (isAdmin()) { loadNotifyChats(); tplLive(); checkWebhook(false); } }
}

/* ============================================================
   KO'RINISH: BUGUNGI DAVOMAT
   ============================================================ */
function courseChips() {
  const list = myCourses();
  if (list.length <= 1) return '';
  const chip = (id, label, icon, color) =>
    `<button class="chip ${state.courseFilter === id ? 'on' : ''}" style="--acc:var(--${color})" data-chip="${id}" type="button">${icon ? icon + ' ' : ''}${esc(label)}</button>`;
  return `<div class="chips">${chip('all', t('all'), '', 'gold')}${list.map((c) => chip(c.id, c.name, cIcon(c), c.color)).join('')}</div>`;
}

// Qidiruv uchun: katta-kichik harf va apostrof turlari farq qilmaydi — iPhone ’ (U+2019),
// o'zbekcha ʻ (U+02BB) va oddiy ' bir xil: "G'afurova" "G’af" bilan ham topiladi
const fold = (v) => String(v ?? '').toLowerCase().replace(/[ʻʼ’‘`´']/g, "'");

// closed — admin uchun yopiq kurslar o'quvchilari ham (O'quvchilar bo'limida ko'chirish/arxivlash uchun)
function visibleStudents({ closed = false } = {}) {
  const allowed = new Set((closed && isAdmin() ? state.courses : myCourses()).map((c) => c.id));
  const q = fold(state.search.trim());
  return state.students.filter((s) =>
    allowed.has(s.course_id) &&
    (state.courseFilter === 'all' || s.course_id === state.courseFilter) &&
    (!q || fold(s.full_name).includes(q)));
}

const recFor = (sid, kind) => state.today.find((r) => r.student_id === sid && r.kind === kind);
// Yangi belgi o'sha kundagi qaysi belgilarni o'chiradi — mark-attendance dagi REPLACES bilan bir xil
const REPLACES = { in: ['absent', 'excused'], out: [], absent: ['in', 'out', 'excused'], excused: ['in', 'out', 'absent'] };
// "Keldi" o'chsa, unga bog'liq "Ketdi" ham o'chadi — aks holda yetim "Ketdi" qoladi
function withDependents(ids) {
  const out = new Set(ids);
  for (const id of ids) {
    const r = state.today.find((x) => x.id === id);
    if (r?.kind === 'in') state.today.filter((x) => x.student_id === r.student_id && x.kind === 'out').forEach((x) => out.add(x.id));
  }
  return [...out];
}
// "Kelmadi"/"Sababli" bugungi "Keldi/Ketdi"ni o'chiradi — kelgan-ketgan vaqti yo'qolmasin, oldin so'raymiz.
// Kelmadi ↔ Sababli almashtirish (ota-ona sababini aytdi) odatiy tuzatish — so'ralmaydi.
function confirmReplace(sid, kind) {
  const gone = state.today.filter((r) => r.student_id === sid && REPLACES[kind].includes(r.kind) &&
    (r.kind === 'in' || r.kind === 'out'));
  if (!gone.length) return true;
  const s = state.students.find((x) => x.id === sid);
  const cur = gone.map((r) => MARKS[r.kind].label +
    ((r.kind === 'in' || r.kind === 'out') && isToday() ? ' ' + hhmm(r.occurred_at) : '')).join(', ');
  return confirm(t('replaceAsk', { name: s?.full_name ?? '', cur, label: MARKS[kind].label }));
}
const dayStatus = (sid) => state.today.find((r) => r.student_id === sid && (r.kind === 'absent' || r.kind === 'excused'));

// Davomat holatlari
// Har bir holatning o'z rangi va ikonkasi — butun panelda shu manbadan olinadi
const MARKS = {
  in:      { label: t('mIn'),      icon: 'check', tone: 'green'  },
  out:     { label: t('mOut'),     icon: 'home2', tone: 'gold'   },
  absent:  { label: t('mAbsent'),  icon: 'alert', tone: 'red'    },
  excused: { label: t('mExcused'), icon: 'note',  tone: 'violet' },
};
const DONE = { label: t('mDone'), icon: 'checks', tone: 'muted' };
const ico = (m) => I[m.icon];

// Statistika kartasi: raqam + ikonka, rangi holatdan
const statTile = (n, label, icon, tone) =>
  `<div class="stat${tone ? ' tone-' + tone : ''}"><b>${n}</b>
    <span>${I[icon] ?? ''}${label}</span></div>`;

// Hisobotdagi kun belgisi: "12.09" + holat rangi/ikonkasi
const pill = (kind, day, note) => {
  const m = MARKS[kind];
  return `<span class="day-pill tone-${m.tone}"${note ? ` title="${esc(note)}"` : ''}>${ico(m)}
    ${day.slice(8)}.${day.slice(5, 7)}${note ? ' · ' + esc(note) : ''}</span>`;
};

// "Sababli" uchun tayyor sabablar
const REASONS = [t('r1'), t('r2'), t('r3'), t('r4')];

// Kun tanlagich: < kun > va sana maydoni. Bugundan keyingi kunga o'tib bo'lmaydi.
function dayBar() {
  const key = selDay();
  const atToday = isToday();
  return `
    <div class="daybar">
      <button class="daybar-nav" data-day-shift="-1" type="button" aria-label="${t('prevDay')}">${I.chevL || '‹'}</button>
      <label class="daybar-mid">
        <span class="daybar-label">${esc(dayLabel(key))}</span>
        <span class="daybar-sub">${esc(weekdayOf(key))}</span>
        <input type="date" id="dayPick" value="${key}" min="${shiftDay(todayKey(), -30)}" max="${todayKey()}" aria-label="${t('pickDay')}">
      </label>
      <button class="daybar-nav" data-day-shift="1" type="button" aria-label="${t('nextDay')}" ${atToday ? 'disabled' : ''}>${I.chevR || '›'}</button>
    </div>
    ${atToday ? '' : `<div class="daybar-note">${I.note}<span>${t('pastDay')}</span>
      <button class="daybar-back" id="dayToday" type="button">${t('backToToday')}</button></div>`}`;
}

// Tanlangan kun hali yuklanmagan (masalan, ilova ochiq turganda yarim tun o'tdi) —
// eski kunning belgilarini bugun deb ko'rsatmaymiz: yuklanish holati va yangi so'rov
function ensureDay() {
  if (!state.loadedDay || state.loadedDay === selDay() || state.dayLoading || state.err.today) return;
  state.dayLoading = true;
  state.today = [];
  queueMicrotask(() => setDay(selDay()));
}

// Bugungi ekranning o'zgaruvchan qismlari: statistika va ro'yxat. Qidiruvda faqat shular
// qayta chiziladi — qidiruv maydonining o'zi almashtirilmaydi (Android klaviaturasi so'zni
// "yig'ib" turganda maydon almashsa, yozilgan harflar ikkilanib ketardi).
function todayParts() {
  const list = visibleStudents().filter((s) => s.active);
  const ids = new Set(list.map((s) => s.id));
  const seen = (kind) => new Set(state.today.filter((r) => r.kind === kind && ids.has(r.student_id)).map((r) => r.student_id));
  const inCount = seen('in').size;
  const absentCount = seen('absent').size;
  const excusedCount = seen('excused').size;
  const pending = Math.max(0, list.length - inCount - absentCount - excusedCount);

  const groups = {};
  list.forEach((s) => { (groups[s.course_id] ??= []).push(s); });
  // Kun yuklanayotganda yoki yuklanmay qolganda belgilash mumkin emas —
  // aks holda allaqachon belgilangan bolalar qayta belgilanadi
  const busy = state.dayLoading || state.err.today;
  const failed = state.err.today || (state.err.students && !state.students.length);
  const errCard = failed
    ? `<div class="card load-err" role="alert"><div class="empty"><div class="e-ico">⚠️</div><b>${t('loadFail')}</b>
       <button class="btn btn-primary" data-retry type="button">${t('retry')}</button></div></div>` : '';

  const body = failed && !list.length ? ''
    : !list.length
    ? `<div class="card"><div class="empty"><div class="e-ico">🧑‍🎓</div><b>${t('noStudentT')}</b>
       <p>${state.search ? t('noSearch') : t('addFirst')}</p>
       ${state.search ? '' : `<button class="btn btn-primary" data-add-student type="button">${I.plus} ${t('addStudent')}</button>`}</div></div>`
    : Object.entries(groups).map(([cid, arr]) => {
      const c = courseById(cid);
      // Hali hech qanday belgi qo'yilmaganlar bo'lsa — guruhni bir bosishda "Keldi".
      // Kelmadi/Sababli qo'yilganlar bunga kirmaydi: kasal bolaning ota-onasiga "keldi" xabari ketmasin.
      const left = busy ? 0 : arr.filter((s) => !state.today.some((r) => r.student_id === s.id)).length;
      return `<div class="group-title">
          <span title="${esc(c.name)}">${cIcon(c)} ${esc(c.name)} · ${arr.length}</span>
          ${left ? `<button class="btn btn-sm btn-tone tone-green" data-group-mark="${cid}" type="button">
            ${ico(MARKS.in)} ${t('allArrived')} · ${left}</button>` : ''}
        </div>
        <div class="rows">${arr.map((s) => rowToday(s, c)).join('')}</div>`;
    }).join('');

  const stats = `
      ${statTile(list.length, t('sStudents'), 'users')}
      ${statTile(inCount, MARKS.in.label, MARKS.in.icon, MARKS.in.tone)}
      ${statTile(absentCount, MARKS.absent.label, MARKS.absent.icon, MARKS.absent.tone)}
      ${statTile(excusedCount, MARKS.excused.label, MARKS.excused.icon, MARKS.excused.tone)}
      ${statTile(pending, t('sPending'), 'clock')}`;
  const listHtml = `${errCard}<div class="today-list"${state.dayLoading ? ' aria-busy="true"' : ''}>${body}</div>`;
  return { stats, listHtml };
}

function viewToday() {
  ensureDay();
  const dateTxt = uzDate(new Date(`${selDay()}T00:00:00+05:00`));
  if (!myCourses().length) {
    return `<div class="page-head"><div><h2>${t('tToday')}</h2><p>${dateTxt}</p></div></div>
      <div class="card"><div class="empty"><div class="e-ico">🔒</div><b>${t('noCourseT')}</b>
      <p>${t('noCourseP')}</p></div></div>`;
  }
  const p = todayParts();
  return `
    <div class="page-head">
      <div><h2>${isToday() ? t('tToday') : t('navToday')}</h2></div>
      <div class="spacer"></div>
    </div>
    ${dayBar()}
    <div class="stats stats-compact" id="todayStats">${p.stats}
    </div>
    ${courseChips()}
    <label class="field" style="margin:14px 0">
      <span class="sr-only">${t('search')}</span>
      <input class="inp" id="searchInp" placeholder="${t('searchStudent')}" value="${esc(state.search)}">
    </label>
    <div id="todayBody">${p.listHtml}</div>`;
}

// Qidiruv natijasi: maydonga tegmay, faqat ro'yxat va hisoblagichlar
function renderSearchResults() {
  if (state.view === 'today' && $('todayBody')) {
    const p = todayParts();
    $('todayStats').innerHTML = p.stats;
    $('todayBody').innerHTML = p.listHtml;
  } else if (state.view === 'students' && $('stList')) {
    const list = visibleStudents({ closed: true });
    $('stShown').textContent = t('shownN', { n: list.length });
    $('stList').innerHTML = studentsListHtml(list);
  } else render();
}

// Har bir qatorda bitta katta tugma: keyin nima qilish kerakligini ko'rsatadi.
// Qolgan hamma narsa (kelmadi, sababli, bekor qilish) "⋯" oynasida.
function nextAction(sid) {
  if (!recFor(sid, 'in'))  return { kind: 'in',  ...MARKS.in };
  if (!recFor(sid, 'out')) return { kind: 'out', ...MARKS.out };
  return null;                                  // kuni tugadi
}

function rowToday(s, c) {
  const rin = recFor(s.id, 'in');
  const rout = recFor(s.id, 'out');
  const away = dayStatus(s.id);
  const act = nextAction(s.id);
  const marked = state.today.some((r) => r.student_id === s.id);

  // Hozirgi holat: rangi, ikonkasi va matni shu yerdan
  const cur = away ? MARKS[away.kind] : (rout ? DONE : (rin ? MARKS.in : null));
  const tone = cur ? cur.tone : 'pending';
  // Bugun — aniq soat bor. O'tgan kun — faqat holat nomi (soat yozilmagan).
  const text =
      state.dayLoading ? t('loading')
    : away ? MARKS[away.kind].label + (away.note ? ' · ' + esc(away.note) : '')
    : !isToday() ? (rout ? DONE.label : rin ? MARKS.in.label : t('fresh'))
    // "Ketdi" bor-u "Keldi" yo'q (boshqa qurilmadan o'chirilgan) — sahifa yiqilmasin
    : rout ? (rin ? `${hhmm(rin.occurred_at)} → ${hhmm(rout.occurred_at)}` : `${DONE.label} · ${hhmm(rout.occurred_at)}`)
    : rin  ? t('sinceHere', { time: hhmm(rin.occurred_at) })
    :        t('fresh');

  // Ikkilamchi holatlar ham ko'rinib turadi — hech narsa yashirin emas
  const alt = (kind) => {
    const m = MARKS[kind];
    return `<button class="btn btn-alt btn-tone tone-${m.tone}" data-set="${kind}" data-id="${s.id}"
      ${away?.kind === kind ? 'disabled' : ''}${lock} type="button">${ico(m)} ${m.label}</button>`;
  };

  // Belgi qo'yilgan bo'lsa, qatorni bosish bekor qilish oynasini ochadi
  const openAttr = marked ? ` data-more="${s.id}"` : '';

  const pending = state.today.some((r) => r.student_id === s.id && r._pending);
  // Saqlanayotganda (ikki marta bosish), kun yuklanayotganda yoki yuklanmay qolganda — tugmalar o'chiq
  const lock = pending || state.dayLoading || state.err.today ? ' disabled' : '';

  return `<div class="row rt tone-${tone}${marked ? '' : ' is-fresh'}${pending ? ' is-pending' : ''}"${openAttr}>
    <div class="avatar" style="--acc:var(--${c.color})">${esc(initials(s.full_name))}</div>
    <div class="row-main">
      <div class="row-title">${esc(s.full_name)}
        ${s.telegram_chat_id ? '' : `<span class="badge b-mute" title="${t('noTg')}">${I.bell}</span>`}</div>
      <div class="row-sub">
        ${marked
          ? `<button class="rt-status"${openAttr} type="button"
              aria-label="${esc(t('marksOf', { name: s.full_name }))}">${ico(cur)}${text}${I.chev}</button>`
          : `<span class="rt-status is-plain">${text}</span>`}
      </div>
    </div>
    <div class="row-actions">
      ${alt('absent')}
      ${alt('excused')}
      ${act
        ? `<button class="btn btn-act btn-tone tone-${act.tone}" data-mark="${act.kind}" data-id="${s.id}"${lock} type="button">${ico(act)} ${act.label}</button>`
        : `<span class="act-done">${ico(DONE)} ${DONE.label}</span>`}
    </div>
  </div>`;
}

/* ---- Bugungi belgilar: bekor qilish oynasi ---- */
function markSheet(id) {
  const s = state.students.find((x) => x.id === id);
  if (!s) return;
  const marked = state.today.filter((r) => r.student_id === s.id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  if (!marked.length) return;

  const when = (r) => (r.kind === 'in' || r.kind === 'out')
    ? (isToday() ? hhmm(r.occurred_at) : dayLabel(selDay()))
    : (r.note || MARKS[r.kind].label);

  openSheet(esc(s.full_name), `
    <p class="card-desc">${t('marksHint')}</p>
    <div class="rows">${marked.map((r) => {
      const m = MARKS[r.kind];
      return `<div class="row mk-row tone-${m.tone}">
        <span class="mk-ico">${ico(m)}</span>
        <div class="row-main">
          <div class="row-title">${m.label}</div>
          <div class="row-sub"><span>${esc(when(r))}</span></div>
        </div>
        <button class="btn btn-sm btn-danger" data-undo="${r.id}" aria-label="${esc(t('undoAria', { label: m.label }))}"${r._pending ? ' disabled' : ''} type="button">${I.trash}</button>
      </div>`;
    }).join('')}</div>`, () => {
    document.querySelectorAll('[data-undo]').forEach((btn) => btn.addEventListener('click', async () => {
      const ids = withDependents([btn.dataset.undo]);
      if (ids.length > 1 && !confirm(t('undoAlsoOut', { in: MARKS.in.label, out: MARKS.out.label }))) return;
      btn.disabled = true;
      const { error } = await sb.from('attendance').delete().in('id', ids);
      if (error) { toast('❌ ' + error.message, 'bad'); btn.disabled = false; return; }
      try { await loadToday(); } catch (_) { state.today = state.today.filter((x) => !ids.includes(x.id)); }
      render();
      toast(t('undone'), 'ok');
      if (state.today.some((r) => r.student_id === s.id)) markSheet(s.id); else closeSheet();
    }));
  });
}

/* ---- "Sababli" bosilganda: sababini so'raymiz ---- */
function reasonSheet(s) {
  const m = MARKS.excused;
  openSheet(esc(t('reasonOf', { name: s.full_name })), `
    <form id="mkForm">
    <div class="chips" style="margin-bottom:14px">
      ${REASONS.map((r) => `<button class="chip" style="--acc:var(--violet)" data-reason="${esc(r)}" type="button">${esc(r)}</button>`).join('')}
    </div>
    <label class="field"><span>${t('reason')}</span>
      <input class="inp" id="mkNote" maxlength="200" placeholder="${t('reasonPh')}">
      <small class="f-hint">${t('reasonHint')}</small></label>
    <button class="btn btn-tone tone-${m.tone} btn-block" id="mkSave" type="submit">${ico(m)} ${t('markAs', { label: m.label })}</button>
    </form>`, () => {
    document.querySelectorAll('[data-reason]').forEach((b) => b.addEventListener('click', () => {
      $('mkNote').value = b.dataset.reason;
      document.querySelectorAll('[data-reason]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('mkForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const note = $('mkNote').value.trim();
      closeSheet(); sendMark(s.id, 'excused', note);
    });
  });
}

async function sendMark(studentId, kind, note) {
  // Oldingi bosish hali saqlanmoqda — ikkinchi bosish "Ketdi"ni belgilab yubormasin
  if (state.today.some((r) => r.student_id === studentId && r._pending)) return;
  if (state.dayLoading || state.err.today) return;
  const s = state.students.find((x) => x.id === studentId);

  // Darhol ko'rsatamiz — server javobini kutmaymiz. Xato bo'lsa qaytaramiz.
  const optimistic = {
    id: 'tmp-' + studentId + '-' + kind,
    student_id: studentId, kind, note: note || null,
    occurred_at: new Date().toISOString(),
    _pending: true,
  };
  const before = state.today;
  const gone = (r) => r.student_id === studentId && (r.kind === kind || REPLACES[kind].includes(r.kind));
  state.today = [...state.today.filter((r) => !gone(r)), optimistic];
  render();

  try {
    const r = await edge('mark-attendance', { student_id: studentId, kind, note, date: state.day || undefined });
    try { await loadToday(); }
    catch (_) {
      // Belgi saqlandi, faqat ro'yxat yangilanmadi — server javobidan qo'yamiz
      state.today = [...before.filter((x) => !gone(x)),
        { id: r.id, student_id: studentId, kind, note: r.note ?? null, occurred_at: r.occurred_at }];
    }
    render();

    const v = { name: s?.full_name ?? '', label: MARKS[kind].label };
    const msg = r.notified ? t('sentToParent', v)
                           : t('markedOk', v) + (isToday() && !r.muted && !s?.telegram_chat_id ? t('tgOff') : '');
    toast(msg, 'ok', r.id ? { fn: () => undoMark(r) } : undefined);
  } catch (err) {
    state.today = before;                       // qaytaramiz
    // Boshqa qurilmadan allaqachon belgilangan — ro'yxatni yangilaymiz, aks holda har urinish shu xato
    if (err.status === 409) { try { await loadToday(); } catch (_) {} }
    render();
    toast('❌ ' + err.message, 'bad');
  }
}

// Toastdagi "Bekor qilish": yangi belgini o'chiradi. Agar u boshqa belgilarni almashtirgan
// bo'lsa (masalan, "Kelmadi" — "Keldi/Ketdi"ni), server ularni asl vaqti bilan qaytaradi.
async function undoMark(r) {
  const before = state.today;
  const ids = withDependents([r.id]);
  state.today = state.today.filter((x) => !ids.includes(x.id));
  render();
  try {
    if (r.replaced?.length) {
      await edge('mark-attendance', { undo_id: r.id, restore: r.replaced });
    } else {
      const { error } = await sb.from('attendance').delete().in('id', ids);
      if (error) throw error;
    }
  } catch (err) { state.today = before; render(); toast('❌ ' + err.message, 'bad'); return; }
  try { await loadToday(); } catch (_) {}
  render();
  toast(t('undone'), 'ok');
}

// Kunni almashtirish: kelajakka o'tkazmaymiz. Javob kelguncha tugmalar bloklanadi.
async function setDay(key) {
  // Kelajak yoki 30 kundan eski kun — server baribir rad etadi; maydonni joriy kunga qaytaramiz
  if (!key || key > todayKey() || key < shiftDay(todayKey(), -30)) {
    if (key && key < shiftDay(todayKey(), -30)) toast(t('tooOld'));
    if ($('dayPick')) $('dayPick').value = selDay();
    return;
  }
  state.day = key === todayKey() ? null : key;
  state.today = [];
  state.dayLoading = true;
  state.err.today = false;
  render();
  try { await loadToday(); }
  catch (_) { if (key === selDay()) state.err.today = true; }
  if (key !== selDay()) return;               // boshqa kun tanlandi — o'sha chaqiruv yakunlaydi
  state.dayLoading = false;
  render();
}

/* ---- Butun guruhni bir bosishda belgilash ---- */
async function sendGroupMark(courseId, kind) {
  const c = courseById(courseId);
  if (state.dayLoading || state.err.today) return;
  // Faqat bugun hali hech qanday belgi qo'yilmaganlar: "Kelmadi"/"Sababli" qo'yilgan
  // bolani "Keldi" qilib, ota-onasiga noto'g'ri xabar yubormaymiz
  const targets = visibleStudents()
    .filter((s) => s.active && s.course_id === courseId)
    .filter((s) => !state.today.some((r) => r.student_id === s.id));

  if (!targets.length) { toast(t('groupNone')); return; }
  if (!confirm(t('groupAsk', { course: c.name, n: targets.length, label: MARKS[kind].label }))) return;

  const btn = document.querySelector(`[data-group-mark="${courseId}"]`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }

  try {
    // Server bir so'rovda ko'pi bilan 60 ta o'quvchini qabul qiladi
    let marked = 0, skipped = 0;
    for (let i = 0; i < targets.length; i += 60) {
      const r = await edge('mark-attendance', {
        student_ids: targets.slice(i, i + 60).map((s) => s.id), kind, date: state.day || undefined,
      });
      marked += r.marked ?? 0; skipped += r.skipped ?? 0;
    }
    try { await loadToday(); } catch (_) {}
    render();
    toast(skipped ? t('groupDoneSkip', { n: marked, k: skipped }) : t('groupDone', { n: marked }), 'ok');
  } catch (err) {
    try { await loadToday(); } catch (_) {}
    render();
    toast('❌ ' + err.message, 'bad');
  }
}


/* ============================================================
   KO'RINISH: ARIZALAR
   ============================================================ */
const LEAD_STATUS = {
  new:       { label: t('lNew'),       badge: 'badge-warn' },
  contacted: { label: t('lContacted'), badge: '' },
  enrolled:  { label: t('lEnrolled'),  badge: 'badge-ok' },
  rejected:  { label: t('lRejected'),  badge: '' },
};

function viewLeadsShell() {
  const counts = { all: state.leads.length };
  Object.keys(LEAD_STATUS).forEach((k) => { counts[k] = state.leads.filter((l) => l.status === k).length; });
  const chip = (id, label) =>
    `<button class="chip ${state.leadFilter === id ? 'on' : ''}" style="--acc:var(--gold)" data-lead-filter="${id}" type="button">${label} ${counts[id] ? `· ${counts[id]}` : ''}</button>`;
  return `
    <div class="page-head">
      <div><h2>${t('tLeads')}</h2><p>${t('leadsSub')}</p></div>
    </div>
    <div class="chips">
      ${Object.entries(LEAD_STATUS).map(([k, v]) => chip(k, v.label)).join('')}${chip('all', t('all'))}
    </div>
    <div id="leadsOut" style="margin-top:16px"></div>`;
}

function loadLeads() {
  const list = state.leadFilter === 'all'
    ? state.leads
    : state.leads.filter((l) => l.status === state.leadFilter);

  if (!list.length) {
    $('leadsOut').innerHTML = `<div class="card"><div class="empty"><div class="e-ico">\u{1F4ED}</div>
      <b>${t('noLeadT')}</b><p>${state.leadFilter === 'new' ? t('noLeadNew') : t('noLeadOther')}</p></div></div>`;
    return;
  }

  $('leadsOut').innerHTML = `<div class="rows">${list.map((l) => {
    const c = l.course_id ? courseById(l.course_id) : null;
    const st = LEAD_STATUS[l.status] || LEAD_STATUS.new;
    const when = uzDate(l.created_at) + ', ' + hhmm(l.created_at);
    return `<div class="row">
      <div class="avatar" style="--acc:var(--${c ? c.color : 'gold'})">${esc(initials(l.full_name))}</div>
      <div class="row-main">
        <div class="row-title">${esc(l.full_name)}
          <span class="badge ${st.badge}">${st.label}</span>
          ${c ? `<span class="badge badge-course" style="--acc:var(--${c.color})">${cIcon(c)} ${esc(c.name)}</span>` : ''}</div>
        <div class="row-sub">
          <span>\u{1F4DE} ${esc(l.phone)}</span>
          ${l.preferred_time ? `<span>\u23F0 ${esc(l.preferred_time)}</span>` : ''}
          <span>${when}</span>
        </div>
        ${l.note ? `<div class="row-sub"><span>\u{1F4AC} ${esc(l.note)}</span></div>` : ''}
      </div>
      <div class="row-actions">
        <a class="btn btn-sm btn-green" href="tel:${esc(l.phone)}">${I.phone} ${t('call')}</a>
        <button class="btn btn-sm btn-ico" data-lead="${l.id}" aria-label="${esc(t('edit') + ': ' + l.full_name)}" title="${t('edit')}" type="button">${I.edit}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function leadSheet(id) {
  const l = state.leads.find((x) => x.id === id);
  if (!l) return;
  openSheet(esc(l.full_name), `
    <div class="card" style="margin-bottom:14px">
      <div class="row-sub"><span>\u{1F4DE} <a href="tel:${esc(l.phone)}">${esc(l.phone)}</a></span></div>
      ${l.note ? `<div class="row-sub" style="margin-top:6px"><span>\u{1F4AC} ${esc(l.note)}</span></div>` : ''}
      <div class="row-sub" style="margin-top:6px"><span>${uzDate(l.created_at)}, ${hhmm(l.created_at)}</span></div>
    </div>
    <div class="field"><span>${t('status')}</span>
      <div class="check-list">${Object.entries(LEAD_STATUS).map(([k, v]) =>
        `<button class="check-item" data-lead-status="${k}" type="button">
          ${l.status === k ? '\u2705' : '\u25CB'} <span>${v.label}</span></button>`).join('')}</div>
    </div>
    ${isAdmin() ? `<button class="btn btn-danger btn-block" style="margin-top:10px" data-lead-del="${l.id}" type="button">${I.trash} ${t('del')}</button>` : ''}
  `, () => {
    document.querySelectorAll('[data-lead-status]').forEach((b) => b.addEventListener('click', async () => {
      const { error } = await sb.from('leads')
        .update({ status: b.dataset.leadStatus, handled_by: state.me.email }).eq('id', l.id);
      if (error) { toast('\u274C ' + error.message, 'bad'); return; }
      closeSheet(); toast(t('statusUpdated'), 'ok');
      await loadLeadsData(); renderCounts(); render();
    }));
    const del = document.querySelector('[data-lead-del]');
    if (del) del.addEventListener('click', async () => {
      if (!confirm(t('delLead'))) return;
      // RLS ruxsat bermasa xato emas, 0 qator qaytadi — buni ham muvaffaqiyatsizlik deb bilamiz
      const { data, error } = await sb.from('leads').delete().eq('id', l.id).select('id');
      if (error || !data?.length) { toast('\u274C ' + (error?.message || t('error')), 'bad'); return; }
      closeSheet(); toast(t('deleted'), 'ok');
      await loadLeadsData(); renderCounts(); render();
    });
  });
}

/* ============================================================
   KO'RINISH: O'QUVCHILAR
   ============================================================ */
function studentsListHtml(list) {
  return list.length ? `<div class="rows">${list.map(rowStudent).join('')}</div>`
    : `<div class="card"><div class="empty"><div class="e-ico">🧑‍🎓</div><b>${t('noStudentsT')}</b>
       <p>${t('addFirstOne')}</p>
       <button class="btn btn-primary" data-add-student type="button">${I.plus} ${t('addStudent')}</button></div></div>`;
}

function viewStudents() {
  const list = visibleStudents({ closed: true });
  if (!myCourses().length && !(isAdmin() && list.length)) {
    return `<div class="page-head"><div><h2>${t('tStudents')}</h2></div></div>
      <div class="card"><div class="empty"><div class="e-ico">🔒</div><b>${t('noCourseT')}</b></div></div>`;
  }
  return `
    <div class="page-head">
      <div><h2>${t('tStudents')}</h2><p id="stShown">${t('shownN', { n: list.length })}</p></div>
      <div class="spacer"></div>
      <button class="btn btn-primary" data-add-student type="button">${I.plus} ${t('add')}</button>
    </div>
    ${courseChips()}
    <label class="field" style="margin:14px 0">
      <span class="sr-only">${t('search')}</span>
      <input class="inp" id="searchInp" placeholder="${t('searchPh')}" value="${esc(state.search)}">
    </label>
    <div id="stList">${studentsListHtml(list)}</div>`;
}

function rowStudent(s) {
  const c = courseById(s.course_id);
  return `<div class="row">
    <div class="avatar" style="--acc:var(--${c.color})">${esc(initials(s.full_name))}</div>
    <div class="row-main">
      <div class="row-title">${esc(s.full_name)}
        <span class="badge badge-course" style="--acc:var(--${c.color})">${cIcon(c)} ${esc(c.name)}</span>
        ${s.active ? '' : `<span class="badge">${t('archive')}</span>`}
        ${c.active === false ? `<span class="badge badge-warn">${t('courseClosed')}</span>` : ''}
        ${s.telegram_chat_id
          ? `<span class="badge badge-ok">${t('tgLinked')}</span>`
          : `<span class="badge badge-warn">${s.parent_phone ? t('tgNotLinked') : t('tgNoPhone')}</span>`}
      </div>
      <div class="row-sub">
        ${s.parent_name ? `<span>👤 ${esc(s.parent_name)}</span>` : ''}
        ${s.parent_phone ? `<span>📞 ${esc(s.parent_phone)}</span>` : ''}
        ${isAdmin() && Number.isInteger(state.fees.get(s.id)) ? `<span class="st-fee">💰 ${t('perMonth', { n: fmtSum(state.fees.get(s.id)) })}</span>` : ''}
      </div>
    </div>
    <div class="row-actions">
      ${state.botUsername
        ? `<button class="btn btn-sm btn-ico" data-link="${s.id}" title="${t('parentLink')}" aria-label="${esc(t('parentLink') + ': ' + s.full_name)}" type="button">${I.link}</button>` : ''}
      <button class="btn btn-sm btn-ico" data-edit-student="${s.id}" title="${t('edit')}" aria-label="${esc(t('edit') + ': ' + s.full_name)}" type="button">${I.edit}</button>
    </div>
  </div>`;
}

/* ============================================================
   KO'RINISH: HISOBOT
   ============================================================ */
function viewReportShell() {
  const list = myCourses();
  return `
    <div class="page-head">
      <div><h2>${t('tReport')}</h2><p>${t('reportSub')}</p></div>
      <div class="spacer"></div>
      <button class="btn" id="csvBtn" type="button">${I.download} CSV</button>
    </div>
    <div class="rep-filters">
      <label class="field">
        <span>${t('month')}</span>
        <input class="inp" type="month" id="repMonth" value="${repData?.ym || state.repYm || currentYm()}" max="${currentYm()}">
      </label>
      ${list.length > 1 ? courseChips() : ''}
    </div>
    <div id="repOut" style="margin-top:16px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
}

let repData = null;
let repSeq = 0;

// Supabase bir so'rovda ko'pi bilan 1000 qator qaytaradi — undan ortig'i jimgina tushib
// qolardi (tashriflar kam, to'lagan o'quvchi qarzdor ko'rinardi). Sahifalab o'qiymiz.
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = rowsOf(await build().range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/* ------------------------------------------------------------
   Hisob-kitob.
   Jadval (dars kunlari) bazada yo'q, shuning uchun har bir kursning
   ish kunlari — o'sha kurs o'quvchilaridan kimdir belgilangan kunlar.
   Avval butun markaz kunlari olinardi: Dasturlash Du/Chor/Ju, Shaxmat
   Se/Pay/Sh o'qisa, markaz haftada 6 kun "ishlaydi" va har kuni kelgan
   o'quvchi ham ~50% olardi.
   ------------------------------------------------------------ */
async function loadReport() {
  const ym = $('repMonth')?.value || currentYm();
  const out = $('repOut');
  // Qayta yuklashda eski ko'rinish so'niq turadi — sakrash va miltillash yo'q
  if (out && repData) out.classList.add('is-loading');

  const seq = ++repSeq;
  const [from, to] = monthRange(ym);
  let data = null, error = null;
  // "Ketdi" hisobotda kerak emas — so'rov ikki baravar yengil
  try {
    data = await fetchAll(() => sb.from('attendance').select('id,student_id,kind,note,occurred_at')
      .gte('occurred_at', from).lt('occurred_at', to).in('kind', ['in', 'absent', 'excused'])
      .order('occurred_at').order('id'));
  } catch (e) { error = e; }
  // Oy yoki kurs tez almashtirilsa — eskirgan javob yangisini bosib ketmasin
  if (seq !== repSeq || state.view !== 'report' || !$('repOut')) return;
  if (error) { $('repOut').innerHTML = `<div class="card"><div class="empty"><b>${t('error')}</b><p>${esc(error.message)}</p></div></div>`; return; }

  const allowed = new Set(myCourses().map((c) => c.id));
  const scoped = state.students.filter((s) => allowed.has(s.course_id) &&
    (state.courseFilter === 'all' || s.course_id === state.courseFilter));
  const scopedIds = new Set(scoped.map((s) => s.id));
  const courseOf = new Map(scoped.map((s) => [s.id, s.course_id]));

  const by = new Map();
  const openDays = new Set();                       // markaz ishlagan kunlar (plitka uchun)
  const courseDays = new Map();                     // kurs -> o'sha kursning dars kunlari
  const entry = (sid) => {
    if (!by.has(sid)) by.set(sid, { in: new Map(), absent: new Map(), excused: new Map(), last: null });
    return by.get(sid);
  };
  (data ?? []).forEach((r) => {
    if (!scopedIds.has(r.student_id)) return;
    const d = dayKey(r.occurred_at);
    if (r.kind === 'out') return;                   // "ketdi" alohida kun hisoblanmaydi
    openDays.add(d);
    const cid = courseOf.get(r.student_id);
    if (!courseDays.has(cid)) courseDays.set(cid, new Set());
    courseDays.get(cid).add(d);
    const e = entry(r.student_id);
    if (r.kind === 'in') {
      e.in.set(d, r.occurred_at);
      if (!e.last || r.occurred_at > e.last) e.last = r.occurred_at;
    } else {
      e[r.kind].set(d, r.note || '');
    }
  });

  const total = openDays.size;
  const rows = scoped.filter((s) => s.active || by.has(s.id)).map((s) => {
    const e = by.get(s.id);
    const days = e ? [...e.in.keys()].sort() : [];
    const absentDays = e ? [...e.absent.keys()].sort() : [];
    const excusedDays = e ? [...e.excused.keys()].sort() : [];
    const count = days.length;
    const own = courseDays.get(s.course_id)?.size || 0;
    return {
      id: s.id, name: s.full_name, course: courseById(s.course_id), courseId: s.course_id, active: s.active,
      count, absent: absentDays.length, excused: excusedDays.length,
      last: e ? e.last : null,
      daysTotal: own,
      pct: own ? Math.round((count / own) * 100) : 0,
      days, absentDays, excusedDays,
      inAt: e ? Object.fromEntries(e.in) : {},
      notes: e ? Object.fromEntries(e.excused) : {},
    };
  }).sort((a, b) => a.course.name.localeCompare(b.course.name) || a.name.localeCompare(b.name));

  // Kunlar bo'yicha: har kuni nechta keldi / sababli / kelmadi
  const [y, m] = ym.split('-').map(Number);
  const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daily = Array.from({ length: nDays }, (_, i) => {
    const key = `${ym}-${String(i + 1).padStart(2, '0')}`;
    const wd = new Date(Date.UTC(y, m - 1, i + 1)).getUTCDay();
    let inN = 0, abN = 0, exN = 0;
    rows.forEach((r) => {
      if (r.inAt[key]) inN++;
      else if (r.absentDays.includes(key)) abN++;
      else if (key in r.notes) exN++;
    });
    return { key, d: i + 1, wd, in: inN, absent: abN, excused: exN, open: openDays.has(key) };
  });

  // Kurslar bo'yicha o'rtacha foiz
  const byCourse = new Map();
  rows.forEach((r) => {
    if (!r.daysTotal) return;
    const c = byCourse.get(r.courseId) ?? { course: r.course, sum: 0, n: 0, days: r.daysTotal };
    c.sum += r.pct; c.n += 1;
    byCourse.set(r.courseId, c);
  });
  const courses = [...byCourse.values()]
    .map((c) => ({ ...c, pct: Math.round(c.sum / c.n) }))
    .sort((a, b) => b.pct - a.pct || a.course.name.localeCompare(b.course.name));

  const visits = rows.reduce((n, r) => n + r.count, 0);
  const absences = rows.reduce((n, r) => n + r.absent, 0);
  const counted = rows.filter((r) => r.daysTotal);
  const avg = counted.length ? Math.round(counted.reduce((n, r) => n + r.pct, 0) / counted.length) : 0;
  repData = { ym, rows, total, visits, absences, avg, daily, courses, nDays };

  renderReport();
}

function renderReport() {
  const out = $('repOut');
  if (!out || !repData) return;
  const d = repData;
  const empty = !d.rows.length || !d.total;

  const tabs = [['grid', t('tabGrid')], ['charts', t('tabCharts')], ['list', t('tabList')]];
  const tab = tabs.some(([k]) => k === state.repTab) ? state.repTab : 'grid';

  out.classList.remove('is-loading');
  out.innerHTML = `
    <div class="stats stats-compact">
      ${statTile(d.rows.length, t('sStudents'), 'users')}
      ${statTile(d.total, t('sWorkdays'), 'clock')}
      ${statTile(d.visits, t('sVisits'), MARKS.in.icon, MARKS.in.tone)}
      ${statTile(d.absences, MARKS.absent.label, MARKS.absent.icon, MARKS.absent.tone)}
      ${statTile(d.avg + '%', t('sAvg'), 'chart')}
    </div>
    ${empty
      ? `<div class="card"><div class="empty"><div class="e-ico">📭</div><b>${t('noData')}</b><p>${t('noDataP')}</p></div></div>`
      : `<div class="seg" role="tablist" aria-label="${t('tReport')}">${tabs.map(([k, label]) =>
          `<button class="seg-btn${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-rep-tab="${k}" type="button">${label}</button>`).join('')}</div>
        <div class="rep-body">${tab === 'grid' ? repGrid(d) : tab === 'charts' ? repCharts(d) : repList(d)}</div>`}`;
  drawCharts();
  // Jurnal joriy oyda bugungi kunga suriladi — 1-kundan boshlab varaqlash shart emas
  const wrap = out.querySelector('.jg-wrap');
  const todayTh = wrap?.querySelector('th.is-today');
  if (wrap && todayTh) {
    const right = todayTh.offsetLeft + todayTh.offsetWidth;
    const sticky = wrap.querySelector('.jg-pct')?.offsetWidth || 0;
    wrap.scrollLeft = Math.max(0, right - wrap.clientWidth + sticky + 8);
  }
}

/* ------------------------------------------------------------
   JURNAL — o'quvchi × kun.
   Qizil va yashil deyteranopiyada farqlanmaydi (tekshirildi: ΔE 5.6),
   shuning uchun har bir katakda holat IKONKASI bor — rang faqat qo'shimcha.
   ------------------------------------------------------------ */
function repGrid(d) {
  const wd = t('wdShort').split(',');
  const today = todayKey();
  const minFix = shiftDay(today, -30);

  const head = d.daily.map((x) => {
    const cls = [x.wd === 0 ? 'is-closed' : '', x.key === today ? 'is-today' : ''].filter(Boolean).join(' ');
    return `<th class="jg-day ${cls}" scope="col"><b>${x.d}</b><span>${wd[x.wd]}</span></th>`;
  }).join('');

  const byCourse = new Map();
  d.rows.forEach((r) => { if (!byCourse.has(r.courseId)) byCourse.set(r.courseId, []); byCourse.get(r.courseId).push(r); });

  const body = [...byCourse.values()].map((list) => {
    const c = list[0].course;
    const title = `<tr class="jg-group"><th class="jg-name" scope="rowgroup">${cIcon(c)} ${esc(c.name)}</th>
      <td colspan="${d.nDays + 1}"></td></tr>`;
    return title + list.map((r) => {
      const cells = d.daily.map((x) => {
        const inAt = r.inAt[x.key];
        const isAbs = r.absentDays.includes(x.key);
        const isExc = x.key in r.notes;
        const kind = inAt ? 'in' : isAbs ? 'absent' : isExc ? 'excused' : null;
        const future = x.key > today;
        const closed = x.wd === 0;
        const fixable = !future && x.key >= minFix;

        const dateTxt = uzDate(new Date(`${x.key}T00:00:00+05:00`));
        // O'tgan kunga keyin qo'yilgan belgi kun boshiga (00:00) yoziladi — bu soxta soat, ko'rsatmaymiz
        const time = inAt ? hhmm(inAt) : '';
        const status = kind === 'in' ? MARKS.in.label + (time && time !== '00:00' ? ' · ' + time : '')
          : kind === 'absent' ? MARKS.absent.label
          : kind === 'excused' ? MARKS.excused.label + (r.notes[x.key] ? ' · ' + r.notes[x.key] : '')
          : future ? t('futureDay') : closed ? t('closedDay') : t('noMark');

        const cls = ['jg-cell', kind ? 'tone-' + MARKS[kind].tone : '', closed ? 'is-closed' : '',
          future ? 'is-future' : '', x.key === today ? 'is-today' : '', fixable ? 'is-fix' : ''].filter(Boolean).join(' ');
        return `<td class="${cls}" ${fixable ? `data-jump="${x.key}"` : ''} tabindex="${kind || fixable ? 0 : -1}"
          data-tip-t="${esc(r.name)}" data-tip-v="${esc(dateTxt + '\n' + status)}"
          aria-label="${esc(r.name + ', ' + dateTxt + ': ' + status)}">${kind ? ico(MARKS[kind]) : ''}</td>`;
      }).join('');
      return `<tr>
        <th class="jg-name" scope="row" title="${esc(r.name)}"><span class="jg-nm">${esc(r.name)}${r.active ? '' : ` <span class="badge">${t('archiveShort')}</span>`}</span></th>
        ${cells}
        <td class="jg-sum"><b>${r.pct}%</b><span>${r.count}/${r.daysTotal}</span></td>
      </tr>`;
    }).join('');
  }).join('');

  const legend = ['in', 'excused', 'absent'].map((k) =>
    `<span class="lg-item"><span class="lg-cell tone-${MARKS[k].tone}">${ico(MARKS[k])}</span>${MARKS[k].label}</span>`).join('') +
    `<span class="lg-item"><span class="lg-cell is-closed"></span>${t('closedDay')}</span>`;

  return `
    <div class="viz-legend">${legend}</div>
    <p class="viz-hint">${I.note} ${t('gridHint')}</p>
    <div class="jg-wrap" tabindex="0" aria-label="${t('tabGrid')}">
      <table class="jg">
        <thead><tr><th class="jg-name jg-corner" scope="col">${t('colStudent')}</th>${head}
          <th class="jg-sum" scope="col">%</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

/* ------------------------------------------------------------
   DIAGRAMMALAR — qo'lda yozilgan SVG (panel CDN'siz ishlaydi).
   Ranglar CSS tokenlaridan: yorug'/qorong'i mavzuda o'zi almashadi,
   ikkalasi ham validator bilan tekshirilgan.
   ------------------------------------------------------------ */

// Yuqori uchi 4px yumaloq, asosi to'g'ri ustun
function colPath(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
// O'ng uchi yumaloq, chap asosi to'g'ri gorizontal ustun
function barPath(x, y, w, h, r) {
  if (w <= 0) return '';
  r = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
// O'q bo'linmasi butun son bo'lsin: max/2 ham butun (0 / 8 / 15 emas, 0 / 8 / 16)
const niceMax = (v) => {
  if (v <= 4) return 4;
  const step = v <= 10 ? 2 : v <= 20 ? 4 : v <= 50 ? 10 : 20;
  return Math.ceil(v / step) * step;
};

function repCharts(d) {
  return `
    <div class="card viz-card">
      <div class="viz-head"><h3>${t('chDaily')}</h3><p>${t('chDailySub')}</p></div>
      <div class="viz-legend">${['in', 'excused', 'absent'].map((k) =>
        `<span class="lg-item"><span class="lg-swatch tone-${MARKS[k].tone}"></span>${ico(MARKS[k])}${MARKS[k].label}</span>`).join('')}</div>
      <div class="viz-plot" data-chart="daily"></div>
      <details class="viz-table"><summary>${t('asTable')}</summary>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>${t('colDate')}</th>
          <th class="num">${MARKS.in.label}</th><th class="num">${MARKS.excused.label}</th><th class="num">${MARKS.absent.label}</th></tr></thead>
          <tbody>${d.daily.filter((x) => x.open).map((x) => `<tr><td>${esc(shortDate(x.key))}</td>
            <td class="num">${x.in}</td><td class="num">${x.excused}</td><td class="num">${x.absent}</td></tr>`).join('')}</tbody></table></div>
      </details>
    </div>
    ${d.courses.length > 1 ? `
    <div class="card viz-card">
      <div class="viz-head"><h3>${t('chCourses')}</h3><p>${t('chCoursesSub')}</p></div>
      <div class="viz-plot" data-chart="courses"></div>
      <details class="viz-table"><summary>${t('asTable')}</summary>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>${t('colCourse')}</th>
          <th class="num">${t('colAtt')}</th><th class="num">${t('sStudents')}</th><th class="num">${t('sWorkdays')}</th></tr></thead>
          <tbody>${d.courses.map((c) => `<tr><td>${cIcon(c.course)} ${esc(c.course.name)}</td>
            <td class="num">${c.pct}%</td><td class="num">${c.n}</td><td class="num">${c.days}</td></tr>`).join('')}</tbody></table></div>
      </details>
    </div>` : ''}`;
}

// Kunlik ustunlar: keldi (pastda) · sababli · kelmadi (yuqorida) — tartib doim bir xil.
// Sababli bo'lmagan kuni qizil yashil ustiga to'g'ridan-to'g'ri tushadi, shuning
// uchun diagramma ranglari (--viz-*) uchala juftlikda ham daltonizm tekshiruvidan
// o'tkazilgan (deyteranopiyada ΔE ≥ 9), bo'laklar orasida 2px sirt oralig'i bor.
function chartDaily(d, W) {
  const H = W < 480 ? 200 : 240, L = 30, R = 8, T = 10, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(1, ...d.daily.map((x) => x.in + x.excused + x.absent)));
  const slot = pw / d.nDays;
  const bw = Math.min(24, Math.max(3, slot - 2));          // ustun <=24px, 2px oraliq
  const yOf = (v) => T + ph - (v / max) * ph;
  const ticks = [0, max / 2, max].map((v) => Math.round(v));

  const grid = ticks.map((v) => `<line class="viz-grid" x1="${L}" x2="${W - R}" y1="${yOf(v)}" y2="${yOf(v)}"/>
    <text class="viz-axis" x="${L - 6}" y="${yOf(v) + 4}" text-anchor="end">${v}</text>`).join('');

  const cols = d.daily.map((x, i) => {
    const x0 = L + i * slot + (slot - bw) / 2;
    const segs = [['in', x.in], ['excused', x.excused], ['absent', x.absent]].filter(([, v]) => v > 0);
    let acc = 0;
    const paths = segs.map(([k, v], j) => {
      const top = j === segs.length - 1;                     // faqat eng yuqori bo'lak yumaloq
      const yTop = yOf(acc + v), yBot = yOf(acc);
      acc += v;
      const h = Math.max(0, yBot - yTop - (j > 0 ? 2 : 0));  // bo'laklar orasida 2px sirt oralig'i
      return `<path class="viz-${k}" d="${colPath(x0, yTop, bw, h, top ? 4 : 0)}"/>`;
    }).join('');
    const closed = x.wd === 0 ? `<rect class="viz-closed" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}"/>` : '';
    return closed + paths;
  }).join('');

  // X o'qi: 1, 5, 10, 15, 20, 25 va oxirgi kun
  const marks = [1, 5, 10, 15, 20, 25, d.nDays].filter((v, i, a) => v <= d.nDays && a.indexOf(v) === i);
  const xAxis = marks.map((v) => `<text class="viz-axis" x="${L + (v - 0.5) * slot}" y="${H - 8}" text-anchor="middle">${v}</text>`).join('');

  const tip = d.daily.map((x) => ({
    t: uzDate(new Date(`${x.key}T00:00:00+05:00`)),
    v: x.wd === 0 && !x.open ? t('closedDay')
      : `${MARKS.in.label}: ${x.in}\n${MARKS.excused.label}: ${x.excused}\n${MARKS.absent.label}: ${x.absent}`,
  }));

  return `
    <svg class="viz" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0"
      aria-label="${esc(t('chDaily'))}" data-cross='${esc(JSON.stringify({ L, slot, T, ph, n: d.nDays, tip }))}'>
      ${grid}${cols}${xAxis}
      <line class="viz-cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" hidden/>
    </svg>`;
}

// Kurslar: bitta rang (nominal toifa — qiymatga qarab bo'yalmaydi), qiymat uchida
function chartCourses(d, W) {
  // Tor ekranda nom ustun ustida turadi — yonida qolsa ustunga joy qolmaydi
  const narrow = W < 480;
  const rowH = narrow ? 50 : 34, bh = 18, T = 4, R = 46;
  const L = narrow ? 0 : 150;
  const H = T + d.courses.length * rowH + 4;
  const pw = Math.max(40, W - L - R);
  const max = narrow ? 34 : 20;
  const bars = d.courses.map((c, i) => {
    const y = T + i * rowH + (narrow ? 24 : (rowH - bh) / 2);
    const w = Math.max(0, (c.pct / 100) * pw);
    const label = cText(c.course);
    const short = label.length > max ? label.slice(0, max - 1) + '…' : label;
    const lx = narrow ? 0 : L - 10, ly = narrow ? T + i * rowH + 16 : y + bh / 2 + 5;
    return `<g class="viz-hit" tabindex="0" data-tip-t="${esc(label)}"
        data-tip-v="${esc(`${t('colAtt')}: ${c.pct}%\n${t('sStudents')}: ${c.n}\n${t('sWorkdays')}: ${c.days}`)}">
      <rect x="0" y="${T + i * rowH}" width="${W}" height="${rowH}" fill="transparent"/>
      <rect class="viz-track" x="${L}" y="${y}" width="${pw}" height="${bh}" rx="4"/>
      <path class="viz-bar" d="${barPath(L, y, w, bh, 4)}"/>
      <text class="viz-label" x="${lx}" y="${ly}" text-anchor="${narrow ? 'start' : 'end'}">${esc(short)}</text>
      <text class="viz-value" x="${L + w + 8}" y="${y + bh / 2 + 5}">${c.pct}%</text>
    </g>`;
  }).join('');
  return `<svg class="viz viz-h" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
    aria-label="${esc(t('chCourses'))}">${bars}</svg>`;
}

/* Diagrammalar konteyner enida chiziladi: 1 birlik = 1px. viewBox cho'zilsa
   matn mobilda 5px gacha kichrayib, kompyuterda ustunlar 24px dan kengayardi. */
let vizRO = null;
function drawCharts() {
  const plots = document.querySelectorAll('.viz-plot[data-chart]');
  vizRO?.disconnect();
  if (!plots.length) return;
  if (!vizRO && 'ResizeObserver' in window) vizRO = new ResizeObserver((es) => es.forEach((e) => drawPlot(e.target)));
  plots.forEach((el) => { drawPlot(el); vizRO?.observe(el); });
}
const CHARTS = {
  daily: (w) => repData && chartDaily(repData, w),
  courses: (w) => repData && chartCourses(repData, w),
  finSum: (w) => finData && chartFinSum(finData, w),
  finCount: (w) => finData && chartFinCount(finData, w),
  finCourses: (w) => finData && chartFinCourses(finData, w),
};
function drawPlot(el) {
  const w = Math.floor(el.clientWidth);
  const draw = CHARTS[el.dataset.chart];
  if (!w || !draw || String(w) === el.dataset.w || !el.isConnected) return;
  const html = draw(w);
  if (!html) return;
  el.dataset.w = w;
  const focused = el.contains(document.activeElement);
  el.innerHTML = html;
  if (focused) el.querySelector('svg[tabindex], [tabindex]')?.focus();
}

function repList(d) {
  return `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>${t('colStudent')}</th><th class="num">${t('colDays')}</th>
      <th class="num th-ico" title="${t('colAbsExc')}">
        <span class="tone-red">${I.alert}</span><span class="tone-violet">${I.note}</span></th>
      <th>${t('colAtt')}</th><th>${t('colLast')}</th>
    </tr></thead><tbody>${[...d.rows].sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name)).map((r) => `
      <tr data-row="${r.id}">
        <td><div style="font-weight:800">${esc(r.name)}${r.active ? '' : ` <span class="badge">${t('archiveShort')}</span>`}</div>
            <div style="color:var(--faint);font-size:.8rem;font-weight:700">${cIcon(r.course)} ${esc(r.course.name)}</div></td>
        <td class="num">${r.count} / ${r.daysTotal}</td>
        <td class="num"><span class="${r.absent ? 'tone-red num-on' : 'num-off'}">${r.absent}</span>
            <span class="num-off"> / </span><span class="${r.excused ? 'tone-violet num-on' : 'num-off'}">${r.excused}</span></td>
        <td><div class="bar"><i style="width:${Math.min(100, r.pct)}%"></i></div>
            <span style="font-size:.78rem;font-weight:800;color:var(--muted)">${r.pct}%</span></td>
        <td style="color:var(--muted);font-weight:700;white-space:nowrap">${r.last ? dayKey(r.last).slice(8) + '.' + dayKey(r.last).slice(5, 7) : '—'}</td>
      </tr>
      <tr class="hidden" data-detail="${r.id}"><td colspan="5"><div class="day-pills">${
        // Xronologik tartibda — avval holat bo'yicha guruhlanardi
        [...r.days.map((x) => [x, 'in']), ...r.absentDays.map((x) => [x, 'absent']), ...r.excusedDays.map((x) => [x, 'excused'])]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([x, k]) => pill(k, x, k === 'excused' ? r.notes[x] : undefined)).join('')
        || `<span style="color:var(--faint)">${t('noDaysP')}</span>`}</div></td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ------------------------------------------------------------
   Diagramma ko'rsatkichi (tooltip). Ismlar bazadan keladi —
   faqat textContent orqali qo'yiladi, innerHTML emas.
   ------------------------------------------------------------ */
function vizTip() {
  let el = $('vizTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vizTip'; el.className = 'viz-tip'; el.setAttribute('role', 'tooltip'); el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}
function showTip(title, value, x, y) {
  const el = vizTip();
  el.replaceChildren();
  const v = document.createElement('div'); v.className = 'viz-tip-v';
  String(value).split('\n').forEach((line, i) => {
    if (i) v.appendChild(document.createElement('br'));
    v.appendChild(document.createTextNode(line));
  });
  const tt = document.createElement('div'); tt.className = 'viz-tip-t'; tt.textContent = title;
  el.append(v, tt);                                   // qiymat oldin, nom keyin
  el.hidden = false;
  const r = el.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
  const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
function hideTip() { const el = $('vizTip'); if (el) el.hidden = true; }

// Kunlik diagrammada kursor eng yaqin kunga "yopishadi" — 12px ustunni nishonga olish shart emas
function crossAt(svg, idx) {
  const c = JSON.parse(svg.dataset.cross);
  idx = Math.max(0, Math.min(c.n - 1, idx));
  svg.dataset.idx = idx;
  const x = c.L + (idx + 0.5) * c.slot;
  const line = svg.querySelector('.viz-cross');
  line.setAttribute('x1', x); line.setAttribute('x2', x); line.removeAttribute('hidden');
  const box = svg.getBoundingClientRect();
  const sx = box.left + (x / svg.viewBox.baseVal.width) * box.width;
  showTip(c.tip[idx].t, c.tip[idx].v, sx, box.top + (c.T / svg.viewBox.baseVal.height) * box.height);
}

function exportCsv() {
  if (!repData || !repData.rows.length) { toast(t('csvFirst'), 'bad'); return; }
  const head = [t('colStudent'), t('csvCourse'), t('csvCameDays'), MARKS.absent.label, MARKS.excused.label,
                t('csvWorkDays'), t('csvPct'), t('csvLast'),
                t('csvCameDates'), t('csvAbsentDates'), t('csvExcusedDates')];
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [head.map(q).join(';')].concat(repData.rows.map((r) =>
    [r.name, r.course.name, r.count, r.absent, r.excused, r.daysTotal, r.pct,
     r.last ? dayKey(r.last) : '', r.days.join(' '), r.absentDays.join(' '),
     r.excusedDays.map((d) => r.notes[d] ? `${d} (${r.notes[d]})` : d).join(' ')].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `parvoz-davomat-${repData.ym}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t('csvDone'), 'ok');
}

/* ============================================================
   KO'RINISH: JAMOA (faqat admin)
   ============================================================ */
function viewTeamShell() {
  return `
    <div class="page-head">
      <div><h2>${t('tTeam')}</h2><p>${t('teamSub')}</p></div>
      <div class="spacer"></div>
      <button class="btn btn-primary" data-add-teacher type="button">${I.plus} ${t('teacher')}</button>
    </div>
    <div id="teamOut"><div class="skel"></div><div class="skel"></div></div>
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>${t('courses')}</h3><div class="spacer"></div>
        <button class="btn btn-sm" data-add-course type="button">${I.plus} ${t('course')}</button></div>
      <div id="coursesOut" class="rows"></div>
    </div>`;
}

async function loadTeam() {
  try {
    const { teachers } = await edge('admin-api', { action: 'list_teachers' });
    $('teamOut').innerHTML = `<div class="rows">${teachers.map((tc) => {
      const cs = tc.role === 'admin'
        ? `<span class="badge badge-admin">${t('allCourses')}</span>`
        : (tc.course_ids.length
            ? tc.course_ids.map((id) => { const c = courseById(id); return `<span class="badge badge-course" style="--acc:var(--${c.color})">${cIcon(c)} ${esc(c.name)}</span>`; }).join(' ')
            : `<span class="badge badge-warn">${t('noCourseAssigned')}</span>`);
      return `<div class="row">
        <div class="avatar" style="--acc:var(--${tc.role === 'admin' ? 'violet' : 'sky'})">${esc(initials(tc.full_name || tc.email))}</div>
        <div class="row-main">
          <div class="row-title">${esc(tc.full_name || tc.email.split('@')[0])}
            ${tc.role === 'admin' ? `<span class="badge badge-admin">${t('roleAdmin')}</span>` : ''}</div>
          <div class="row-sub"><span>${esc(tc.email)}</span></div>
          <div class="row-sub">${cs}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm btn-ico" data-edit-teacher="${esc(tc.email)}" aria-label="${esc(t('edit') + ': ' + (tc.full_name || tc.email))}" title="${t('edit')}" type="button">${I.edit}</button>
        </div></div>`;
    }).join('')}</div>`;
  } catch (e) {
    $('teamOut').innerHTML = `<div class="card"><div class="empty"><b>${t('error')}</b><p>${esc(e.message)}</p></div></div>`;
  }

  $('coursesOut').innerHTML = state.courses.map((c) => {
    const n = state.students.filter((s) => s.course_id === c.id).length;
    return `<div class="row">
      <div class="avatar" style="--acc:var(--${c.color});font-size:1.1rem">${cIcon(c)}</div>
      <div class="row-main">
        <div class="row-title">${esc(c.name)} ${c.active ? '' : `<span class="badge">${t('closed')}</span>`}</div>
        <div class="row-sub"><span>${t('nStudents', { n })}</span>${Number.isInteger(c.monthly_fee) ? `<span>${t('perMonth', { n: fmtSum(c.monthly_fee) })}</span>` : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-sm btn-ico" data-edit-course="${c.id}" aria-label="${esc(t('edit') + ': ' + c.name)}" title="${t('edit')}" type="button">${I.edit}</button>
      </div></div>`;
  }).join('');
}

/* ============================================================
   KO'RINISH: SOZLAMALAR
   ============================================================ */
/* ============================================================
   OYLIK TO'LOVLAR — faqat admin (RLS ham faqat adminga ochiq).
   O'quvchiga oyiga bitta yozuv: yozuv bor = to'lagan, yo'q = qarzdor.
   Qarz oylari o'quvchi qo'shilgan oydan (ko'pi bilan 12 oy orqaga) sanaladi.
   ============================================================ */
const PAY_LOOKBACK = 11;          // tanlangan oydan tashqari yana 11 oy
const PAY_MAX = 100000000;        // bazadagi cheklov bilan bir xil
let paySeq = 0;

const MONTHS_NOM = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
};
function ymShift(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const ymLabel = (ym) => `${(MONTHS_NOM[currentLang()] || MONTHS_NOM.uz)[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const ymShort = (ym) => (MONTHS_NOM[currentLang()] || MONTHS_NOM.uz)[Number(ym.slice(5, 7)) - 1].toLowerCase();
const payYm = () => state.payYm || currentYm();
const payMaxYm = () => ymShift(currentYm(), 1);   // keyingi oy — oldindan to'lov uchun

// 300000 -> "300 000" (bo'linmas probel, qatorga bo'linmaydi)
const fmtSum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const sumText = (n) => t('paySum', { n: fmtSum(n) });
function parseSum(raw) {
  const digits = String(raw ?? '').replace(/\D+/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : NaN;
}

function viewPayShell() {
  const ym = payYm();
  const max = payMaxYm();
  return `
    <div class="page-head">
      <div><h2>${t('tPay')}</h2><p>${t('tPaySub')}</p></div>
      <div class="spacer"></div>
      <button class="btn" id="payMode" type="button" aria-pressed="${state.payMode === 'fin'}">${state.payMode === 'fin'
        ? `${I.users} ${t('payListBtn')}` : `${I.chart} ${t('payFinBtn')}`}</button>
      <button class="btn" id="payCsv" type="button">${I.download} CSV</button>
    </div>
    <div class="monthbar">
      <button class="daybar-nav" data-pay-shift="-1" type="button" aria-label="${t('payPrevMonth')}">${I.chevL}</button>
      <label class="daybar-mid">
        <span class="daybar-label" id="payMonthLabel">${esc(ymLabel(ym))}</span>
        <input type="month" id="payMonth" value="${ym}" max="${max}" aria-label="${t('payPickMonth')}">
      </label>
      <button class="daybar-nav" data-pay-shift="1" type="button" aria-label="${t('payNextMonth')}" ${ym >= max ? 'disabled' : ''}>${I.chevR}</button>
    </div>
    ${ym > currentYm() ? `<div class="daybar-note">${I.note}<span>${t('payFutureNote')}</span></div>` : ''}
    ${courseChips()}
    <div id="payOut">${'<div class="skel"></div>'.repeat(4)}</div>`;
}

async function loadPayments() {
  const ym = payYm();
  const seq = ++paySeq;
  const out = $('payOut');
  if (out && state.pay) out.classList.add('is-loading');
  // Eslatmadagi qarz oylari joriy oygacha sanaladi — shuning uchun oraliq ikkalasini qamraydi
  const cur = currentYm();
  const lo = ymShift(ym < cur ? ym : cur, -PAY_LOOKBACK), hi = ym > cur ? ym : cur;
  const [{ data, error }, rem] = await Promise.all([
    fetchAll(() => sb.from('payments').select('id,student_id,month,amount,paid_on,note,notified_at')
      .gte('month', lo + '-01').lte('month', hi + '-01').order('id'))
      .then((data) => ({ data, error: null }), (error) => ({ data: null, error })),
    sb.from('payment_reminders').select('student_id,status,code,sent_at,month')
      .gte('sent_at', new Date(Date.now() - 31 * 86400e3).toISOString()).order('sent_at', { ascending: false }),
    loadFees(),
  ]);
  // Oy tez-tez almashtirilsa eski javob yangisini bosib ketmasin
  if (seq !== paySeq || state.view !== 'payments' || !$('payOut')) return;
  if (error) {
    $('payOut').innerHTML = `<div class="card"><div class="empty"><b>${t('error')}</b><p>${esc(error.message)}</p></div></div>`;
    return;
  }
  // Har o'quvchining eng oxirgi eslatmasi — belgi uchun; eng oxirgi YETGAN (failed emas)
  // eslatma — 7 kunlik chegara uchun (server ham shunday hisoblaydi).
  // Jurnal o'qilmasa ham to'lovlar ishlayveradi.
  const remMap = new Map(), remOkMap = new Map();
  (rem?.data ?? []).forEach((r) => {
    if (!remMap.has(r.student_id)) remMap.set(r.student_id, r);
    if (r.status !== 'failed' && !remOkMap.has(r.student_id)) remOkMap.set(r.student_id, r);
  });
  state.pay = { ym, rows: data ?? [], rem: remMap, remOk: remOkMap };
  renderPayments();
}

function payModel() {
  const { ym, rows } = state.pay;
  const byStudent = new Map();
  rows.forEach((r) => {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Map());
    byStudent.get(r.student_id).set(r.month.slice(0, 7), r);
  });
  const allowed = new Set(myCourses().map((c) => c.id));
  const items = state.students
    .filter((s) => allowed.has(s.course_id) && (state.courseFilter === 'all' || s.course_id === state.courseFilter))
    .map((s) => {
      const pm = byStudent.get(s.id) || new Map();
      const start = dayKey(s.created_at || new Date().toISOString()).slice(0, 7);
      const p = pm.get(ym) || null;
      // Arxivdagi o'quvchi qarzdor hisoblanmaydi; faqat shu oy to'lagan bo'lsa ko'rinadi
      if (!p && (!s.active || start > ym)) return null;
      const owed = [];
      if (s.active) {
        for (let i = PAY_LOOKBACK; i >= 0; i--) {
          const m = ymShift(ym, -i);
          if (m >= start && !pm.has(m)) owed.push(m);
        }
      }
      // Eslatma uchun: joriy oygacha (tanlangan oy emas) barcha qarz oylari
      const owedNow = [];
      if (s.active) {
        const cur = currentYm();
        for (let i = PAY_LOOKBACK; i >= 0; i--) {
          const m = ymShift(cur, -i);
          if (m >= start && !pm.has(m)) owedNow.push(m);
        }
      }
      const withAmount = [...pm.values()].filter((r) => r.amount != null).sort((a, b) => b.month.localeCompare(a.month));
      const c = courseById(s.course_id);
      const fee = Number.isInteger(c.monthly_fee) ? c.monthly_fee : null;
      const own = state.fees.get(s.id);
      const sfee = Number.isInteger(own) ? own : null;
      // Oylik narx: shaxsiy (chegirma) bo'lsa o'sha, bo'lmasa kurs narxi
      const rate = sfee ?? fee;
      // Taxminiy qarz: oylik narx × to'lanmagan oylar (shu oy bilan)
      const debt = !p && rate != null ? owed.length * rate : null;
      return { s, c, p, owed, owedNow, rem: state.pay.rem?.get(s.id) ?? null,
        remOk: state.pay.remOk?.get(s.id) ?? null, last: withAmount[0]?.amount ?? null, fee, sfee, rate, debt };
    })
    .filter(Boolean);

  const paid = items.filter((x) => x.p);
  const unpaid = items.filter((x) => !x.p);
  return {
    ym, items, paid, unpaid,
    collected: paid.reduce((n, x) => n + (x.p.amount || 0), 0),
    multi: unpaid.filter((x) => x.owed.length >= 2).length,
    debt: unpaid.reduce((n, x) => n + (x.debt || 0), 0),
    noFee: unpaid.filter((x) => x.rate == null).length,
  };
}

function payFilter(list) {
  const q = fold(state.payQ.trim());
  const qd = q.replace(/\D+/g, '');
  if (!q) return list;
  return list.filter(({ s }) => fold(s.full_name).includes(q) ||
    (qd.length >= 3 && String(s.parent_phone || '').replace(/\D+/g, '').includes(qd)) ||
    fold(s.parent_name).includes(q));
}

function renderPayments() {
  const out = $('payOut');
  if (!out || !state.pay) return;
  if (state.payMode === 'fin') return renderFinance(out);
  const d = payModel();
  const tab = ['unpaid', 'paid', 'all'].includes(state.payTab) ? state.payTab : 'unpaid';
  out.classList.remove('is-loading');
  out.innerHTML = `
    <div class="stats stats-compact pay-stats">
      ${statTile(d.paid.length, t('payPaid'), 'check', 'green')}
      ${statTile(d.unpaid.length, t('payUnpaid'), 'alert', 'red')}
      ${statTile(d.multi, t('payDebtors2'), 'clock', d.multi ? 'red' : '')}
      <div class="stat stat-sum"><b>${fmtSum(d.collected)}</b><span>${I.wallet}${t('payCollected')}</span></div>
    </div>
    <div class="seg seg-pay" role="tablist" aria-label="${t('tPay')}">${[
      ['unpaid', t('payTabUnpaid'), d.unpaid.length], ['paid', t('payTabPaid'), d.paid.length], ['all', t('payTabAll'), d.items.length],
    ].map(([k, label, n]) => `<button class="seg-btn${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-pay-tab="${k}" type="button">${label} <span class="seg-n">${n}</span></button>`).join('')}</div>
    <label class="field pay-search">
      <span class="sr-only">${t('paySearch')}</span>
      <input class="inp" id="payQ" type="search" placeholder="${t('paySearch')}" value="${esc(state.payQ)}" autocomplete="off">
    </label>
    <div id="payList">${payListHtml(d, tab)}</div>`;
}

function payListHtml(d, tab) {
  const base = tab === 'paid' ? d.paid : tab === 'unpaid' ? d.unpaid : d.items;
  const list = payFilter(base).sort((a, b) =>
    tab === 'unpaid' ? b.owed.length - a.owed.length || a.s.full_name.localeCompare(b.s.full_name)
    : tab === 'all' ? (!!a.p - !!b.p) || a.s.full_name.localeCompare(b.s.full_name)
    : a.s.full_name.localeCompare(b.s.full_name));
  const bar = tab === 'unpaid' ? debtSummary(d) + remindBar(d, base) : '';
  if (!list.length) {
    const [ico, title, sub] = state.payQ.trim() ? ['🔍', t('noStudentsT'), ''] : !d.items.length ? ['🧑‍🎓', t('payNoStudents'), t('payNoStudentsP')]
      : tab === 'unpaid' ? ['🎉', t('payNoneUnpaid'), t('payNoneUnpaidP')] : ['🧾', t('payNonePaid'), t('payNonePaidP')];
    return bar + `<div class="card"><div class="empty"><div class="e-ico">${ico}</div><b>${title}</b>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
  }
  return bar + `<div class="rows">${list.map(payRow).join('')}</div>`;
}

// Qarzdorlar ustida: jami taxminiy qarz. Hech bir kursda narx bo'lmasa — ko'rsatilmaydi
function debtSummary(d) {
  if (!d.unpaid.length || d.noFee === d.unpaid.length) return '';
  return `<div class="pay-debt-sum">
    <b>${t('payDebtTotal', { n: fmtSum(d.debt) })}</b>
    <small>${t('payDebtBasis')}${d.noFee ? ` · ${t('payDebtNoFee', { n: d.noFee })}` : ''}</small>
  </div>`;
}

function payRow({ s, c, p, owed, rem, debt }) {
  const state_ = p
    ? `<span class="pay-badge tone-green">${I.check}${t('payPaid')}</span>
       <small>${p.amount != null ? sumText(p.amount) : t('payNoAmount')} · ${esc(shortDate(p.paid_on))}${p.notified_at ? `<span class="pay-sent" role="img" title="${t('payNotifBadge')}" aria-label="${t('payNotifBadge')}">${I.checks}</span>` : ''}</small>`
    : `<span class="pay-badge tone-red">${I.alert}${t('payUnpaid')}</span>
       ${owed.length >= 2 ? `<small class="pay-owed">${t('payArrears', { n: owed.length })}</small>` : ''}
       ${debt ? `<small class="pay-debt">${t('payDebt', { n: fmtSum(debt) })}</small>` : ''}
       ${remBadge(rem)}`;
  return `<div class="row pay-row${p ? ' is-paid' : ''}">
    <div class="avatar" style="--acc:var(--${c.color})">${esc(initials(s.full_name))}</div>
    <div class="row-main">
      <div class="row-title">${esc(s.full_name)}${s.active ? '' : ` <span class="badge">${t('archive')}</span>`}</div>
      <div class="row-sub"><span>${cIcon(c)} ${esc(c.name)}</span>${s.parent_phone ? `<span>📞 ${esc(s.parent_phone)}</span>` : ''}</div>
    </div>
    <div class="pay-state">${state_}</div>
    <div class="row-actions">
      ${p ? `<button class="btn btn-sm" data-pay-open="${s.id}" type="button" aria-label="${t('edit')}: ${esc(s.full_name)}">${I.edit}</button>`
          : `<button class="btn btn-sm btn-green" data-pay-open="${s.id}" type="button">${I.check} ${t('payMark')}</button>`}
    </div>
  </div>`;
}

// Tez tanlash: o'quvchining oxirgi summasi, kurs narxi, keyin eng ko'p yozilgan summalar
function payQuickAmounts(first) {
  const freq = new Map();
  (state.pay?.rows ?? []).forEach((r) => { if (r.amount) freq.set(r.amount, (freq.get(r.amount) || 0) + 1); });
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([n]) => n);
  return [...new Set([...first, ...top].filter(Boolean))].slice(0, 4);
}

function paySheet(sid) {
  const d = payModel();
  const it = d.items.find((x) => x.s.id === sid);
  if (!it) return;
  const { s, c, p, owed, last, fee, sfee, rate } = it;
  // Oylik narx (shaxsiy yoki kurs), u bo'lmasa — o'quvchining oxirgi summasi
  const prefill = p ? p.amount : (rate ?? last);
  const quick = payQuickAmounts([rate, last, fee]);
  const chipTag = (n) => (n === sfee ? t('payOwnChip') : n === fee ? t('payFeeChip') : '');
  const pastOwed = owed.filter((m) => m !== d.ym);
  // "Qabul qilindi" xabari — faqat yangi to'lovda. Eski oylar (tarixni kiritish) uchun
  // belgi olib qo'yilgan: ota-onalarga o'tgan oylar bo'yicha xabarlar yog'ilmasin
  const tgOk = !!s.telegram_chat_id && !remBadName(remName(s.full_name));
  const canTell = !p && tgOk && !!state.botUsername && state.tpls?.paid?.on !== false;
  openSheet(`${t('navPay')} · ${esc(ymLabel(d.ym))}`, `
    <div class="pay-who"><b>${esc(s.full_name)}</b><span>${cIcon(c)} ${esc(c.name)}</span>
      ${sfee != null ? `<span class="pay-own">${t('payOwnFee', { n: fmtSum(sfee) })}${fee != null ? ` · ${t('payOwnFeeCourse', { n: fmtSum(fee) })}` : ''}</span>` : ''}</div>
    ${pastOwed.length ? `<p class="pay-owed-list">${I.alert}<span>${t('payArrearsList')}: ${pastOwed.map((m) => esc(ymShort(m))).join(', ')}</span></p>` : ''}
    <form id="payForm" novalidate>
      <label class="field"><span>${t('payAmount')}</span>
        <input class="inp pay-amount" id="payAmount" inputmode="numeric" autocomplete="off" placeholder="0"
          value="${prefill != null ? fmtSum(prefill) : ''}"></label>
      ${quick.length ? `<div class="chips pay-quick" aria-label="${t('payQuick')}">${quick.map((n) =>
        `<button class="chip" style="--acc:var(--green)" data-pay-quick="${n}" type="button"${chipTag(n) ? ` title="${chipTag(n)}"` : ''}>${fmtSum(n)}${chipTag(n) ? ` <small>· ${chipTag(n).toLowerCase()}</small>` : ''}</button>`).join('')}</div>` : ''}
      ${!p && prefill == null ? `<p class="f-hint pay-fee-nudge">${t('payFeeNudge')}</p>` : ''}
      <label class="field"><span>${t('payDate')}</span>
        <input class="inp" type="date" id="payDate" value="${p ? p.paid_on : todayKey()}" max="${todayKey()}"></label>
      <label class="field"><span>${t('payNote')}</span>
        <input class="inp" id="payNote" maxlength="200" placeholder="${t('payNotePh')}" value="${esc(p?.note ?? '')}"></label>
      ${canTell ? `<label class="check-item pay-tell">
        <input type="checkbox" id="payTell" ${d.ym >= ymShift(currentYm(), -1) ? 'checked' : ''}><span>${t('payTell')}</span></label>` : ''}
      <p class="tpl-err" id="payErr" role="alert" hidden></p>
      <button class="btn btn-green btn-block" id="paySave" type="submit">${I.check} ${p ? t('save') : t('payMark')}</button>
      ${p && !p.notified_at && tgOk ? `<button class="btn btn-block" style="margin-top:9px" id="payNotify" type="button">${I.bellOn} ${t('payNotifBtn')}</button>` : ''}
      ${p ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="payDel" type="button">${I.trash} ${t('payDelete')}</button>` : ''}
    </form>`, () => {
    const amt = $('payAmount');
    // Yozayotganda raqamlarni guruhlaymiz: 300000 -> 300 000
    amt.addEventListener('input', () => {
      const n = parseSum(amt.value);
      amt.value = n == null || Number.isNaN(n) ? amt.value.replace(/[^\d\s]/g, '') : fmtSum(n);
      $('payErr').hidden = true;
    });
    document.querySelectorAll('[data-pay-quick]').forEach((b) => b.addEventListener('click', () => {
      amt.value = fmtSum(Number(b.dataset.payQuick));
      $('payErr').hidden = true;
    }));
    $('payForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseSum(amt.value);
      const paidOn = $('payDate').value || todayKey();
      const bad = Number.isNaN(amount) || (amount != null && (amount < 0 || amount > PAY_MAX));
      if (bad) { const er = $('payErr'); er.textContent = t('payBadAmount'); er.hidden = false; amt.focus(); return; }
      if (paidOn > todayKey()) { const er = $('payErr'); er.textContent = t('payBadDate'); er.hidden = false; $('payDate').focus(); return; }
      const row = { amount, paid_on: paidOn, note: $('payNote').value.trim() || null };
      const tell = !!$('payTell')?.checked;
      const btn = $('paySave'); btn.disabled = true;
      const q = p
        ? await sb.from('payments').update(row).eq('id', p.id).select('id').single()
        : await sb.from('payments').insert({ ...row, student_id: s.id, month: d.ym + '-01' }).select('id').single();
      btn.disabled = false;
      if (q.error) {
        // Boshqa admin shu daqiqada yozib qo'ygan
        if (q.error.code === '23505') { closeSheet(); toast(t('payAlready'), 'bad'); return loadPayments(); }
        toast('❌ ' + q.error.message, 'bad'); return;
      }
      closeSheet();
      const newId = q.data?.id;
      // Xabar "Bekor qilish" oynasi tugagach ketadi — adashib belgilangan to'lov ota-onaga yetmasin
      const later = !p && newId && tell;
      if (later) payNotifyLater(newId);
      toast(t('paySaved', { name: s.full_name }) + (later ? t('payNotifSoon') : ''), 'ok', !p && newId ? { fn: async () => {
        payNotifyCancel(newId);
        const { error } = await sb.from('payments').delete().eq('id', newId);
        if (error) toast('❌ ' + error.message, 'bad'); else toast(t('payRemoved'), 'ok');
        loadPayments();
      } } : undefined);
      loadPayments();
    });
    if (p) $('payNotify')?.addEventListener('click', async () => {
      const btn = $('payNotify'); btn.disabled = true;
      const code = await payNotify(p.id);
      btn.disabled = false;
      if (code === 'sent' || code === 'already') { closeSheet(); toast(t('payNotifDone'), 'ok'); loadPayments(); }
      else toast(payNotifMsg(code), 'bad');
    });
    if (p) $('payDel').addEventListener('click', async () => {
      if (!confirm(t('payDeleteQ', { name: s.full_name, month: ymLabel(d.ym) }))) return;
      const { error } = await sb.from('payments').delete().eq('id', p.id);
      if (error) { toast('❌ ' + error.message, 'bad'); return; }
      closeSheet(); toast(t('payRemoved'), 'ok');
      loadPayments();
    });
  });
}

/* ---------- To'lov eslatmasi (Telegram) ----------
   Yuborish admin-api → send_reminders da; server hammasini qayta tekshiradi.
   Bu yerda faqat kimga ketishini oldindan ko'rsatamiz. */
const REMIND_COOLDOWN_DAYS = 7;   // admin-api bilan bir xil
const REMIND_CHUNK = 50;          // admin-api → REMIND_MAX
// admin-api dagi normName/badName bilan bir xil: ismda karta raqami yoki havola bo'lmasin
const remName = (n) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
const remBadName = (n) => /https?:\/\/|www\.|t\.me\/|@/i.test(n) || /\d{7,}/.test(n.replace(/[\s().-]/g, ''));
const remDate = (iso) => shortDate(dayKey(iso));
const telHref = (ph) => 'tel:+' + String(ph || '').replace(/\D+/g, '');

function remBadge(rem) {
  if (!rem) return '';
  const d = esc(remDate(rem.sent_at));
  if (rem.status === 'sent') return `<small class="pay-rem" title="${t('remBadgeSent')}">${I.bellOn}${d}</small>`;
  if (rem.status === 'failed') return `<small class="pay-rem is-failed" title="${t('remBadgeFailed')}">${I.bell}${d}</small>`;
  return `<small class="pay-rem is-unknown" title="${t('remBadgeUnknown')}">${I.bellOn}${d} ?</small>`;
}

// Nega yuborilmaydi — null bo'lsa yuboriladi
function remBlock(it, now = Date.now()) {
  if (!it.s.telegram_chat_id) return { code: 'no_tg' };
  if (remBadName(remName(it.s.full_name))) return { code: 'bad_name' };
  const r = it.remOk;
  if (r && now - Date.parse(r.sent_at) < REMIND_COOLDOWN_DAYS * 86400e3) {
    return { code: 'recent', d: remDate(r.sent_at) };
  }
  return null;
}
const remReason = (b) => t('remR_' + b.code, { d: b.d || '' });

// Eslatma faqat joriy va oldingi 11 oy uchun (keyingi oy — oldindan to'lov, qarz emas)
const remMonthOk = (ym) => ym <= currentYm() && ym >= ymShift(currentYm(), -PAY_LOOKBACK);

function remindBar(d, base) {
  if (!remMonthOk(d.ym)) return '';
  const cands = payFilter(base);
  const n = cands.filter((it) => !remBlock(it)).length;
  const noBot = !state.botUsername;
  return `<div class="rem-bar">
    <button class="btn btn-sm rem-open" id="remOpen" type="button" ${n && !noBot ? '' : 'disabled'}
      ${noBot ? `title="${t('remNoBot')}"` : ''}>${I.bellOn} ${t('remBtn', { n })}</button>
    ${noBot ? `<small>${t('remNoBot')}</small>` : ''}
  </div>`;
}

function remVars(it, ym) {
  const oy = (m) => DATE_NAMES.uz.m[Number(m.slice(5, 7)) - 1];
  return {
    ism: remName(it.s.full_name),
    kurs: it.c?.name || '',
    oy: oy(ym),
    oylar: it.owedNow.length === 1 && it.owedNow[0] === ym ? '' : it.owedNow.map(oy).join(', '),
  };
}

function remindSheet() {
  const d = payModel();
  const cands = payFilter(d.unpaid);
  const now = Date.now();
  const ok = [], bad = [];
  cands.forEach((it) => { const b = remBlock(it, now); (b ? bad : ok).push({ it, b }); });
  const cnt = (code) => bad.filter((x) => x.b.code === code).length;
  const summary = [t('remSumDebt', { n: cands.length }), t('remSumOk', { n: ok.length }),
    cnt('no_tg') && t('remSumNoTg', { n: cnt('no_tg') }), cnt('recent') && t('remSumRecent', { n: cnt('recent') }),
    cnt('bad_name') && t('remSumBad', { n: cnt('bad_name') })].filter(Boolean).join(' · ');
  const tplText = tplSaved('pay').text;

  openSheet(`${t('remTitle')} · ${esc(ymLabel(d.ym))}`, `
    <div id="remBody">
      ${state.payQ.trim() ? `<p class="rem-scope">${t('remBySearch', { n: cands.length })}</p>` : ''}
      <p class="rem-summary">${summary}</p>
      <div class="tpl-prev-head"><span>${t('tplPrev')}</span></div>
      <div class="tg-chat"><div class="tg-bubble"><div class="tg-text" id="remPrev"></div></div></div>
      <div class="rem-list-head"><b id="remCount">${t('remWillGet', { n: ok.length })}</b>
        <button class="btn btn-sm btn-ghost" id="remToggle" type="button">${t('remNone')}</button></div>
      <div class="check-list rem-list">${ok.map(({ it }) => `
        <label class="check-item"><input type="checkbox" class="remPick" value="${it.s.id}" checked>
          <span class="rem-who"><span class="rem-name">${esc(it.s.full_name)}</span><small>${cIcon(it.c)} ${esc(it.c.name)}</small></span></label>`).join('')}</div>
      ${bad.length ? `<details class="rem-skip"><summary>${t('remSkipped', { n: bad.length })}</summary>
        <div class="rem-skip-list">${bad.map(({ it, b }) => `<div class="rem-skip-row">
          <span class="rem-who"><span class="rem-name">${esc(it.s.full_name)}</span><small>${esc(remReason(b))}</small></span>
          ${it.s.parent_phone ? `<a class="rem-tel" href="${esc(telHref(it.s.parent_phone))}">${esc(it.s.parent_phone)}</a>` : ''}</div>`).join('')}</div></details>` : ''}
      <div class="sheet-foot"><button class="btn btn-primary btn-block" id="remSend" type="button">${I.bellOn} <span>${t('remSend', { n: ok.length })}</span></button></div>
    </div>`, () => {
    const picks = () => [...document.querySelectorAll('.remPick')].filter((x) => x.checked).map((x) => x.value);
    const byId = new Map(ok.map(({ it }) => [it.s.id, it]));
    const refresh = () => {
      const ids = picks();
      $('remCount').textContent = t('remWillGet', { n: ids.length });
      $('remSend').querySelector('span').textContent = t('remSend', { n: ids.length });
      $('remSend').disabled = !ids.length;
      $('remToggle').textContent = ids.length === ok.length ? t('remNone') : t('remAll');
      const first = byId.get(ids[0]) || ok[0]?.it;
      // Namuna — ro'yxatdagi birinchi belgilangan o'quvchi uchun, server ishlatadigan shablon bilan
      $('remPrev').innerHTML = first ? renderTpl(tplText, remVars(first, d.ym)) : '';
    };
    document.querySelectorAll('.remPick').forEach((x) => x.addEventListener('change', refresh));
    $('remToggle').addEventListener('click', () => {
      const all = picks().length !== ok.length;
      document.querySelectorAll('.remPick').forEach((x) => { x.checked = all; });
      refresh();
    });
    $('remSend').addEventListener('click', () => remindSend(picks(), d.ym));
    refresh();
  });
}

async function remindSend(ids, ym) {
  if (!ids.length || !confirm(t('remConfirm', { n: ids.length }))) return;
  const btn = $('remSend');
  btn.disabled = true;
  const label = btn.querySelector('span');
  const queue = [...ids];
  const results = new Map();
  let aborted = null, broke = false, done = 0;
  try {
    while (queue.length) {
      label.textContent = t('remProgress', { n: done, total: ids.length });
      const chunk = queue.splice(0, REMIND_CHUNK);
      const r = await edge('admin-api', { action: 'send_reminders', month: ym, student_ids: chunk });
      (r.results || []).forEach((x) => results.set(x.student_id, x));
      done += (r.results || []).length;
      if (r.aborted) { aborted = r.aborted; break; }
      // Vaqt chegarasiga yetib qolganlar — keyingi so'rovda birinchi bo'lib
      if (r.not_sent?.length) queue.unshift(...r.not_sent);
      if (!(r.results || []).length) break;          // oldinga siljish yo'q — to'xtaymiz
    }
  } catch (_e) {
    broke = true;
  } finally {
    loadPayments();
  }
  remindResult(ids, results, { aborted, broke });
}

function remindResult(ids, results, { aborted, broke }) {
  const body = $('remBody');
  if (!body) { toast(t('remDone', { n: [...results.values()].filter((x) => x.status === 'sent').length }), 'ok'); return; }
  const stById = new Map(state.students.map((s) => [s.id, s]));
  const sent = ids.filter((id) => results.get(id)?.status === 'sent').length;
  const miss = ids.filter((id) => results.get(id)?.status !== 'sent').map((id) => {
    const r = results.get(id);
    const code = !r ? 'failed' : r.status === 'unknown' ? 'unknown'
      : ['blocked', 'no_chat', 'recent', 'no_tg', 'bad_name', 'paid', 'inactive', 'not_started'].includes(r.code) ? r.code : 'failed';
    // Ism paneldagi to'liq ko'rinishda (server uni 60 belgigacha qisqartiradi)
    return { s: stById.get(id), name: stById.get(id)?.full_name || r?.name || '—', code };
  });
  body.innerHTML = `
    ${broke ? `<p class="tpl-err">${t('remBroke')}</p>` : ''}
    ${aborted ? `<p class="tpl-err">${t('remAbort_' + aborted)}</p>` : ''}
    <p class="rem-done">${t('remDone', { n: sent })}</p>
    ${miss.length ? `<div class="rem-list-head"><b>${t('remNotReached', { n: miss.length })}</b></div>
      <div class="rem-skip-list">${miss.map((m) => `<div class="rem-skip-row">
        <span class="rem-who"><span class="rem-name">${esc(m.name)}</span><small>${esc(t('remR_' + m.code, { d: '' }).replace(/ · $/, ''))}</small></span>
        ${m.s?.parent_phone ? `<a class="rem-tel" href="${esc(telHref(m.s.parent_phone))}">${esc(m.s.parent_phone)}</a>` : ''}</div>`).join('')}</div>`
      : `<p class="rem-summary">${t('remAllReached')}</p>`}
    <div class="sheet-foot"><button class="btn btn-block" data-close type="button">${t('remClose')}</button></div>`;
  body.querySelector('[data-close]').addEventListener('click', () => closeSheet());
}

// Ota-onaga "to'lov qabul qilindi" xabari. Qaytaradi: 'sent' yoki sabab kodi.
// Server bir to'lovga bir marta yuboradi — ikki oyna yoki qayta bosish ikkinchi xabar bermaydi.
async function payNotify(paymentId, keepalive = false) {
  try {
    const r = await edge('admin-api', { action: 'notify_payment', payment_id: paymentId }, { keepalive });
    return r.sent ? 'sent' : String(r.code || 'failed');
  } catch (_e) {
    return 'failed';
  }
}
const payNotifyMsgs = { no_tg: 'payNotifNoTg', muted: 'payNotifMuted', no_bot: 'remNoBot', bad_name: 'payNotifBadName' };
const payNotifMsg = (code) => t(payNotifyMsgs[code] || 'payNotifFail');

// Yangi to'lov xabari toast'dagi "Bekor qilish" tugmasi yo'qolgach yuboriladi
const PAY_NOTIFY_DELAY = 7000;   // toast (6,5 s) yopilgandan keyin — "Bekor qilish" bosilmay qolgan bo'lsa
const payPending = new Map();   // to'lov id -> taymer
function payNotifyLater(id) {
  payNotifyCancel(id);
  payPending.set(id, setTimeout(async () => {
    payPending.delete(id);
    const code = await payNotify(id);
    if (code === 'sent' || code === 'already') { if (state.view === 'payments') loadPayments(); }
    else if (code !== 'muted' && code !== 'no_bot') toast(payNotifMsg(code), 'bad');
  }, PAY_NOTIFY_DELAY));
}
function payNotifyCancel(id) {
  clearTimeout(payPending.get(id));
  payPending.delete(id);
}
// Sahifa muddat tugamasdan yopilsa — kutayotgan xabarlarni darhol jo'natamiz
addEventListener('pagehide', () => {
  for (const id of [...payPending.keys()]) { payNotifyCancel(id); payNotify(id, true); }
});

function setPayYm(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || '')) return;
  const max = payMaxYm();
  state.payYm = ym > max ? max : ym;
  state.pay = null;
  render();
}

/* ============================================================
   MOLIYA HISOBOTI — To'lovlar bo'limining ikkinchi ko'rinishi.
   Yangi so'rov yo'q: tanlangan oy va undan oldingi 11 oy to'lovlari
   loadPayments da allaqachon yuklangan (state.pay.rows).
   ============================================================ */
let finData = null;
const MONTHS_ABBR = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};
const ymAbbr = (ym) => (MONTHS_ABBR[currentLang()] || MONTHS_ABBR.uz)[Number(ym.slice(5, 7)) - 1];
// O'q yozuvlari uchun qisqa summa: 1 250 000 -> "1,25 mln", 300 000 -> "300 ming"
function sumCompact(n) {
  if (n >= 1e6) return `${String(Number((n / 1e6).toFixed(n >= 1e7 ? 0 : 2))).replace('.', ',')} ${t('mln')}`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} ${t('thousand')}`;
  return String(n);
}
// Pul o'qining yuqori chegarasi — yarmi ham "yumaloq" son bo'lsin (0 · max/2 · max)
function niceSum(v) {
  if (v <= 0) return 100000;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= v);
}

function finModel() {
  const { ym, rows } = state.pay;
  const allowed = new Set(myCourses().map((c) => c.id));
  const inFilter = (s) => !!s && allowed.has(s.course_id) && (state.courseFilter === 'all' || s.course_id === state.courseFilter);
  const byId = new Map(state.students.map((s) => [s.id, s]));
  const paidKey = new Set(rows.map((r) => `${r.student_id}|${r.month.slice(0, 7)}`));
  const rateOf = (s) => {
    const own = state.fees.get(s.id);
    if (Number.isInteger(own)) return own;
    const f = courseById(s.course_id).monthly_fee;
    return Number.isInteger(f) ? f : null;
  };
  const startOf = (s) => dayKey(s.created_at || new Date().toISOString()).slice(0, 7);
  const all = [];
  for (let i = PAY_LOOKBACK; i >= 0; i--) {
    const m = ymShift(ym, -i);
    const pays = rows.filter((r) => r.month.slice(0, 7) === m && inFilter(byId.get(r.student_id)));
    // To'lamagan: faol, shu oyga qadar qo'shilgan, shu oy uchun yozuvi yo'q (to'lovlar ro'yxatidagi qoida)
    const unpaid = state.students.filter((s) => s.active && inFilter(s) && startOf(s) <= m && !paidKey.has(`${s.id}|${m}`));
    all.push({
      m,
      sum: pays.reduce((n, r) => n + (r.amount || 0), 0),
      paid: pays.length,
      noAmount: pays.filter((r) => r.amount == null).length,
      unpaid: unpaid.length,
      debt: unpaid.reduce((n, s) => n + (rateOf(s) ?? 0), 0),
      priced: unpaid.some((s) => rateOf(s) != null),
    });
  }
  // Tizimda hech narsa bo'lmagan boshidagi oylar ko'rsatilmaydi; tanlangan oy doim qoladi
  const first = all.findIndex((x) => x.paid || x.unpaid);
  const months = first < 0 ? all.slice(-1) : all.slice(first);
  const courses = new Map();
  rows.forEach((r) => {
    const st = byId.get(r.student_id);
    if (!inFilter(st) || !months.some((x) => x.m === r.month.slice(0, 7))) return;
    courses.set(st.course_id, (courses.get(st.course_id) || 0) + (r.amount || 0));
  });
  const total = months.reduce((n, x) => n + x.sum, 0);
  return {
    ym, months, total, cur: months[months.length - 1],
    any: months.some((x) => x.paid),
    courses: [...courses.entries()].map(([id, sum]) => ({ course: courseById(id), sum }))
      .sort((a, b) => b.sum - a.sum || a.course.name.localeCompare(b.course.name)),
  };
}

function renderFinance(out) {
  hideTip();
  out.classList.remove('is-loading');
  const d = finData = finModel();
  if (!d.any) {
    out.innerHTML = `<div class="card"><div class="empty"><div class="e-ico">📊</div><b>${t('finEmpty')}</b><p>${t('finEmptyP')}</p></div></div>`;
    return;
  }
  const n = d.months.length;
  out.innerHTML = `
    <div class="stats stats-compact fin-stats">
      <div class="stat stat-sum"><b>${fmtSum(d.cur.sum)}</b><span>${I.wallet}${t('finCur', { m: esc(ymLabel(d.ym)) })}</span></div>
      <div class="stat stat-sum"><b>${fmtSum(d.total)}</b><span>${I.chart}${t('finTotal', { n })}</span></div>
      <div class="stat stat-sum"><b>${d.cur.priced ? fmtSum(d.cur.debt) : '—'}</b><span>${I.alert}${t('finDebt')}</span></div>
    </div>
    <div class="card viz-card">
      <div class="viz-head"><h3>${t('finSumT')}</h3><p>${t('finSumP')}</p></div>
      <div class="viz-plot" data-chart="finSum"></div>
      <details class="viz-table"><summary>${t('asTable')}</summary>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>${t('finColMonth')}</th>
          <th class="num">${t('finColSum')}</th><th class="num">${t('payPaid')}</th><th class="num">${t('payUnpaid')}</th><th class="num">${t('finColDebt')}</th></tr></thead>
          <tbody>${[...d.months].reverse().map((x) => `<tr><td>${esc(ymLabel(x.m))}</td>
            <td class="num">${fmtSum(x.sum)}</td><td class="num">${x.paid}</td><td class="num">${x.unpaid}</td>
            <td class="num">${x.priced ? fmtSum(x.debt) : '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="viz-note">${t('finDebtNote')}</p>
      </details>
    </div>
    <div class="card viz-card">
      <div class="viz-head"><h3>${t('finCountT')}</h3><p>${t('finCountP')}</p></div>
      <div class="viz-legend">
        <span class="lg-item"><span class="lg-swatch tone-green"></span><span class="tone-green">${I.check}</span>${t('payPaid')}</span>
        <span class="lg-item"><span class="lg-swatch tone-red"></span><span class="tone-red">${I.alert}</span>${t('payUnpaid')}</span>
      </div>
      <div class="viz-plot" data-chart="finCount"></div>
    </div>
    ${d.courses.length > 1 ? `
    <div class="card viz-card">
      <div class="viz-head"><h3>${t('finCourseT')}</h3><p>${t('finCourseP', { n })}</p></div>
      <div class="viz-plot" data-chart="finCourses"></div>
    </div>` : ''}`;
  drawCharts();
}

// Oylar o'qi: tor ekranda har ikkinchi oy yoziladi (oxirgisi — tanlangan oy — doim)
function finAxis(d, L, slot, H) {
  const n = d.months.length;
  const step = slot < 26 ? 2 : 1;
  return d.months.map((x, i) => ((n - 1 - i) % step ? '' : `<text class="viz-axis" x="${L + (i + 0.5) * slot}" y="${H - 8}" text-anchor="middle">${ymAbbr(x.m)}</text>`)).join('');
}

// Yig'ilgan pul: bitta qator — bitta rang, afsona kerak emas (sarlavha nomlaydi)
function chartFinSum(d, W) {
  const H = W < 480 ? 200 : 240, L = 58, R = 8, T = 22, B = 26;
  const pw = W - L - R, ph = H - T - B, n = d.months.length;
  const max = niceSum(Math.max(...d.months.map((x) => x.sum)));
  const slot = pw / n;
  const bw = Math.min(28, Math.max(6, slot - 6));
  const yOf = (v) => T + ph - (v / max) * ph;
  const grid = [0, max / 2, max].map((v) => `<line class="viz-grid" x1="${L}" x2="${W - R}" y1="${yOf(v)}" y2="${yOf(v)}"/>
    <text class="viz-axis" x="${L - 6}" y="${yOf(v) + 4}" text-anchor="end">${sumCompact(v)}</text>`).join('');
  const bars = d.months.map((x, i) => {
    const x0 = L + i * slot + (slot - bw) / 2;
    return x.sum > 0 ? `<path class="viz-in" d="${colPath(x0, yOf(x.sum), bw, yOf(0) - yOf(x.sum), 4)}"/>` : '';
  }).join('');
  // Faqat tanlangan oyning qiymati yoziladi — har bir ustunga raqam qo'yilmaydi. Yozuv chapga
  // cho'ziladi, shuning uchun qo'shni ustun balandroq bo'lsa, o'shaning ustidan o'tadi
  const last = d.months[n - 1];
  const lbl = sumCompact(last.sum);
  const xEnd = n > 1 ? L + (n - 0.5) * slot + bw / 2 : L + (n - 0.5) * slot;
  const lblW = lbl.length * 7.5 + 4;                                  // 12px qalin shrift, taxminan
  const under = d.months.filter((x, i) => L + (i + 1) * slot > xEnd - (n > 1 ? lblW : lblW / 2));
  const top = Math.max(...under.map((x) => x.sum));
  const lastLbl = last.sum > 0 ? `<text class="viz-value" x="${xEnd}" y="${Math.max(12, yOf(top) - 7)}" text-anchor="${n > 1 ? 'end' : 'middle'}">${lbl}</text>` : '';
  const tip = d.months.map((x) => ({
    t: ymLabel(x.m),
    v: [t('finTipSum', { n: fmtSum(x.sum) }), t('finTipPays', { n: x.paid }), x.noAmount ? t('finTipNoAmt', { n: x.noAmount }) : ''].filter(Boolean).join('\n'),
  }));
  return `
    <svg class="viz" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0"
      aria-label="${esc(t('finSumT'))}" data-cross='${esc(JSON.stringify({ L, slot, T, ph, n, tip }))}'>
      ${grid}${bars}${lastLbl}${finAxis(d, L, slot, H)}
      <line class="viz-cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" hidden/>
    </svg>`;
}

// To'ladi (pastda) · to'lamadi (ustida): tartib doim bir xil, bo'laklar orasida 2px sirt oralig'i
function chartFinCount(d, W) {
  const H = W < 480 ? 190 : 220, L = 30, R = 8, T = 10, B = 26;
  const pw = W - L - R, ph = H - T - B, n = d.months.length;
  const max = niceMax(Math.max(1, ...d.months.map((x) => x.paid + x.unpaid)));
  const slot = pw / n;
  const bw = Math.min(28, Math.max(6, slot - 6));
  const yOf = (v) => T + ph - (v / max) * ph;
  const grid = [0, max / 2, max].map((v) => Math.round(v)).map((v) => `<line class="viz-grid" x1="${L}" x2="${W - R}" y1="${yOf(v)}" y2="${yOf(v)}"/>
    <text class="viz-axis" x="${L - 6}" y="${yOf(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const cols = d.months.map((x, i) => {
    const x0 = L + i * slot + (slot - bw) / 2;
    const segs = [['in', x.paid], ['absent', x.unpaid]].filter(([, v]) => v > 0);
    let acc = 0;
    return segs.map(([k, v], j) => {
      const top = j === segs.length - 1;
      const yTop = yOf(acc + v), yBot = yOf(acc);
      acc += v;
      const h = Math.max(0, yBot - yTop - (j > 0 ? 2 : 0));
      return `<path class="viz-${k}" d="${colPath(x0, yTop, bw, h, top ? 4 : 0)}"/>`;
    }).join('');
  }).join('');
  const tip = d.months.map((x) => ({ t: ymLabel(x.m), v: `${t('payPaid')}: ${x.paid}\n${t('payUnpaid')}: ${x.unpaid}` }));
  return `
    <svg class="viz" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0"
      aria-label="${esc(t('finCountT'))}" data-cross='${esc(JSON.stringify({ L, slot, T, ph, n, tip }))}'>
      ${grid}${cols}${finAxis(d, L, slot, H)}
      <line class="viz-cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" hidden/>
    </svg>`;
}

// Kurslar: bitta rang (nominal toifa), qiymat uchida qisqa summa
function chartFinCourses(d, W) {
  const narrow = W < 480;
  const rowH = narrow ? 50 : 34, bh = 18, T = 4, R = 70;
  const L = narrow ? 0 : 150;
  const H = T + d.courses.length * rowH + 4;
  const pw = Math.max(40, W - L - R);
  const max = Math.max(1, ...d.courses.map((c) => c.sum));
  const lim = narrow ? 34 : 20;
  const bars = d.courses.map((c, i) => {
    const y = T + i * rowH + (narrow ? 24 : (rowH - bh) / 2);
    const w = Math.max(0, (c.sum / max) * pw);
    const label = cText(c.course);
    const short = label.length > lim ? label.slice(0, lim - 1) + '…' : label;
    const lx = narrow ? 0 : L - 10, ly = narrow ? T + i * rowH + 16 : y + bh / 2 + 5;
    const share = d.total ? Math.round((c.sum / d.total) * 100) : 0;
    return `<g class="viz-hit" tabindex="0" data-tip-t="${esc(label)}"
        data-tip-v="${esc(`${t('finTipSum', { n: fmtSum(c.sum) })}\n${t('finTipShare', { n: share })}`)}">
      <rect x="0" y="${T + i * rowH}" width="${W}" height="${rowH}" fill="transparent"/>
      <rect class="viz-track" x="${L}" y="${y}" width="${pw}" height="${bh}" rx="4"/>
      <path class="viz-bar" d="${barPath(L, y, w, bh, 4)}"/>
      <text class="viz-label" x="${lx}" y="${ly}" text-anchor="${narrow ? 'start' : 'end'}">${esc(short)}</text>
      <text class="viz-value" x="${L + w + 8}" y="${y + bh / 2 + 5}">${sumCompact(c.sum)}</text>
    </g>`;
  }).join('');
  return `<svg class="viz viz-h" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
    aria-label="${esc(t('finCourseT'))}">${bars}</svg>`;
}

function exportFinCsv() {
  const d = finModel();
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = [t('finColMonth'), t('finColSum'), t('payPaid'), t('payUnpaid'), t('finColDebt')];
  const lines = [head.map(q).join(';')].concat(d.months.map((x) =>
    [ymLabel(x.m), x.sum, x.paid, x.unpaid, x.priced ? x.debt : ''].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t('finCsvFile')}-${d.ym}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportPayCsv() {
  if (!state.pay) return;
  if (state.payMode === 'fin') return exportFinCsv();
  const d = payModel();
  const head = [t('payCsvName'), t('csvCourse'), t('fPhone'), t('payCsvStatus'), t('payAmount'), t('payDate'), t('payNote'), t('payCsvOwed'), t('payCsvRate'), t('payCsvDebt')];
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [...d.items].sort((a, b) => (!!a.p - !!b.p) || a.s.full_name.localeCompare(b.s.full_name));
  const lines = [head.map(q).join(';')].concat(rows.map(({ s, c, p, owed, rate, debt }) =>
    [s.full_name, c.name, s.parent_phone, p ? t('payPaid') : t('payUnpaid'), p?.amount ?? '', p?.paid_on ?? '', p?.note ?? '',
     owed.map(ymShort).join(', '), rate ?? '', debt ?? ''].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `parvoz-tolovlar-${d.ym}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ============================================================
   OTA-ONAGA XABAR SHABLONLARI
   Yuborish mark-attendance funksiyasida. Standart matn, o'zgaruvchilar va
   renderTpl u yerdagi bilan AYNAN bir xil — namuna ota-ona oladigan xabarning
   o'zi bo'lishi uchun (edge testida ikkalasi bir xil natija berishi tekshiriladi).
   ============================================================ */
const TPL_KINDS = ['in', 'out', 'absent', 'excused', 'pay', 'paid'];
const TPL_DEFAULT = {
  in:      "✅ *{ism}* soat *{vaqt}* da Parvoz O'quv Markaziga *keldi*.\n📚 {kurs}",
  out:     "🏠 *{ism}* soat *{vaqt}* da markazdan *ketdi*.\n📚 {kurs}",
  absent:  "❗️ *{ism}* bugungi darsga *kelmadi*.\n📚 {kurs}\n\nAgar sabab bo'lsa, iltimos o'qituvchiga xabar bering.",
  excused: "📝 *{ism}* bugun *sababli* qoldi.\n💬 {sabab}\n📚 {kurs}",
  // admin-api → DEFAULT_PAY bilan aynan bir xil
  pay:     "💳 Hurmatli ota-ona! *{ism}* uchun *{oy}* oyi to'lovi bizda hali qayd etilmagan.\n🗓 Qayd etilmagan oylar: {oylar}\n📚 {kurs}\n\nAgar to'lovni qilgan bo'lsangiz, iltimos, o'qituvchiga yoki markaz ma'muriyatiga ayting — tekshirib, belgilab qo'yamiz. Rahmat!",
  // admin-api → DEFAULT_PAID bilan aynan bir xil
  paid:    "✅ Hurmatli ota-ona! *{ism}* uchun *{oy}* oyi to'lovi qabul qilindi.\n💵 {summa} so'm\n📚 {kurs}\n📅 {sana}\n\nRahmat!",
};
const TPL_VARS = {
  in:      ['ism', 'vaqt', 'kurs', 'sana'],
  out:     ['ism', 'vaqt', 'kurs', 'sana'],
  absent:  ['ism', 'kurs', 'sana'],
  excused: ['ism', 'sabab', 'kurs', 'sana'],
  pay:     ['ism', 'kurs', 'oy', 'oylar'],
  paid:    ['ism', 'kurs', 'oy', 'summa', 'sana'],
};
const TPL_VAR_LABEL = { ism: 'vIsm', vaqt: 'vVaqt', kurs: 'vKurs', sana: 'vSana', sabab: 'vSabab', oy: 'vOy', oylar: 'vOylar', summa: 'vSumma' };
// Tab uchun nom va belgi: holatlar MARKS dan, to'lov xabarlari alohida
const tplMeta = (k) => k === 'pay' ? { label: t('tplPayTab'), icon: 'wallet', tone: 'gold' }
  : k === 'paid' ? { label: t('tplPaidTab'), icon: 'checks', tone: 'green' } : MARKS[k];
const TPL_MAX = 1000;

function renderTpl(text, vars) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) =>
    line.includes('{ism}') ||
    [...line.matchAll(/\{(\w+)\}/g)].every(([, n]) => !(n in vars) || vars[n] !== ''));
  return esc(lines.join('\n'))
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/\{(\w+)\}/g, (m, n) => (n in vars ? esc(vars[n]) : m))
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseTpls(raw) {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (_) { return {}; }
}
function tplSaved(kind) {
  const s = state.tpls[kind] && typeof state.tpls[kind] === 'object' ? state.tpls[kind] : {};
  return { on: s.on !== false, text: typeof s.text === 'string' && s.text.trim() ? s.text : TPL_DEFAULT[kind] };
}
const tplCurrent = (kind) => state.tplDraft[kind] || tplSaved(kind);
const tplDirty = (kind) => {
  const d = state.tplDraft[kind];
  if (!d) return false;
  const s = tplSaved(kind);
  return d.on !== s.on || d.text !== s.text;
};

// Server ham xuddi shunday tekshiradi — bu yerda faqat oldindan ko'rsatish uchun
function tplIssue(kind, text) {
  if (text.length > TPL_MAX) return t('tplErrLen', { n: TPL_MAX });
  const unknown = [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].filter((n) => !TPL_VARS[kind].includes(n));
  if (unknown.length) return t('tplErrVar', { v: unknown.map((n) => `{${n}}`).join(', ') });
  if (text.trim() && !text.includes('{ism}')) return t('tplErrIsm');
  return '';
}

// Namuna: haqiqiy o'quvchi va kurs bo'lsa — o'shalar, bo'lmasa oddiy ism
function tplSample() {
  const st = state.students.find((x) => x.active) || state.students[0];
  const course = st ? courseById(st.course_id) : state.courses[0];
  const key = todayKey();
  return {
    ism: st?.full_name || t('tplSampleName'),
    vaqt: hhmm(new Date().toISOString()),
    kurs: course?.name || '',
    // Xabar ota-onaga doim o'zbekcha sana bilan ketadi — panel tili qanday bo'lmasin
    sana: `${Number(key.slice(8, 10))}-${DATE_NAMES.uz.m[Number(key.slice(5, 7)) - 1]}`,
    sabab: t('r1'),
    oy: DATE_NAMES.uz.m[Number(key.slice(5, 7)) - 1],
    oylar: [ymShift(key.slice(0, 7), -1), key.slice(0, 7)].map((m) => DATE_NAMES.uz.m[Number(m.slice(5, 7)) - 1]).join(', '),
    summa: fmtSum(300000),
  };
}

function tplTabs() {
  return `<div class="seg seg-tpl" role="tablist" aria-label="${t('setTpl')}">${TPL_KINDS.map((k) => {
    const on = k === state.tplKind;
    const mark = tplDirty(k) ? `<i class="tpl-dot" title="${t('tplUnsaved')}"></i>`
      : !tplCurrent(k).on ? `<i class="tpl-offdot" title="${t('tplOff')}"></i>` : '';
    const m = tplMeta(k);
    return `<button class="seg-btn${on ? ' on' : ''}" role="tab" aria-selected="${on}" data-tpl-kind="${k}" type="button">
      <span class="tone-${m.tone}">${ico(m)}</span><span class="seg-lbl">${m.label}</span>${mark}</button>`;
  }).join('')}</div>`;
}

function tplBody() {
  const k = state.tplKind;
  const cur = tplCurrent(k);
  return `
    ${k === 'pay' ? `<p class="tpl-manual">${I.wallet}<span>${t('tplPayManual')}</span></p>` : `
    <label class="switch-row">
      <input type="checkbox" role="switch" id="tplOn" ${cur.on ? 'checked' : ''}>
      <span class="switch" aria-hidden="true"></span>
      <span class="switch-txt"><b>${t('tplOn')}</b><small>${t(k === 'paid' ? 'tplOnPaidP' : 'tplOnP')}</small></span>
    </label>`}
    <label class="field tpl-field"><span>${t('tplText')}</span>
      <textarea class="inp tpl-text" id="tplText" rows="5" spellcheck="false">${esc(cur.text)}</textarea></label>
    <div class="tpl-tools">
      <div class="tpl-vars" aria-label="${t('tplVars')}">${TPL_VARS[k].map((v) =>
        `<button class="chip tpl-var" data-tpl-var="${v}" type="button" title="${t('tplVars')}"><code>{${v}}</code> ${t(TPL_VAR_LABEL[v])}</button>`).join('')}</div>
      <span class="tpl-count" id="tplCount"></span>
    </div>
    <p class="f-hint tpl-hint">${t('tplHint')}</p>
    <p class="tpl-err" id="tplErr" role="alert" hidden></p>
    <div class="tpl-prev-head"><span>${t('tplPrev')}</span><span class="tpl-state" id="tplState"></span></div>
    <div class="tg-chat" id="tplChat"><div class="tg-bubble"><div class="tg-text" id="tplPrev"></div>
      <span class="tg-time">${esc(hhmm(new Date().toISOString()))}</span></div></div>
    <div class="tpl-actions">
      <button class="btn btn-ghost" id="tplReset" type="button">${I.undo}${t('tplReset')}</button>
      <button class="btn btn-primary" id="tplSave" type="button">${t('tplSave')}</button>
    </div>`;
}

// Matn yozilayotganda butun kartani qayta chizmaymiz — kursor joyida qolsin
function tplLive() {
  const k = state.tplKind;
  const cur = tplCurrent(k);
  const issue = tplIssue(k, cur.text);
  const prev = $('tplPrev'); if (!prev) return;
  prev.innerHTML = cur.text.trim() ? renderTpl(cur.text, tplSample()) : renderTpl(TPL_DEFAULT[k], tplSample());
  $('tplChat').classList.toggle('is-muted', !cur.on);
  const err = $('tplErr');
  err.hidden = !issue; err.textContent = issue;
  const n = cur.text.length;
  const cnt = $('tplCount');
  cnt.textContent = `${n} / ${TPL_MAX}`;
  cnt.classList.toggle('is-over', n > TPL_MAX);
  const isDefault = !cur.text.trim() || cur.text === TPL_DEFAULT[k];
  $('tplState').textContent = !cur.on ? t('tplMuted') : isDefault ? t('tplDefault') : t('tplCustom');
  $('tplReset').disabled = isDefault;
  $('tplSave').disabled = !tplDirty(k) || !!issue;
  $('tplTabs').innerHTML = tplTabs();
}

function tplSetDraft(patch) {
  const k = state.tplKind;
  state.tplDraft[k] = { ...tplCurrent(k), ...patch };
  if (!tplDirty(k)) delete state.tplDraft[k];
  tplLive();
}

async function tplSave() {
  const k = state.tplKind;
  const cur = tplCurrent(k);
  if (tplIssue(k, cur.text)) return;
  const btn = $('tplSave'); btn.disabled = true;
  try {
    // Standart matn bilan bir xil bo'lsa — null: standart keyin yaxshilansa, o'zi yangilanadi
    const text = !cur.text.trim() || cur.text === TPL_DEFAULT[k] ? null : cur.text;
    const r = await edge('admin-api', { action: 'save_template', kind: k, on: cur.on, text });
    state.tpls = r.templates && typeof r.templates === 'object' ? r.templates : state.tpls;
    delete state.tplDraft[k];
    toast(t('tplSaved'), 'ok');
    $('tplBody').innerHTML = tplBody();
    tplLive();
  } catch (err) {
    toast('❌ ' + err.message, 'bad');
    tplLive();
  }
}

function viewSettings() {
  const admin = isAdmin();
  return `
    <div class="page-head"><div><h2>${t('tSettings')}</h2><p>${esc(state.me.email)}</p></div></div>

    <div class="card" id="installCard" ${state.deferredInstall ? '' : 'hidden'}>
      <div class="card-head"><h3>${t('setInstall')}</h3></div>
      <p class="card-desc">${t('setInstallP')}</p>
      <button class="btn btn-primary btn-block" id="installBtn" type="button">${t('setInstallBtn')}</button>
    </div>

    ${admin ? `
    <div class="card">
      <div class="card-head"><h3>${t('setTeam')}</h3></div>
      <p class="card-desc">${t('setTeamP')}</p>
      <button class="btn btn-block" data-goto="team" type="button">${I.team} ${t('setTeamBtn')}</button>
    </div>

    <div class="card">
      <div class="card-head"><h3>${t('setBot')}</h3></div>
      <p class="card-desc">${t('setBotP')}</p>
      <div class="row" style="margin-bottom:12px">
        <div class="row-main">
          <div class="row-title">${state.botUsername ? '@' + esc(state.botUsername) : t('botNone')}</div>
          <div class="row-sub" id="whText">—</div>
        </div>
        <div class="row-actions"><button class="btn btn-sm" id="whFix" type="button">${t('reconnect')}</button></div>
      </div>
      <label class="field"><span>${t('newToken')}</span>
        <input class="inp" id="botToken" placeholder="123456:AA..." autocomplete="off"></label>
      <button class="btn btn-block" id="botSave" type="button">${t('saveToken')}</button>
    </div>

    <div class="card" id="tplCard">
      <div class="card-head"><h3>${t('setTpl')}</h3></div>
      <p class="card-desc">${t('setTplP')}</p>
      <div id="tplTabs">${tplTabs()}</div>
      <div id="tplBody">${tplBody()}</div>
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h3>${t('setNotify')}</h3></div>
      <p class="card-desc">${t('setNotifyP')}</p>
      <div id="notifyOut" class="rows" style="margin-bottom:12px"></div>
      <button class="btn btn-block" id="notifyLinkBtn" type="button">${t('setNotifyBtn')}</button>
    </div>

    <p style="text-align:center;color:var(--faint);font-size:.8rem;margin-top:18px">
      ${t('panelName')} · <a href="index.html">${t('backSite')}</a></p>`;
}


async function loadNotifyChats() {
  const out = $('notifyOut');
  if (!out) return;
  try {
    const { chats } = await edge('admin-api', { action: 'list_notify_chats' });
    out.innerHTML = chats.length
      ? chats.map((c) => `<div class="row"><div class="row-main">
          <div class="row-title">${esc(c.label || t('tgUser'))}</div>
          <div class="row-sub"><span class="badge badge-ok">${t('linkedBadge')}</span></div></div>
          <div class="row-actions"><button class="btn btn-sm btn-danger btn-ico" data-notify-del="${c.chat_id}" aria-label="${esc(t('del') + ': ' + (c.label || t('tgUser')))}" type="button">${I.trash}</button></div></div>`).join('')
      : `<div class="row"><div class="row-main"><div class="row-sub">
         <span class="badge badge-warn">${t('nobodyLinked')}</span></div></div></div>`;
  } catch (e) {
    out.innerHTML = `<div class="row" role="alert"><div class="row-main"><div class="row-sub">
      <span class="badge badge-warn">${t('loadFail')}</span></div></div>
      <div class="row-actions"><button class="btn btn-sm" data-notify-retry type="button">${t('retry')}</button></div></div>`;
  }
}

async function checkWebhook(autoFix) {
  if (!isAdmin() || !state.botUsername) return;
  try {
    const r = await edge('admin-api', { action: 'webhook_status' });
    let active = !!r.active && r.mode === 'webhook';
    if (!active && autoFix) {
      const fix = await edge('admin-api', { action: 'setup_webhook' });
      if (fix.ok) { active = true; toast(t('fastLinked'), 'ok'); }
    }
    state.tgMode = active ? 'webhook' : 'polling';
    const el = $('whText');
    if (el) el.innerHTML = active
      ? `<span class="badge badge-ok">${t('fastOn')}</span>`
      : `<span class="badge badge-warn">${t('slowOn')}</span>${r.last_error ? ' ' + esc(r.last_error) : ''}`;
  } catch (_) {}
}

/* ============================================================
   SHEET (modal) YORDAMCHISI
   ============================================================ */
// Oyna qaysi tugmadan ochilgani — yopilgach fokus o'sha joyga qaytadi, hatto ro'yxat
// qayta chizilib tugma almashgan bo'lsa ham (klaviatura foydalanuvchisi joyini yo'qotmasin)
const ORIGIN_ATTRS = ['data-edit-student', 'data-more', 'data-pay-open', 'data-lead', 'data-edit-teacher',
  'data-edit-course', 'data-link', 'data-set', 'data-add-student', 'data-add-teacher', 'data-add-course'];
let sheetOrigin = null;
let sheetOpenedAt = 0;

function openSheet(title, bodyHtml, onMount) {
  const dlg = $('sheet');
  const a = document.activeElement;
  const attr = a && ORIGIN_ATTRS.find((x) => a.hasAttribute?.(x));
  sheetOrigin = attr ? `[${attr}="${CSS.escape(a.getAttribute(attr))}"]` : null;
  $('sheetBody').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sheet-head"><h3>${title}</h3><div class="spacer"></div>
      <button class="btn btn-icon btn-ghost" data-close aria-label="${t('close')}" type="button">${I.x}</button></div>
    ${bodyHtml}`;
  sheetOpenedAt = Date.now();
  if (!dlg.open) dlg.showModal();
  $('sheetBody').querySelector('[data-close]').addEventListener('click', () => dlg.close());
  if (onMount) onMount(dlg);
}
function closeSheet() { $('sheet').close(); }

/* ---- O'quvchi qo'shish / tahrirlash ---- */
// Ota-ona telefoni: student-link dagi normPhone bilan bir xil qoida — noto'g'ri raqam bilan
// ulanish havolasi hech qachon tasdiqlanmaydi. O'zbek raqami "+998 90 123 45 67" ko'rinishida
// saqlanadi; chet el raqami "+" bilan yoziladi (998 bilan boshlanmasa).
function parentPhone(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { ok: true, value: null };
  let d = v.replace(/\D+/g, '');
  if (d.length === 13 && d.startsWith('9998')) d = d.slice(1);
  if (d.length === 9) d = '998' + d;
  if (d.length === 12 && d.startsWith('998')) {
    return { ok: true, value: `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}` };
  }
  if (v.startsWith('+') && !d.startsWith('998') && d.length >= 10 && d.length <= 15) return { ok: true, value: v.replace(/\s+/g, ' ') };
  return { ok: false };
}

function studentSheet(id) {
  const s = id ? state.students.find((x) => x.id === id) : null;
  const list = myCourses();
  // Yopiq kursdagi o'quvchining kursi ham ro'yxatda turadi — aks holda saqlashda jimgina boshqa kursga o'tib qolardi
  const cur = s ? courseById(s.course_id) : null;
  if (cur && cur.id && !list.some((c) => c.id === cur.id)) list.push(cur);
  const opts = list.map((c) => `<option value="${c.id}" ${s && s.course_id === c.id ? 'selected' : ''}>${esc(cText(c))}${c.active === false ? ` (${esc(t('courseClosed'))})` : ''}</option>`).join('');
  openSheet(s ? t('editStudent') : t('newStudent'), `
    <form id="stForm">
      <label class="field"><span>${t('fNameReq')}</span>
        <input class="inp" id="stName" required value="${esc(s?.full_name ?? '')}" aria-describedby="stNameErr"></label>
      <p class="tpl-err" id="stNameErr" role="alert" hidden></p>
      <label class="field"><span>${t('fCourseReq')}</span>
        <select class="inp" id="stCourse" required>${s ? '' : `<option value="">${t('fChoose')}</option>`}${opts}</select></label>
      <label class="field"><span>${t('fParent')}</span>
        <input class="inp" id="stParent" value="${esc(s?.parent_name ?? '')}"></label>
      <label class="field"><span>${t('fPhone')}</span>
        <input class="inp" id="stPhone" inputmode="tel" placeholder="+998 90 123 45 67" value="${esc(s?.parent_phone ?? '')}" aria-describedby="stPhoneErr">
        <small class="f-hint">${t('fPhoneHint')}</small></label>
      <p class="tpl-err" id="stPhoneErr" role="alert" hidden></p>
      ${isAdmin() ? `<label class="field"><span>${t('fStFee')}</span>
        <input class="inp" id="stFee" inputmode="numeric" autocomplete="off"
          value="${s && Number.isInteger(state.fees.get(s.id)) ? fmtSum(state.fees.get(s.id)) : ''}">
        <small class="f-hint">${t('fStFeeHint')}</small></label>
      <p class="tpl-err" id="stFeeErr" role="alert" hidden></p>` : ''}
      ${s ? `<label class="check-item" style="margin-bottom:14px">
        <input type="checkbox" id="stActive" ${s.active ? 'checked' : ''}><span>${t('fActive')}</span></label>` : ''}
      <button class="btn btn-primary btn-block" type="submit">${s ? t('save') : t('add')}</button>
      ${s ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="stDelete" type="button">${I.trash} ${t('del')}</button>` : ''}
    </form>`, () => {
    const feeIn = $('stFee');
    // Bo'sh maydonda tanlangan kursning narxi ko'rinadi — nima olinishini admin bilsin
    const feePh = () => {
      const cf = courseById($('stCourse').value).monthly_fee;
      feeIn.placeholder = Number.isInteger(cf) ? t('fStFeePh', { n: fmtSum(cf) }) : t('fStFeePhNone');
    };
    if (feeIn) {
      feePh();
      $('stCourse').addEventListener('change', feePh);
      feeIn.addEventListener('input', () => {
        const n = parseSum(feeIn.value);
        feeIn.value = n == null || Number.isNaN(n) ? feeIn.value.replace(/[^\d\s]/g, '') : fmtSum(n);
        $('stFeeErr').hidden = true;
      });
    }
    $('stForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fee = feeIn ? parseSum(feeIn.value) : undefined;
      if (feeIn && (Number.isNaN(fee) || (fee != null && fee > PAY_MAX))) {
        const er = $('stFeeErr'); er.textContent = t('payBadAmount'); er.hidden = false; feeIn.focus(); return;
      }
      const oldFee = s && Number.isInteger(state.fees.get(s.id)) ? state.fees.get(s.id) : null;
      const feeChanged = feeIn && fee !== oldFee;
      const showErr = (id, msg, focusId) => { const er = $(id); er.textContent = msg; er.hidden = !msg; if (msg) $(focusId).focus(); };
      const name = $('stName').value.replace(/\s+/g, ' ').trim();
      showErr('stNameErr', name ? '' : t('nameReq'), 'stName');
      if (!name) return;
      const phone = parentPhone($('stPhone').value);
      showErr('stPhoneErr', phone.ok ? '' : t('badPhone'), 'stPhone');
      if (!phone.ok) return;
      const row = {
        full_name: name,
        course_id: $('stCourse').value,
        parent_name: $('stParent').value.trim() || null,
        parent_phone: phone.value,
      };
      if (s) row.active = $('stActive').checked;
      if (!row.course_id) return;
      // Xuddi shu kursda xuddi shu ism — ehtimol takror qo'shilyapti
      if (!s && state.students.some((x) => x.course_id === row.course_id && fold(x.full_name) === fold(name)) &&
          !confirm(t('dupStudent', { name, course: courseById(row.course_id).name }))) return;
      // Ikki marta bosilsa ikki bir xil o'quvchi yaratilmasin
      const btn = e.submitter || $('stForm').querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      const q = s ? await sb.from('students').update(row).eq('id', s.id)
        : feeChanged ? await sb.from('students').insert(row).select('id').single()
        : await sb.from('students').insert(row);
      if (q.error) { toast('❌ ' + q.error.message, 'bad'); if (btn) btn.disabled = false; return; }
      closeSheet();
      let feeErr = null;
      const sid = s ? s.id : q.data?.id;
      if (feeChanged && sid) {
        const fq = fee == null
          ? await sb.from('student_fees').delete().eq('student_id', sid)
          : await sb.from('student_fees').upsert({ student_id: sid, monthly_fee: fee });
        feeErr = fq.error;
      }
      if (feeErr) toast(t('stFeeFail', { e: feeErr.message }), 'bad');
      else toast(s ? t('saved') : t('studentAdded'), 'ok');
      await Promise.all([loadStudents(), loadFees()]); render();
    });
    if (s) $('stDelete').addEventListener('click', async () => {
      if (!confirm(t('delStudent', { name: s.full_name }))) return;
      const { error } = await sb.from('students').delete().eq('id', s.id);
      if (error) { toast('❌ ' + (error.code === '23503' ? t('delHasPayments') : error.message), 'bad'); return; }
      closeSheet(); toast(t('deleted'), 'ok');
      await Promise.all([loadStudents(), loadToday()]); render();
    });
  });
}

/* ---- Ota-ona ulanishi: telefon bilan tasdiqlanadigan havola ---- */

// "998972344442" -> "+998 ** *** ** 42"
function maskPhone(norm) {
  const d = String(norm || '').replace(/\D+/g, '');
  if (d.length < 6) return '';
  const tail = d.slice(-4);
  return `+${d.slice(0, 3)} ** *** ${tail.slice(0, 2)} ${tail.slice(2)}`;
}

function parentLinkSheet(id) {
  const s = state.students.find((x) => x.id === id);
  if (!s) return;

  // Allaqachon ulangan
  if (s.telegram_chat_id) {
    openSheet(t('tgLink'), `
      <div class="link-state ok">
        <div class="link-ico">✅</div>
        <b>${esc(t('linkedTo', { name: s.full_name }))}</b>
        <p>${t('goesTo', { phone: esc(maskPhone(s.linked_phone) || s.parent_phone || '') })}</p>
        ${s.linked_at ? `<p class="link-dim">${t('linkedOn', { date: uzDate(s.linked_at) })}</p>` : ''}
      </div>
      <button class="btn btn-danger btn-block" id="lnUnlink" type="button">${I.x} ${t('unlink')}</button>
      <p class="link-dim" style="margin-top:10px">${t('unlinkHint')}</p>`,
      () => {
        $('lnUnlink').addEventListener('click', async () => {
          if (!confirm(t('unlinkAsk', { name: s.full_name }))) return;
          try {
            await edge('student-link', { student_id: s.id, action: 'unlink' });
            closeSheet(); toast(t('unlinked'), 'ok');
            await loadStudents(); render();
          } catch (e) { toast('❌ ' + e.message, 'bad'); }
        });
      });
    return;
  }

  // Raqam yo'q — havola berib bo'lmaydi
  if (!s.parent_phone) {
    openSheet(t('phoneNeeded'), `
      <div class="link-state warn">
        <div class="link-ico">📵</div>
        <b>${t('noParentPhone')}</b>
        <p>${t('noParentPhoneP')}</p>
      </div>
      <button class="btn btn-primary btn-block" id="lnEdit" type="button">${I.edit} ${t('enterPhone')}</button>`,
      () => $('lnEdit').addEventListener('click', () => { closeSheet(); studentSheet(s.id); }));
    return;
  }

  // Yangi havola so'raymiz
  openSheet(t('parentLinkT'),
    `<div class="link-state"><div class="skel"></div><div class="skel"></div></div>`,
    async () => {
      let r;
      try {
        r = await edge('student-link', { student_id: s.id });
      } catch (e) {
        $('sheetBody').querySelector('.link-state').outerHTML =
          `<div class="link-state warn"><div class="link-ico">⚠️</div><b>${t('linkFailed')}</b><p>${esc(e.message)}</p></div>`;
        return;
      }
      $('sheetBody').querySelector('.link-state').outerHTML = `
        <div class="link-state">
          <div class="link-ico">🔗</div>
          <b>${esc(s.full_name)}</b>
          <p>${t('sendTo', { phone: esc(r.phone_hint) })}</p>
        </div>
        <div class="link-url" id="lnUrl">${esc(r.url)}</div>
        <button class="btn btn-primary btn-block" id="lnCopy" type="button">${I.link} ${t('copyLink')}</button>
        <button class="btn btn-block" id="lnShare" style="margin-top:9px" type="button">${t('sendLink')}</button>
        <ol class="link-steps">
          <li>${t('step1')}</li>
          <li>${t('step2')}</li>
          <li>${t('step3')}</li>
        </ol>
        <p class="link-dim">${t('linkTtl', { h: r.ttl_hours })}</p>`;

      const copy = async () => {
        try { await navigator.clipboard.writeText(r.url); toast(t('linkCopied'), 'ok'); }
        catch { prompt(t('copyLinkPrompt'), r.url); }
      };
      $('lnCopy').addEventListener('click', copy);
      $('lnShare').addEventListener('click', async () => {
        const text = t('shareText', { name: s.full_name }) + '\n' + r.url;
        if (navigator.share) { try { await navigator.share({ text }); return; } catch (_) {} }
        try { await navigator.clipboard.writeText(text); toast(t('textCopied'), 'ok'); }
        catch { prompt(t('copyTextPrompt'), text); }
      });
      await loadStudents();
    });
}

/* ---- O'qituvchi qo'shish / tahrirlash ---- */
// Ro'yxat serverdan olinguncha bosilgan tugma "band" ko'rinadi — sekin internetda
// takror bosish va "hech narsa bo'lmadi" degan taassurot bo'lmasin
let teacherLoading = false;
async function teacherSheet(email, btn) {
  if (teacherLoading) return;
  let tc = null;
  let teachers = [];
  teacherLoading = true;
  btn?.classList.add('is-busy'); btn?.setAttribute('aria-busy', 'true');
  try {
    ({ teachers } = await edge('admin-api', { action: 'list_teachers' }));
  } catch (err) { toast('❌ ' + err.message, 'bad'); return; }
  finally { teacherLoading = false; btn?.classList.remove('is-busy'); btn?.removeAttribute('aria-busy'); }
  if (email) tc = teachers.find((x) => x.email.toLowerCase() === email.toLowerCase());
  // O'z rolini o'zgartirib bo'lmaydi: yagona administrator o'zini o'qituvchi qilib qo'ysa, tizim boshqaruvsiz qoladi
  const isSelf = !!tc && tc.email.toLowerCase() === state.me.email.toLowerCase();
  const checks = state.courses.map((c) => `
    <label class="check-item"><input type="checkbox" value="${c.id}" class="tcCourse"
      ${tc && tc.course_ids.includes(c.id) ? 'checked' : ''}><span>${cIcon(c)} ${esc(c.name)}</span></label>`).join('');

  openSheet(tc ? t('editTeacher') : t('newTeacher'), `
    <form id="tForm">
      <label class="field"><span>${t('fName')}</span>
        <input class="inp" id="tName" value="${esc(tc?.full_name ?? '')}"></label>
      <label class="field"><span>${t('fEmailReq')}</span>
        <input class="inp" id="tEmail" type="email" required ${tc ? 'readonly' : ''} value="${esc(tc?.email ?? '')}"></label>
      <label class="field"><span>${t('fPass')} ${tc ? t('passKeep') : '*'}</span>
        <input class="inp" id="tPass" type="password" minlength="8" autocomplete="new-password" ${tc ? '' : 'required'}></label>
      <label class="field"><span>${t('fRole')}</span>
        <select class="inp" id="tRole"${isSelf ? ` disabled title="${esc(t('selfRole'))}"` : ''}>
          <option value="teacher" ${tc?.role !== 'admin' ? 'selected' : ''}>${t('roleTeacherOpt')}</option>
          <option value="admin" ${tc?.role === 'admin' ? 'selected' : ''}>${t('roleAdminOpt')}</option>
        </select></label>
      <div class="field" id="coursesField"><span>${t('assignedCourses')}</span>
        <div class="check-list">${checks}</div></div>
      <button class="btn btn-primary btn-block" type="submit">${t('save')}</button>
      ${tc && tc.email.toLowerCase() !== state.me.email.toLowerCase()
        ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="tDelete" type="button">${I.trash} ${t('del')}</button>` : ''}
    </form>`, () => {
    const syncRole = () => { $('coursesField').style.display = $('tRole').value === 'admin' ? 'none' : ''; };
    $('tRole').addEventListener('change', syncRole); syncRole();

    $('tForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newEmail = $('tEmail').value.trim();
      // Yangi hisob formasi mavjud emailni jimgina qayta yozmasin (ism, rol, parol, kurslar)
      if (!tc && teachers.some((x) => x.email.toLowerCase() === newEmail.toLowerCase())) {
        toast('❌ ' + t('teacherExists'), 'bad'); $('tEmail').focus(); return;
      }
      const btn = e.submitter; if (btn) btn.disabled = true;
      try {
        await edge('admin-api', {
          action: 'save_teacher',
          create: !tc,
          email: newEmail,
          password: $('tPass').value,
          full_name: $('tName').value.trim(),
          role: $('tRole').value,
          course_ids: [...document.querySelectorAll('.tcCourse:checked')].map((i) => i.value),
        });
        closeSheet(); toast(t('saved'), 'ok'); loadTeam();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
      finally { if (btn) btn.disabled = false; }
    });

    if (tc && $('tDelete')) $('tDelete').addEventListener('click', async () => {
      if (!confirm(t('delTeacher', { email: tc.email }))) return;
      try {
        await edge('admin-api', { action: 'remove_teacher', email: tc.email });
        closeSheet(); toast(t('deleted'), 'ok'); loadTeam();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
    });
  });
}

/* ---- Kurs qo'shish / tahrirlash ---- */
function courseSheet(id) {
  const c = id ? state.courses.find((x) => x.id === id) : null;
  const colors = ['sky', 'green', 'teal', 'violet', 'rose', 'gold'];
  const colorNames = Object.fromEntries(t('colorName').split(',').map((x) => x.split(':')));
  openSheet(c ? t('editCourse') : t('newCourse'), `
    <form id="cForm">
      <label class="field"><span>${t('fNameStar')}</span>
        <input class="inp" id="cName" required value="${esc(c?.name ?? '')}"></label>
      <label class="field"><span>${t('fIcon')}</span>
        <span class="ic-field"><input class="inp" id="cIcon" maxlength="4" value="${esc(c?.icon ?? '📘')}">
          <span class="ic-prev" id="cIconPrev" aria-hidden="true">${cIcon({ icon: c?.icon ?? '📘' })}</span></span></label>
      <label class="field"><span>${t('fColor')}</span>
        <span class="ic-field"><select class="inp" id="cColor">${colors.map((x) =>
          `<option value="${x}" ${c?.color === x ? 'selected' : ''}>${esc(colorNames[x] || x)}</option>`).join('')}</select>
          <span class="ic-prev color-prev" id="cColorPrev" aria-hidden="true" style="--acc:var(--${c?.color ?? 'sky'})"></span></span></label>
      <label class="field"><span>${t('fFee')}</span>
        <input class="inp" id="cFee" inputmode="numeric" autocomplete="off" placeholder="${t('fFeePh')}"
          value="${Number.isInteger(c?.monthly_fee) ? fmtSum(c.monthly_fee) : ''}">
        <small class="f-hint">${t('fFeeHint')}</small></label>
      <p class="tpl-err" id="cErr" role="alert" hidden></p>
      <label class="check-item" style="margin-bottom:14px">
        <input type="checkbox" id="cActive" ${!c || c.active ? 'checked' : ''}><span>${t('fOpen')}</span></label>
      <button class="btn btn-primary btn-block" type="submit">${t('save')}</button>
      ${c ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="cDelete" type="button">${I.trash} ${t('del')}</button>` : ''}
    </form>`, () => {
    // Belgi qanday ko'rinishini darhol ko'rsatamiz (bayroq emojisi SVG bo'lib chiziladi)
    $('cIcon').addEventListener('input', () => { $('cIconPrev').innerHTML = cIcon({ icon: $('cIcon').value.trim() }); });
    $('cColor').addEventListener('change', () => { $('cColorPrev').style.setProperty('--acc', `var(--${$('cColor').value})`); });
    const feeIn = $('cFee');
    feeIn.addEventListener('input', () => {
      const n = parseSum(feeIn.value);
      feeIn.value = n == null || Number.isNaN(n) ? feeIn.value.replace(/[^\d\s]/g, '') : fmtSum(n);
      $('cErr').hidden = true;
    });
    $('cForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fee = parseSum(feeIn.value);
      if (Number.isNaN(fee) || (fee != null && fee > PAY_MAX)) {
        const er = $('cErr'); er.textContent = t('payBadAmount'); er.hidden = false; feeIn.focus(); return;
      }
      const btn = e.submitter || $('cForm').querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        await edge('admin-api', {
          action: 'save_course', id: c?.id ?? null,
          name: $('cName').value.trim(), icon: $('cIcon').value.trim(),
          color: $('cColor').value, active: $('cActive').checked, monthly_fee: fee,
        });
        closeSheet(); toast(t('saved'), 'ok');
        await loadCourses(); render();
      } catch (err) {
        // Masalan, bunday nomli kurs bor — oyna ochiq qoladi, tuzatib qayta saqlash mumkin
        const er = $('cErr'); er.textContent = err.message; er.hidden = false;
        if (btn) btn.disabled = false;
        $('cName').focus();
      }
    });
    if (c) $('cDelete').addEventListener('click', async () => {
      if (!confirm(t('delCourse', { name: c.name }))) return;
      try {
        await edge('admin-api', { action: 'remove_course', id: c.id });
        closeSheet(); toast(t('deleted'), 'ok');
        await loadCourses(); render();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
    });
  });
}

/* ============================================================
   HODISALAR
   ============================================================ */
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

document.addEventListener('click', async (e) => {
  const el = e.target;

  const goto = el.closest('[data-goto]');
  if (goto) { go(goto.dataset.goto); return; }

  const lf = el.closest('[data-lead-filter]');
  if (lf) { state.leadFilter = lf.dataset.leadFilter; render(); return; }
  const leadBtn = el.closest('[data-lead]');
  if (leadBtn) return leadSheet(leadBtn.dataset.lead);

  const chip = el.closest('[data-chip]');
  if (chip) {
    state.courseFilter = chip.dataset.chip;
    if (state.view === 'report') {
      document.querySelectorAll('[data-chip]').forEach((b) => b.classList.toggle('on', b.dataset.chip === state.courseFilter));
      loadReport();
    } else if (state.view === 'payments' && state.pay) {
      // Kurs filtri faqat ro'yxatni o'zgartiradi — bazaga qayta so'rov shart emas
      document.querySelectorAll('[data-chip]').forEach((b) => b.classList.toggle('on', b.dataset.chip === state.courseFilter));
      renderPayments();
    } else render();
    return;
  }

  // Hisobot bo'limlari: Jurnal / Diagrammalar / Ro'yxat
  const repTab = el.closest('[data-rep-tab]');
  if (repTab) {
    state.repTab = repTab.dataset.repTab;
    try { localStorage.setItem('parvoz-rep-tab', state.repTab); } catch (_) {}
    hideTip();
    return renderReport();
  }

  // Jurnal katagi: o'sha kunni Davomat ekranida ochamiz (tuzatish uchun)
  const jump = el.closest('[data-jump]');
  if (jump) {
    hideTip();
    const key = jump.dataset.jump;
    if (key < shiftDay(todayKey(), -30)) { toast(t('tooOld')); return; }
    state.day = key === todayKey() ? null : key;
    state.today = [];
    state.dayLoading = true;
    go('today');
    return setDay(key);
  }

  if (el.closest('[data-add-student]')) return studentSheet(null);
  const edS = el.closest('[data-edit-student]');
  if (edS) return studentSheet(edS.dataset.editStudent);
  if (el.closest('[data-add-teacher]')) return teacherSheet(null, el.closest('[data-add-teacher]'));
  const edT = el.closest('[data-edit-teacher]');
  if (edT) return teacherSheet(edT.dataset.editTeacher, edT);
  if (el.closest('[data-add-course]')) return courseSheet(null);
  const edC = el.closest('[data-edit-course]');
  if (edC) return courseSheet(edC.dataset.editCourse);

  const langTrig = el.closest('#langBtn');
  if (langTrig) { toggleMenu(langTrig, $('langMenu')); return; }
  const userTrig = el.closest('#userBtn');
  if (userTrig) { toggleMenu(userTrig, $('userMenu')); return; }
  if (!el.closest('.menu')) closeMenus();

  const langBtn = el.closest('[data-lang], [data-lang-pick]');
  if (langBtn) { setLang(langBtn.dataset.lang || langBtn.dataset.langPick); return; }

  const themeBtn = el.closest('[data-theme-toggle]');
  if (themeBtn) { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); return; }

  const linkBtn = el.closest('[data-link]');
  if (linkBtn) return parentLinkSheet(linkBtn.dataset.link);

  // Kun tanlagich
  const shift = el.closest('[data-day-shift]');
  if (shift) return setDay(shiftDay(selDay(), Number(shift.dataset.dayShift)));
  if (el.closest('#dayToday')) return setDay(todayKey());

  // Butun guruhni "Keldi" qilish
  const grp = el.closest('[data-group-mark]');
  if (grp) return sendGroupMark(grp.dataset.groupMark, 'in');

  const mark = el.closest('[data-mark]');
  if (mark) {
    // Darhol javob beradi — render() tugmani baribir qayta chizadi
    await sendMark(mark.dataset.id, mark.dataset.mark);
    return;
  }

  // Kelmadi / Sababli tugmalari. Bugun "Keldi/Ketdi" bo'lsa — o'chishidan oldin so'raymiz.
  const set = el.closest('[data-set]');
  if (set) {
    if (set.disabled || !confirmReplace(set.dataset.id, set.dataset.set)) return;
    if (set.dataset.set === 'excused') {
      const st = state.students.find((x) => x.id === set.dataset.id);
      return st && reasonSheet(st);
    }
    await sendMark(set.dataset.id, 'absent');
    return;
  }

  // Yuklash xatosidan keyin "Qayta urinish"
  const retry = el.closest('[data-retry]');
  if (retry) {
    retry.disabled = true;
    await refreshAll();
    return render();
  }

  // Qatorning tugmalardan tashqari joyi bosilsa — bugungi belgilar oynasi
  const more = el.closest('[data-more]');
  if (more) return markSheet(more.dataset.more);

  const repRow = el.closest('[data-row]');
  if (repRow) {
    const d = document.querySelector(`[data-detail="${repRow.dataset.row}"]`);
    if (d) d.classList.toggle('hidden');
    return;
  }

  if (el.closest('#notifyLinkBtn')) {
    const btn = el.closest('#notifyLinkBtn');
    btn.disabled = true;
    try {
      const r = await edge('admin-api', { action: 'admin_link' });
      openSheet(t('notifyLink'), `
        <p class="card-desc">${t('notifyLinkP')}</p>
        <a class="btn btn-primary btn-block" href="${r.link}" target="_blank" rel="noopener">${t('openInTg')}</a>
        <button class="btn btn-block" style="margin-top:9px" data-copy-link="${esc(r.link)}" type="button">${t('copyLink')}</button>`,
        () => {
          const cp = document.querySelector('[data-copy-link]');
          cp.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(cp.dataset.copyLink); toast(t('copied'), 'ok'); }
            catch { prompt(t('linkLabel'), cp.dataset.copyLink); }
          });
        });
    } catch (err) { toast('\u274C ' + err.message, 'bad'); }
    finally { btn.disabled = false; }
    return;
  }

  if (el.closest('[data-notify-retry]')) return loadNotifyChats();
  const nd = el.closest('[data-notify-del]');
  if (nd) {
    try {
      await edge('admin-api', { action: 'remove_notify_chat', chat_id: Number(nd.dataset.notifyDel) });
      toast(t('deleted'), 'ok'); loadNotifyChats();
    } catch (err) { toast('\u274C ' + err.message, 'bad'); }
    return;
  }

  if (el.closest('#csvBtn')) return exportCsv();
  if (el.closest('#logoutBtn')) return logout();

  if (el.closest('#botSave')) {
    const token = $('botToken').value.trim();
    if (!token) { toast(t('tokenNeeded'), 'bad'); return; }
    const btn = $('botSave'); btn.disabled = true;
    try {
      const r = await edge('admin-api', { action: 'save_bot_token', token });
      toast(t('botLinked', { name: r.username }), 'ok');
      if (r.webhook === false) toast(t('fastFailed') + (r.webhook_error || ''), 'bad');
      await loadConfig(); render(); checkWebhook(false);
    } catch (err) { toast('❌ ' + err.message, 'bad'); }
    finally { btn.disabled = false; }
    return;
  }

  const payShift = el.closest('[data-pay-shift]');
  if (payShift && !payShift.disabled) return setPayYm(ymShift(payYm(), Number(payShift.dataset.payShift)));
  const payTab = el.closest('[data-pay-tab]');
  if (payTab) {
    state.payTab = payTab.dataset.payTab;
    try { localStorage.setItem('parvoz-pay-tab', state.payTab); } catch (_) {}
    return renderPayments();
  }
  if (el.closest('#remOpen')) return remindSheet();
  const payOpen = el.closest('[data-pay-open]');
  if (payOpen) return paySheet(payOpen.dataset.payOpen);
  if (el.closest('#payCsv')) return exportPayCsv();
  if (el.closest('#payMode')) {
    state.payMode = state.payMode === 'fin' ? 'list' : 'fin';
    try { localStorage.setItem('parvoz-pay-mode', state.payMode); } catch (_) {}
    const btn = $('payMode');
    btn.setAttribute('aria-pressed', String(state.payMode === 'fin'));
    btn.innerHTML = state.payMode === 'fin' ? `${I.users} ${t('payListBtn')}` : `${I.chart} ${t('payFinBtn')}`;
    return renderPayments();
  }

  const tplTab = el.closest('[data-tpl-kind]');
  if (tplTab) {
    state.tplKind = tplTab.dataset.tplKind;
    $('tplBody').innerHTML = tplBody();
    tplLive();
    $('tplTabs').querySelector('.seg-btn.on')?.focus();
    return;
  }
  const tplVar = el.closest('[data-tpl-var]');
  if (tplVar) {
    const ta = $('tplText');
    const ins = `{${tplVar.dataset.tplVar}}`;
    ta.focus();
    ta.setRangeText(ins, ta.selectionStart, ta.selectionEnd, 'end');
    tplSetDraft({ text: ta.value });
    return;
  }
  if (el.closest('#tplReset')) {
    const ta = $('tplText');
    ta.value = TPL_DEFAULT[state.tplKind];
    tplSetDraft({ text: ta.value });
    return;
  }
  if (el.closest('#tplSave')) return tplSave();

  if (el.closest('#whFix')) {
    try {
      const r = await edge('admin-api', { action: 'setup_webhook' });
      toast(r.ok ? t('fastOnToast') : '❌ ' + (r.error || ''), r.ok ? 'ok' : 'bad');
      checkWebhook(false);
    } catch (err) { toast('❌ ' + err.message, 'bad'); }
    return;
  }

  if (el.closest('#installBtn') && state.deferredInstall) {
    state.deferredInstall.prompt();
    state.deferredInstall = null;
    $('installCard')?.setAttribute('hidden', '');
    return;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'tplText') return tplSetDraft({ text: e.target.value });
  if (e.target.id === 'payQ') {
    state.payQ = e.target.value;
    const d = payModel();
    $('payList').innerHTML = payListHtml(d, ['unpaid', 'paid', 'all'].includes(state.payTab) ? state.payTab : 'unpaid');
    return;
  }
  if (e.target.id === 'searchInp') {
    state.search = e.target.value;
    renderSearchResults();
  }
});

/* ---- Diagramma va jurnal ko'rsatkichi: sichqoncha, barmoq va klaviatura ---- */
document.addEventListener('pointermove', (e) => {
  const svg = e.target.closest?.('svg[data-cross]');
  if (svg) {
    const c = JSON.parse(svg.dataset.cross);
    const box = svg.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * svg.viewBox.baseVal.width;
    return crossAt(svg, Math.floor((vx - c.L) / c.slot));
  }
  const tip = e.target.closest?.('[data-tip-t]');
  if (tip) return showTip(tip.dataset.tipT, tip.dataset.tipV, e.clientX, e.clientY);
  hideTip();
});
document.addEventListener('pointerleave', hideTip);
document.addEventListener('pointerout', (e) => {
  const svg = e.target.closest?.('svg[data-cross]');
  if (svg && !svg.contains(e.relatedTarget)) {
    svg.querySelector('.viz-cross')?.setAttribute('hidden', '');
    hideTip();
  }
});
document.addEventListener('focusin', (e) => {
  const svg = e.target.closest?.('svg[data-cross]');
  if (svg) return crossAt(svg, Number(svg.dataset.idx ?? 0));
  const tip = e.target.closest?.('[data-tip-t]');
  if (tip) {
    const r = tip.getBoundingClientRect();
    showTip(tip.dataset.tipT, tip.dataset.tipV, r.left + r.width / 2, r.top);
  }
});
document.addEventListener('focusout', (e) => {
  if (e.target.closest?.('svg[data-cross]')) e.target.querySelector?.('.viz-cross')?.setAttribute('hidden', '');
  hideTip();
});
document.addEventListener('keydown', (e) => {
  const svg = e.target.closest?.('svg[data-cross]');
  if (!svg || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault();
  crossAt(svg, Number(svg.dataset.idx ?? 0) + (e.key === 'ArrowRight' ? 1 : -1));
});
// Ko'rsatkich ekranga qadalgan — sahifa yoki jurnal siljisa yashiramiz
window.addEventListener('scroll', hideTip, { passive: true, capture: true });

document.addEventListener('change', (e) => {
  if (e.target.id === 'repMonth') { hideTip(); loadReport(); }
  if (e.target.id === 'dayPick') setDay(e.target.value);
  if (e.target.id === 'tplOn') tplSetDraft({ on: e.target.checked });
  if (e.target.id === 'payMonth') setPayYm(e.target.value);
});
// Telefon qulfdan chiqqanda / ilovaga qaytilganda ma'lumot yangilanadi (yarim tun ham shu yerda ushlanadi)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshOnResume();
});
window.addEventListener('pageshow', (e) => { if (e.persisted) refreshOnResume(); });
// Internet uzildi / qaytdi: ogohlantiramiz va qaytganda darhol yangilaymiz
window.addEventListener('offline', () => { if (state.me) toast(t('offline'), 'bad'); });
window.addEventListener('online', () => { state.resumeAt = 0; refreshOnResume(); });

// Saqlanmagan shablon bilan sahifani yopishdan oldin ogohlantiramiz
window.addEventListener('beforeunload', (e) => {
  if (!state.leaving && TPL_KINDS.some(tplDirty)) { e.preventDefault(); e.returnValue = ''; }
});

// Ochgan bosishning ikkinchisi (double-click / ikki marta tegish) fonga tushib oynani darhol
// yopib yubormasin — ochilgandan keyingi 350 ms dagi fon bosishlari hisobga olinmaydi
$('sheet').addEventListener('click', (e) => {
  if (e.target === $('sheet') && Date.now() - sheetOpenedAt > 350) closeSheet();
});
$('sheet').addEventListener('close', () => {
  const sel = sheetOrigin;
  if (!sel) return;
  const tryFocus = () => {
    const a = document.activeElement;
    if (a && a !== document.body && document.contains(a)) return true;
    const el = document.querySelector(sel);
    if (el) { el.focus({ preventScroll: true }); return true; }
    return false;
  };
  // Saqlashdan keyin ro'yxat biroz kechikib qayta chiziladi — bir necha urinish
  [0, 300, 900].forEach((ms) => setTimeout(tryFocus, ms));
});

/* ============================================================
   PWA
   ============================================================ */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstall = e;
  if (state.view === 'settings') render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ============================================================
   START
   ============================================================ */
initAuth();
