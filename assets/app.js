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
  today: [],
  leads: [],
  leadFilter: 'new',
  view: 'today',
  courseFilter: 'all',
  search: '',
  botUsername: null,
  tgMode: null,
  timer: null,
  deferredInstall: null,
};

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
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
};

/* ---------------- Yordamchilar ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function edge(fn, payload) {
  let token = SUPABASE_ANON;
  try {
    const { data } = await sb.auth.getSession();
    if (data.session) { state.session = data.session; token = data.session.access_token; }
  } catch (_) { token = state.session?.access_token ?? SUPABASE_ANON; }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Xatolik (${res.status})`);
  return data;
}

const TZ = 'Asia/Samarkand';
const dayKey = (iso) => new Intl.DateTimeFormat('en-CA',
  { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const hhmm = (iso) => new Intl.DateTimeFormat('uz-UZ',
  { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const todayKey = () => dayKey(new Date());

// Brauzer uz-UZ oy nomlarini "M09" deb beradi — o'zimiz formatlaymiz
const UZ_MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
const UZ_DAYS = ['yakshanba','dushanba','seshanba','chorshanba','payshanba','juma','shanba'];
function uzDate(d = new Date()) {
  const key = dayKey(d);                       // YYYY-MM-DD (Samarqand)
  const [y, m, day] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${day}-${UZ_MONTHS[m - 1]}, ${UZ_DAYS[wd]}`;
}
const currentYm = () => todayKey().slice(0, 7);

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const OFF = 5 * 3600 * 1000;
  return [new Date(Date.UTC(y, m - 1, 1) - OFF).toISOString(), new Date(Date.UTC(y, m, 1) - OFF).toISOString()];
}

const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const courseById = (id) => state.courses.find((c) => c.id === id) || { name: '—', icon: '📘', color: 'sky' };
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
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('parvoz-theme', t); } catch (_) {}
  const meta = $('themeColor');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f2f6fd' : '#070e20');
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.innerHTML = t === 'light' ? I.sun : I.moon;
    b.setAttribute('aria-label', t === 'light' ? "Qorong'i rejimga o'tish" : "Yorug' rejimga o'tish");
  });
}

/* ============================================================
   AUTENTIFIKATSIYA
   ============================================================ */
let needsBootstrap = false;

async function initAuth() {
  setTheme(currentTheme());
  try {
    const st = await edge('admin-api', { action: 'status' });
    needsBootstrap = !!st.needs_bootstrap;
  } catch (_) { /* status ishlamasa ham login ko'rinadi */ }

  if (needsBootstrap) {
    $('authTitle').textContent = 'Birinchi sozlash';
    $('authSub').textContent = 'Administrator hisobini yarating';
    $('authName').closest('.field').classList.remove('hidden');
    $('authSubmit').textContent = 'Hisob yaratish';
    $('authPass').autocomplete = 'new-password';
  }

  const { data } = await sb.auth.getSession();
  if (data.session) { state.session = data.session; await enterApp(); }
  else $('boot').classList.add('hidden');
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
    if (error) throw new Error(error.message === 'Invalid login credentials' ? "Email yoki parol noto'g'ri" : error.message);
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
  } catch (_) {
    $('authErr').textContent = 'Bu hisobga davomat tizimiga kirish ruxsati berilmagan.';
    await sb.auth.signOut();
    state.session = null;
    $('boot').classList.add('hidden');
    return;
  }

  $('auth').classList.add('hidden');
  $('boot').classList.add('hidden');
  $('app').classList.remove('hidden');

  buildNav();
  renderUserCard();
  await refreshAll();
  go(location.hash.replace('#', '') || 'today');

  if (isAdmin()) {
    await checkWebhook(true);
  }
  clearInterval(state.timer);
  state.timer = setInterval(refreshLinks, 30000);
}

async function refreshAll() {
  await Promise.all([loadCourses(), loadStudents(), loadToday(), loadConfig(), loadLeadsData()]);
  renderCounts();
}

async function loadCourses() {
  const { data } = await sb.from('courses').select('*').order('sort');
  state.courses = data ?? [];
}
async function loadStudents() {
  const { data } = await sb.from('students').select('*').order('full_name');
  state.students = data ?? [];
}
async function loadToday() {
  const start = new Date(`${todayKey()}T00:00:00+05:00`).toISOString();
  const { data } = await sb.from('attendance').select('*').gte('occurred_at', start).order('occurred_at');
  state.today = data ?? [];
}
async function loadLeadsData() {
  const { data } = await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(300);
  state.leads = data ?? [];
}

async function loadConfig() {
  const { data } = await sb.from('app_config').select('key,value').in('key', ['bot_username', 'tg_mode']);
  const cfg = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  state.botUsername = cfg.bot_username ?? null;
  state.tgMode = cfg.tg_mode ?? null;
}

async function refreshLinks() {
  const before = state.students.filter((s) => s.telegram_chat_id).length;
  await loadStudents();
  const after = state.students.filter((s) => s.telegram_chat_id).length;
  if (after !== before) {
    if (after > before) toast(`✅ ${after - before} ta ota-ona Telegramga ulandi`, 'ok');
    render();
  }
}

/* ============================================================
   NAVIGATSIYA
   ============================================================ */
const VIEWS = [
  { id: 'today',    label: 'Davomat',     icon: 'check',  title: 'Bugungi davomat' },
  { id: 'leads',    label: 'Arizalar',    icon: 'inbox',  title: 'Arizalar' },
  { id: 'students', label: "O'quvchilar", icon: 'users',  title: "O'quvchilar" },
  { id: 'report',   label: 'Hisobot',     icon: 'chart',  title: 'Oylik hisobot' },
  { id: 'team',     label: 'Jamoa',       icon: 'team',   title: "Jamoa", admin: true },
  { id: 'settings', label: 'Sozlamalar',  icon: 'gear',   title: 'Sozlamalar' },
];

function visibleViews() { return VIEWS.filter((v) => !v.admin || isAdmin()); }

function buildNav() {
  const items = visibleViews();
  $('sideNav').innerHTML = items.map((v) =>
    `<button class="nav-item" data-go="${v.id}" type="button">${I[v.icon]}<span>${v.label}</span>
      <span class="nav-count" data-count="${v.id}" hidden></span></button>`).join('');

  // Telefonda 4 tadan ko'p bo'lsa oxirgilari "Yana" oynasiga tushadi
  const MAX = 4;
  const main = items.length > MAX ? items.slice(0, MAX) : items;
  const rest = items.length > MAX ? items.slice(MAX) : [];
  $('tabbarInner').innerHTML =
    main.map((v) => `<button class="tab-item" data-go="${v.id}" type="button">${I[v.icon]}<span>${v.label}</span>
      <span class="nav-count" data-count="${v.id}" hidden></span></button>`).join('') +
    (rest.length ? `<button class="tab-item" id="moreTab" type="button">${I.dots}<span>Yana</span></button>` : '');

  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  const more = $('moreTab');
  if (more) more.addEventListener('click', () => {
    openSheet('Yana', `<div class="check-list">${rest.map((v) =>
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

function renderUserCard() {
  const me = state.me;
  const roleTxt = isAdmin() ? 'Administrator' : 'O\'qituvchi';
  $('userCard').innerHTML =
    `<div class="avatar" style="--acc:var(--gold)">${esc(initials(me.full_name || me.email))}</div>
     <div class="u-meta"><div class="u-name">${esc(me.full_name || me.email.split('@')[0])}</div>
     <div class="u-role">${roleTxt}</div></div>`;
}

function go(view) {
  if (!visibleViews().some((v) => v.id === view)) view = 'today';
  state.view = view;
  history.replaceState(null, '', '#' + view);
  document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  $('pageTitle').textContent = VIEWS.find((v) => v.id === view).title;
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  const el = $('page');
  if (state.view === 'today') el.innerHTML = viewToday();
  else if (state.view === 'leads') { el.innerHTML = viewLeadsShell(); loadLeads(); }
  else if (state.view === 'students') el.innerHTML = viewStudents();
  else if (state.view === 'report') { el.innerHTML = viewReportShell(); loadReport(); }
  else if (state.view === 'team') { el.innerHTML = viewTeamShell(); loadTeam(); }
  else { el.innerHTML = viewSettings(); if (isAdmin()) loadNotifyChats(); }
}

/* ============================================================
   KO'RINISH: BUGUNGI DAVOMAT
   ============================================================ */
function courseChips() {
  const list = myCourses();
  if (list.length <= 1) return '';
  const chip = (id, label, icon, color) =>
    `<button class="chip ${state.courseFilter === id ? 'on' : ''}" style="--acc:var(--${color})" data-chip="${id}" type="button">${icon ? icon + ' ' : ''}${esc(label)}</button>`;
  return `<div class="chips">${chip('all', 'Barchasi', '', 'gold')}${list.map((c) => chip(c.id, c.name, c.icon, c.color)).join('')}</div>`;
}

function visibleStudents() {
  const allowed = new Set(myCourses().map((c) => c.id));
  const q = state.search.trim().toLowerCase();
  return state.students.filter((s) =>
    allowed.has(s.course_id) &&
    (state.courseFilter === 'all' || s.course_id === state.courseFilter) &&
    (!q || s.full_name.toLowerCase().includes(q)));
}

const recFor = (sid, kind) => state.today.find((r) => r.student_id === sid && r.kind === kind);

function viewToday() {
  const list = visibleStudents().filter((s) => s.active);
  const dateTxt = uzDate();
  const inCount = new Set(state.today.filter((r) => r.kind === 'in').map((r) => r.student_id)).size;
  const outCount = new Set(state.today.filter((r) => r.kind === 'out').map((r) => r.student_id)).size;

  if (!myCourses().length) {
    return `<div class="page-head"><div><h2>Bugungi davomat</h2><p>${dateTxt}</p></div></div>
      <div class="card"><div class="empty"><div class="e-ico">🔒</div><b>Sizga hali kurs biriktirilmagan</b>
      <p>Administrator sizga fan biriktirgandan so'ng o'quvchilar shu yerda ko'rinadi.</p></div></div>`;
  }

  const groups = {};
  list.forEach((s) => { (groups[s.course_id] ??= []).push(s); });

  const body = !list.length
    ? `<div class="card"><div class="empty"><div class="e-ico">🧑‍🎓</div><b>O'quvchi topilmadi</b>
       <p>${state.search ? 'Qidiruvga mos o\'quvchi yo\'q.' : 'Avval o\'quvchilarni qo\'shing.'}</p>
       ${state.search ? '' : '<button class="btn btn-primary" data-add-student type="button">' + I.plus + ' O\'quvchi qo\'shish</button>'}</div></div>`
    : Object.entries(groups).map(([cid, arr]) => {
      const c = courseById(cid);
      return `<div class="group-title">${c.icon} ${esc(c.name)} · ${arr.length}</div>
        <div class="rows">${arr.map((s) => rowToday(s, c)).join('')}</div>`;
    }).join('');

  return `
    <div class="page-head">
      <div><h2>Bugungi davomat</h2><p>${dateTxt}</p></div>
      <div class="spacer"></div>
    </div>
    <div class="stats">
      <div class="stat"><b>${list.length}</b><span>O'quvchi</span></div>
      <div class="stat"><b style="color:var(--green-ink)">${inCount}</b><span>Keldi</span></div>
      <div class="stat"><b>${outCount}</b><span>Ketdi</span></div>
      <div class="stat"><b>${Math.max(0, list.length - inCount)}</b><span>Kutilmoqda</span></div>
    </div>
    ${courseChips()}
    <label class="field" style="margin:14px 0">
      <span class="sr-only">Qidirish</span>
      <input class="inp" id="searchInp" placeholder="🔍 O'quvchini qidirish..." value="${esc(state.search)}">
    </label>
    ${body}`;
}

function rowToday(s, c) {
  const rin = recFor(s.id, 'in');
  const rout = recFor(s.id, 'out');
  return `<div class="row">
    <div class="avatar" style="--acc:var(--${c.color})">${esc(initials(s.full_name))}</div>
    <div class="row-main">
      <div class="row-title">${esc(s.full_name)}
        ${s.telegram_chat_id ? '' : '<span class="badge" title="Telegram ulanmagan">🔕</span>'}</div>
      <div class="row-sub">
        ${rin ? `<span class="mark-time">✅ ${hhmm(rin.occurred_at)} <button data-del="${rin.id}" title="Bekor qilish" type="button">✕</button></span>` : ''}
        ${rout ? `<span class="mark-time">🏠 ${hhmm(rout.occurred_at)} <button data-del="${rout.id}" title="Bekor qilish" type="button">✕</button></span>` : ''}
        ${!rin && !rout ? '<span>Hali belgilanmagan</span>' : ''}
      </div>
    </div>
    <div class="row-actions">
      <button class="btn btn-sm btn-green" data-mark="in" data-id="${s.id}" ${rin ? 'disabled' : ''} type="button">${I.check} Keldi</button>
      <button class="btn btn-sm" data-mark="out" data-id="${s.id}" ${rout || !rin ? 'disabled' : ''} type="button">${I.home2} Ketdi</button>
    </div>
  </div>`;
}


/* ============================================================
   KO'RINISH: ARIZALAR
   ============================================================ */
const LEAD_STATUS = {
  new:       { label: 'Yangi',        badge: 'badge-warn' },
  contacted: { label: "Bog'lanildi",  badge: '' },
  enrolled:  { label: 'Yozildi',      badge: 'badge-ok' },
  rejected:  { label: 'Rad etildi',   badge: '' },
};

function viewLeadsShell() {
  const counts = { all: state.leads.length };
  Object.keys(LEAD_STATUS).forEach((k) => { counts[k] = state.leads.filter((l) => l.status === k).length; });
  const chip = (id, label) =>
    `<button class="chip ${state.leadFilter === id ? 'on' : ''}" style="--acc:var(--gold)" data-lead-filter="${id}" type="button">${label} ${counts[id] ? `· ${counts[id]}` : ''}</button>`;
  return `
    <div class="page-head">
      <div><h2>Arizalar</h2><p>Saytdan kelgan murojaatlar</p></div>
    </div>
    <div class="chips">
      ${chip('new', 'Yangi')}${chip('contacted', "Bog'lanildi")}${chip('enrolled', 'Yozildi')}${chip('rejected', 'Rad etildi')}${chip('all', 'Barchasi')}
    </div>
    <div id="leadsOut" style="margin-top:16px"></div>`;
}

function loadLeads() {
  const list = state.leadFilter === 'all'
    ? state.leads
    : state.leads.filter((l) => l.status === state.leadFilter);

  if (!list.length) {
    $('leadsOut').innerHTML = `<div class="card"><div class="empty"><div class="e-ico">\u{1F4ED}</div>
      <b>Ariza yo'q</b><p>${state.leadFilter === 'new' ? "Yangi arizalar shu yerda ko'rinadi." : 'Bu bo\'limda ariza yo\'q.'}</p></div></div>`;
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
          ${c ? `<span class="badge badge-course" style="--acc:var(--${c.color})">${c.icon} ${esc(c.name)}</span>` : ''}</div>
        <div class="row-sub">
          <span>\u{1F4DE} ${esc(l.phone)}</span>
          ${l.preferred_time ? `<span>\u23F0 ${esc(l.preferred_time)}</span>` : ''}
          <span>${when}</span>
        </div>
        ${l.note ? `<div class="row-sub"><span>\u{1F4AC} ${esc(l.note)}</span></div>` : ''}
      </div>
      <div class="row-actions">
        <a class="btn btn-sm btn-green" href="tel:${esc(l.phone)}">${I.phone} Qo'ng'iroq</a>
        <button class="btn btn-sm" data-lead="${l.id}" type="button">${I.edit}</button>
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
    <div class="field"><span>Holat</span>
      <div class="check-list">${Object.entries(LEAD_STATUS).map(([k, v]) =>
        `<button class="check-item" data-lead-status="${k}" type="button">
          ${l.status === k ? '\u2705' : '\u25CB'} <span>${v.label}</span></button>`).join('')}</div>
    </div>
    <button class="btn btn-danger btn-block" style="margin-top:10px" data-lead-del="${l.id}" type="button">${I.trash} O'chirish</button>
  `, () => {
    document.querySelectorAll('[data-lead-status]').forEach((b) => b.addEventListener('click', async () => {
      const { error } = await sb.from('leads')
        .update({ status: b.dataset.leadStatus, handled_by: state.me.email }).eq('id', l.id);
      if (error) { toast('\u274C ' + error.message, 'bad'); return; }
      closeSheet(); toast('Holat yangilandi', 'ok');
      await loadLeadsData(); renderCounts(); render();
    }));
    const del = document.querySelector('[data-lead-del]');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Bu arizani o\'chirasizmi?')) return;
      const { error } = await sb.from('leads').delete().eq('id', l.id);
      if (error) { toast('\u274C ' + error.message, 'bad'); return; }
      closeSheet(); toast("O'chirildi", 'ok');
      await loadLeadsData(); renderCounts(); render();
    });
  });
}

/* ============================================================
   KO'RINISH: O'QUVCHILAR
   ============================================================ */
function viewStudents() {
  const list = visibleStudents();
  if (!myCourses().length) {
    return `<div class="page-head"><div><h2>O'quvchilar</h2></div></div>
      <div class="card"><div class="empty"><div class="e-ico">🔒</div><b>Sizga hali kurs biriktirilmagan</b></div></div>`;
  }
  return `
    <div class="page-head">
      <div><h2>O'quvchilar</h2><p>${list.length} ta ko'rsatilmoqda</p></div>
      <div class="spacer"></div>
      <button class="btn btn-primary" data-add-student type="button">${I.plus} Qo'shish</button>
    </div>
    ${courseChips()}
    <label class="field" style="margin:14px 0">
      <span class="sr-only">Qidirish</span>
      <input class="inp" id="searchInp" placeholder="🔍 Qidirish..." value="${esc(state.search)}">
    </label>
    ${list.length ? `<div class="rows">${list.map(rowStudent).join('')}</div>`
      : `<div class="card"><div class="empty"><div class="e-ico">🧑‍🎓</div><b>O'quvchi yo'q</b>
         <p>Birinchi o'quvchini qo'shing.</p>
         <button class="btn btn-primary" data-add-student type="button">${I.plus} O'quvchi qo'shish</button></div></div>`}`;
}

function rowStudent(s) {
  const c = courseById(s.course_id);
  return `<div class="row">
    <div class="avatar" style="--acc:var(--${c.color})">${esc(initials(s.full_name))}</div>
    <div class="row-main">
      <div class="row-title">${esc(s.full_name)}
        <span class="badge badge-course" style="--acc:var(--${c.color})">${c.icon} ${esc(c.name)}</span>
        ${s.active ? '' : '<span class="badge">Arxiv</span>'}
        ${s.telegram_chat_id ? '<span class="badge badge-ok">Telegram ✓</span>' : '<span class="badge badge-warn">Ulanmagan</span>'}
      </div>
      <div class="row-sub">
        ${s.parent_name ? `<span>👤 ${esc(s.parent_name)}</span>` : ''}
        ${s.parent_phone ? `<span>📞 ${esc(s.parent_phone)}</span>` : ''}
      </div>
    </div>
    <div class="row-actions">
      ${!s.telegram_chat_id && state.botUsername
        ? `<button class="btn btn-sm" data-copy="${s.link_code}" title="Ota-ona havolasi" type="button">${I.link}</button>` : ''}
      <button class="btn btn-sm" data-edit-student="${s.id}" title="Tahrirlash" type="button">${I.edit}</button>
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
      <div><h2>Oylik hisobot</h2><p>Davomat statistikasi</p></div>
      <div class="spacer"></div>
      <button class="btn" id="csvBtn" type="button">${I.download} CSV</button>
    </div>
    <label class="field" style="max-width:220px">
      <span>Oy</span>
      <input class="inp" type="month" id="repMonth" value="${currentYm()}">
    </label>
    ${list.length > 1 ? courseChips() : ''}
    <div id="repOut" style="margin-top:16px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
}

let repData = null;

async function loadReport() {
  const ym = $('repMonth')?.value || currentYm();
  const [from, to] = monthRange(ym);
  const { data, error } = await sb.from('attendance')
    .select('student_id,kind,occurred_at').gte('occurred_at', from).lt('occurred_at', to).order('occurred_at');
  if (error) { $('repOut').innerHTML = `<div class="card"><div class="empty"><b>Xatolik</b><p>${esc(error.message)}</p></div></div>`; return; }

  const allowed = new Set(myCourses().map((c) => c.id));
  const scoped = state.students.filter((s) => allowed.has(s.course_id) &&
    (state.courseFilter === 'all' || s.course_id === state.courseFilter));
  const scopedIds = new Set(scoped.map((s) => s.id));

  const by = new Map();
  const openDays = new Set();
  (data ?? []).forEach((r) => {
    if (r.kind !== 'in' || !scopedIds.has(r.student_id)) return;
    const d = dayKey(r.occurred_at);
    openDays.add(d);
    if (!by.has(r.student_id)) by.set(r.student_id, { days: new Set(), last: r.occurred_at });
    const e = by.get(r.student_id);
    e.days.add(d);
    if (r.occurred_at > e.last) e.last = r.occurred_at;
  });

  const total = openDays.size;
  const rows = scoped.filter((s) => s.active || by.has(s.id)).map((s) => {
    const e = by.get(s.id);
    const count = e ? e.days.size : 0;
    return {
      id: s.id, name: s.full_name, course: courseById(s.course_id), active: s.active,
      count, last: e ? e.last : null,
      pct: total ? Math.round((count / total) * 100) : 0,
      days: e ? [...e.days].sort() : [],
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const visits = rows.reduce((n, r) => n + r.count, 0);
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.pct, 0) / rows.length) : 0;
  repData = { ym, rows, total, visits, avg };

  $('repOut').innerHTML = `
    <div class="stats">
      <div class="stat"><b>${rows.length}</b><span>O'quvchi</span></div>
      <div class="stat"><b>${total}</b><span>Ish kuni</span></div>
      <div class="stat"><b>${visits}</b><span>Tashrif</span></div>
      <div class="stat"><b style="color:var(--green-ink)">${avg}%</b><span>O'rtacha</span></div>
    </div>
    ${(!rows.length || !total)
      ? `<div class="card"><div class="empty"><div class="e-ico">📭</div><b>Ma'lumot yo'q</b><p>Bu oyda davomat yozuvlari topilmadi.</p></div></div>`
      : `<div class="table-wrap"><table class="tbl"><thead><tr>
          <th>O'quvchi</th><th style="text-align:center">Kunlar</th><th>Davomat</th><th>Oxirgi</th>
        </tr></thead><tbody>${rows.map((r) => `
          <tr data-row="${r.id}">
            <td><div style="font-weight:800">${esc(r.name)}${r.active ? '' : ' <span class="badge">arxiv</span>'}</div>
                <div style="color:var(--faint);font-size:.8rem;font-weight:700">${r.course.icon} ${esc(r.course.name)}</div></td>
            <td class="num">${r.count} / ${total}</td>
            <td><div class="bar"><i style="width:${Math.min(100, r.pct)}%"></i></div>
                <span style="font-size:.78rem;font-weight:800;color:var(--muted)">${r.pct}%</span></td>
            <td style="color:var(--muted);font-weight:700;white-space:nowrap">${r.last ? dayKey(r.last).slice(8) + '.' + dayKey(r.last).slice(5, 7) : '—'}</td>
          </tr>
          <tr class="hidden" data-detail="${r.id}"><td colspan="4"><div class="day-pills">${
            r.days.length ? r.days.map((d) => `<span class="day-pill">${d.slice(8)}.${d.slice(5, 7)}</span>`).join('')
                          : '<span style="color:var(--faint)">Bu oyda kelmagan</span>'}</div></td></tr>`).join('')}
        </tbody></table></div>`}`;
}

function exportCsv() {
  if (!repData || !repData.rows.length) { toast('Avval hisobot yuklansin', 'bad'); return; }
  const head = ["O'quvchi", 'Kurs', 'Kelgan kunlar', 'Ish kunlari', 'Davomat %', 'Oxirgi tashrif', 'Sanalar'];
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [head.map(q).join(';')].concat(repData.rows.map((r) =>
    [r.name, r.course.name, r.count, repData.total, r.pct, r.last ? dayKey(r.last) : '', r.days.join(' ')].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `parvoz-davomat-${repData.ym}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('CSV yuklandi', 'ok');
}

/* ============================================================
   KO'RINISH: JAMOA (faqat admin)
   ============================================================ */
function viewTeamShell() {
  return `
    <div class="page-head">
      <div><h2>Jamoa</h2><p>O'qituvchilar va ularning fanlari</p></div>
      <div class="spacer"></div>
      <button class="btn btn-primary" data-add-teacher type="button">${I.plus} O'qituvchi</button>
    </div>
    <div id="teamOut"><div class="skel"></div><div class="skel"></div></div>
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>📚 Kurslar</h3><div class="spacer"></div>
        <button class="btn btn-sm" data-add-course type="button">${I.plus} Kurs</button></div>
      <div id="coursesOut" class="rows"></div>
    </div>`;
}

async function loadTeam() {
  try {
    const { teachers } = await edge('admin-api', { action: 'list_teachers' });
    $('teamOut').innerHTML = `<div class="rows">${teachers.map((t) => {
      const cs = t.role === 'admin'
        ? '<span class="badge badge-admin">Barcha kurslar</span>'
        : (t.course_ids.length
            ? t.course_ids.map((id) => { const c = courseById(id); return `<span class="badge badge-course" style="--acc:var(--${c.color})">${c.icon} ${esc(c.name)}</span>`; }).join(' ')
            : '<span class="badge badge-warn">Kurs biriktirilmagan</span>');
      return `<div class="row">
        <div class="avatar" style="--acc:var(--${t.role === 'admin' ? 'violet' : 'sky'})">${esc(initials(t.full_name || t.email))}</div>
        <div class="row-main">
          <div class="row-title">${esc(t.full_name || t.email.split('@')[0])}
            ${t.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : ''}</div>
          <div class="row-sub"><span>${esc(t.email)}</span></div>
          <div class="row-sub">${cs}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" data-edit-teacher="${esc(t.email)}" type="button">${I.edit}</button>
        </div></div>`;
    }).join('')}</div>`;
  } catch (e) {
    $('teamOut').innerHTML = `<div class="card"><div class="empty"><b>Xatolik</b><p>${esc(e.message)}</p></div></div>`;
  }

  $('coursesOut').innerHTML = state.courses.map((c) => {
    const n = state.students.filter((s) => s.course_id === c.id).length;
    return `<div class="row">
      <div class="avatar" style="--acc:var(--${c.color});font-size:1.1rem">${c.icon}</div>
      <div class="row-main">
        <div class="row-title">${esc(c.name)} ${c.active ? '' : '<span class="badge">Yopiq</span>'}</div>
        <div class="row-sub"><span>${n} ta o'quvchi</span></div>
      </div>
      <div class="row-actions">
        <button class="btn btn-sm" data-edit-course="${c.id}" type="button">${I.edit}</button>
      </div></div>`;
  }).join('');
}

/* ============================================================
   KO'RINISH: SOZLAMALAR
   ============================================================ */
function viewSettings() {
  const admin = isAdmin();
  return `
    <div class="page-head"><div><h2>Sozlamalar</h2><p>${esc(state.me.email)}</p></div></div>

    <div class="card">
      <div class="card-head"><h3>🎨 Ko'rinish</h3></div>
      <button class="btn btn-block" id="themeBtnBig" type="button"></button>
    </div>

    <div class="card" id="installCard" ${state.deferredInstall ? '' : 'hidden'}>
      <div class="card-head"><h3>📱 Ilovani o'rnatish</h3></div>
      <p class="card-desc">Telefoningizga ilova sifatida o'rnating — brauzersiz, bitta bosishda ochiladi.</p>
      <button class="btn btn-primary btn-block" id="installBtn" type="button">O'rnatish</button>
    </div>

    ${admin ? `
    <div class="card">
      <div class="card-head"><h3>🤖 Telegram bot</h3></div>
      <p class="card-desc">Bot ota-onalarga farzandi kelgani va ketgani haqida avtomatik xabar yuboradi.</p>
      <div class="row" style="margin-bottom:12px">
        <div class="row-main">
          <div class="row-title">${state.botUsername ? '@' + esc(state.botUsername) : 'Bot ulanmagan'}</div>
          <div class="row-sub" id="whText">—</div>
        </div>
        <div class="row-actions"><button class="btn btn-sm" id="whFix" type="button">Qayta ulash</button></div>
      </div>
      <label class="field"><span>Yangi token (BotFather)</span>
        <input class="inp" id="botToken" placeholder="123456:AA..." autocomplete="off"></label>
      <button class="btn btn-block" id="botSave" type="button">Tokenni saqlash</button>
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h3>🔔 Ariza xabarnomalari</h3></div>
      <p class="card-desc">Saytdan yangi ariza kelganda Telegramga darhol xabar olish uchun o'zingizni ulang.</p>
      <div id="notifyOut" class="rows" style="margin-bottom:12px"></div>
      <button class="btn btn-block" id="notifyLinkBtn" type="button">🔗 Meni ulash havolasini olish</button>
    </div>

    <div class="card">
      <div class="card-head"><h3>👋 Hisob</h3></div>
      <button class="btn btn-danger btn-block" id="logoutBtn" type="button">${I.out} Chiqish</button>
    </div>

    <p style="text-align:center;color:var(--faint);font-size:.8rem;margin-top:18px">
      Parvoz Davomat · <a href="index.html">Saytga qaytish</a></p>`;
}


async function loadNotifyChats() {
  const out = $('notifyOut');
  if (!out) return;
  try {
    const { chats } = await edge('admin-api', { action: 'list_notify_chats' });
    out.innerHTML = chats.length
      ? chats.map((c) => `<div class="row"><div class="row-main">
          <div class="row-title">${esc(c.label || 'Telegram foydalanuvchi')}</div>
          <div class="row-sub"><span class="badge badge-ok">Ulangan</span></div></div>
          <div class="row-actions"><button class="btn btn-sm btn-danger" data-notify-del="${c.chat_id}" type="button">${I.trash}</button></div></div>`).join('')
      : `<div class="row"><div class="row-main"><div class="row-sub">
         <span class="badge badge-warn">Hech kim ulanmagan \u2014 arizalar haqida xabar bormaydi</span></div></div></div>`;
  } catch (e) { out.innerHTML = ''; }
}

async function checkWebhook(autoFix) {
  if (!isAdmin() || !state.botUsername) return;
  try {
    const r = await edge('admin-api', { action: 'webhook_status' });
    let active = !!r.active && r.mode === 'webhook';
    if (!active && autoFix) {
      const fix = await edge('admin-api', { action: 'setup_webhook' });
      if (fix.ok) { active = true; toast('⚡ Bot tezkor rejimga ulandi', 'ok'); }
    }
    state.tgMode = active ? 'webhook' : 'polling';
    const el = $('whText');
    if (el) el.innerHTML = active
      ? '<span class="badge badge-ok">⚡ Tezkor rejim</span>'
      : `<span class="badge badge-warn">⏳ Sekin rejim</span>${r.last_error ? ' ' + esc(r.last_error) : ''}`;
  } catch (_) {}
}

/* ============================================================
   SHEET (modal) YORDAMCHISI
   ============================================================ */
function openSheet(title, bodyHtml, onMount) {
  const dlg = $('sheet');
  $('sheetBody').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sheet-head"><h3>${title}</h3><div class="spacer"></div>
      <button class="btn btn-icon btn-ghost" data-close type="button">${I.x}</button></div>
    ${bodyHtml}`;
  dlg.showModal();
  $('sheetBody').querySelector('[data-close]').addEventListener('click', () => dlg.close());
  if (onMount) onMount(dlg);
}
function closeSheet() { $('sheet').close(); }

/* ---- O'quvchi qo'shish / tahrirlash ---- */
function studentSheet(id) {
  const s = id ? state.students.find((x) => x.id === id) : null;
  const list = myCourses();
  const opts = list.map((c) => `<option value="${c.id}" ${s && s.course_id === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('');
  openSheet(s ? "O'quvchini tahrirlash" : "Yangi o'quvchi", `
    <form id="stForm">
      <label class="field"><span>Ism-familiya *</span>
        <input class="inp" id="stName" required value="${esc(s?.full_name ?? '')}"></label>
      <label class="field"><span>Kurs *</span>
        <select class="inp" id="stCourse" required>${s ? '' : '<option value="">Tanlang...</option>'}${opts}</select></label>
      <label class="field"><span>Ota-ona ismi</span>
        <input class="inp" id="stParent" value="${esc(s?.parent_name ?? '')}"></label>
      <label class="field"><span>Ota-ona telefoni</span>
        <input class="inp" id="stPhone" inputmode="tel" value="${esc(s?.parent_phone ?? '')}"></label>
      ${s ? `<label class="check-item" style="margin-bottom:14px">
        <input type="checkbox" id="stActive" ${s.active ? 'checked' : ''}><span>Faol (arxivda emas)</span></label>` : ''}
      <button class="btn btn-primary btn-block" type="submit">${s ? 'Saqlash' : "Qo'shish"}</button>
      ${s ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="stDelete" type="button">${I.trash} O'chirish</button>` : ''}
    </form>`, () => {
    $('stForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const row = {
        full_name: $('stName').value.trim(),
        course_id: $('stCourse').value,
        parent_name: $('stParent').value.trim() || null,
        parent_phone: $('stPhone').value.trim() || null,
      };
      if (s) row.active = $('stActive').checked;
      if (!row.full_name || !row.course_id) return;
      const q = s ? await sb.from('students').update(row).eq('id', s.id) : await sb.from('students').insert(row);
      if (q.error) { toast('❌ ' + q.error.message, 'bad'); return; }
      closeSheet();
      toast(s ? 'Saqlandi' : "O'quvchi qo'shildi", 'ok');
      await loadStudents(); render();
    });
    if (s) $('stDelete').addEventListener('click', async () => {
      if (!confirm(`${s.full_name} va uning BARCHA davomat tarixi o'chiriladi. Davom etasizmi?`)) return;
      const { error } = await sb.from('students').delete().eq('id', s.id);
      if (error) { toast('❌ ' + error.message, 'bad'); return; }
      closeSheet(); toast("O'chirildi", 'ok');
      await Promise.all([loadStudents(), loadToday()]); render();
    });
  });
}

/* ---- O'qituvchi qo'shish / tahrirlash ---- */
async function teacherSheet(email) {
  let t = null;
  if (email) {
    const { teachers } = await edge('admin-api', { action: 'list_teachers' });
    t = teachers.find((x) => x.email.toLowerCase() === email.toLowerCase());
  }
  const checks = state.courses.map((c) => `
    <label class="check-item"><input type="checkbox" value="${c.id}" class="tcCourse"
      ${t && t.course_ids.includes(c.id) ? 'checked' : ''}><span>${c.icon} ${esc(c.name)}</span></label>`).join('');

  openSheet(t ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi", `
    <form id="tForm">
      <label class="field"><span>Ism-familiya</span>
        <input class="inp" id="tName" value="${esc(t?.full_name ?? '')}"></label>
      <label class="field"><span>Email *</span>
        <input class="inp" id="tEmail" type="email" required ${t ? 'readonly' : ''} value="${esc(t?.email ?? '')}"></label>
      <label class="field"><span>Parol ${t ? '(o\'zgartirmasangiz bo\'sh qoldiring)' : '*'}</span>
        <input class="inp" id="tPass" type="password" minlength="8" autocomplete="new-password" ${t ? '' : 'required'}></label>
      <label class="field"><span>Rol</span>
        <select class="inp" id="tRole">
          <option value="teacher" ${t?.role !== 'admin' ? 'selected' : ''}>O'qituvchi — faqat o'z fanlari</option>
          <option value="admin" ${t?.role === 'admin' ? 'selected' : ''}>Administrator — barcha huquqlar</option>
        </select></label>
      <div class="field" id="coursesField"><span>Biriktirilgan fanlar</span>
        <div class="check-list">${checks}</div></div>
      <button class="btn btn-primary btn-block" type="submit">Saqlash</button>
      ${t && t.email.toLowerCase() !== state.me.email.toLowerCase()
        ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="tDelete" type="button">${I.trash} O'chirish</button>` : ''}
    </form>`, () => {
    const syncRole = () => { $('coursesField').style.display = $('tRole').value === 'admin' ? 'none' : ''; };
    $('tRole').addEventListener('change', syncRole); syncRole();

    $('tForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter; if (btn) btn.disabled = true;
      try {
        await edge('admin-api', {
          action: 'save_teacher',
          email: $('tEmail').value.trim(),
          password: $('tPass').value,
          full_name: $('tName').value.trim(),
          role: $('tRole').value,
          course_ids: [...document.querySelectorAll('.tcCourse:checked')].map((i) => i.value),
        });
        closeSheet(); toast('Saqlandi', 'ok'); loadTeam();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
      finally { if (btn) btn.disabled = false; }
    });

    if (t && $('tDelete')) $('tDelete').addEventListener('click', async () => {
      if (!confirm(`${t.email} hisobini o'chirasizmi?`)) return;
      try {
        await edge('admin-api', { action: 'remove_teacher', email: t.email });
        closeSheet(); toast("O'chirildi", 'ok'); loadTeam();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
    });
  });
}

/* ---- Kurs qo'shish / tahrirlash ---- */
function courseSheet(id) {
  const c = id ? state.courses.find((x) => x.id === id) : null;
  const colors = ['sky', 'green', 'teal', 'violet', 'rose', 'gold'];
  openSheet(c ? 'Kursni tahrirlash' : 'Yangi kurs', `
    <form id="cForm">
      <label class="field"><span>Nomi *</span>
        <input class="inp" id="cName" required value="${esc(c?.name ?? '')}"></label>
      <label class="field"><span>Belgi (emoji)</span>
        <input class="inp" id="cIcon" maxlength="4" value="${esc(c?.icon ?? '📘')}"></label>
      <label class="field"><span>Rang</span>
        <select class="inp" id="cColor">${colors.map((x) =>
          `<option value="${x}" ${c?.color === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="check-item" style="margin-bottom:14px">
        <input type="checkbox" id="cActive" ${!c || c.active ? 'checked' : ''}><span>Faol</span></label>
      <button class="btn btn-primary btn-block" type="submit">Saqlash</button>
      ${c ? `<button class="btn btn-danger btn-block" style="margin-top:9px" id="cDelete" type="button">${I.trash} O'chirish</button>` : ''}
    </form>`, () => {
    $('cForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await edge('admin-api', {
          action: 'save_course', id: c?.id ?? null,
          name: $('cName').value.trim(), icon: $('cIcon').value.trim(),
          color: $('cColor').value, active: $('cActive').checked,
        });
        closeSheet(); toast('Saqlandi', 'ok');
        await loadCourses(); render();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
    });
    if (c) $('cDelete').addEventListener('click', async () => {
      if (!confirm(`"${c.name}" kursi o'chirilsinmi?`)) return;
      try {
        await edge('admin-api', { action: 'remove_course', id: c.id });
        closeSheet(); toast("O'chirildi", 'ok');
        await loadCourses(); render();
      } catch (err) { toast('❌ ' + err.message, 'bad'); }
    });
  });
}

/* ============================================================
   HODISALAR
   ============================================================ */
document.addEventListener('click', async (e) => {
  const t = e.target;

  const lf = t.closest('[data-lead-filter]');
  if (lf) { state.leadFilter = lf.dataset.leadFilter; render(); return; }
  const leadBtn = t.closest('[data-lead]');
  if (leadBtn) return leadSheet(leadBtn.dataset.lead);

  const chip = t.closest('[data-chip]');
  if (chip) { state.courseFilter = chip.dataset.chip; render(); if (state.view === 'report') loadReport(); return; }

  if (t.closest('[data-add-student]')) return studentSheet(null);
  const edS = t.closest('[data-edit-student]');
  if (edS) return studentSheet(edS.dataset.editStudent);
  if (t.closest('[data-add-teacher]')) return teacherSheet(null);
  const edT = t.closest('[data-edit-teacher]');
  if (edT) return teacherSheet(edT.dataset.editTeacher);
  if (t.closest('[data-add-course]')) return courseSheet(null);
  const edC = t.closest('[data-edit-course]');
  if (edC) return courseSheet(edC.dataset.editCourse);

  const themeBtn = t.closest('[data-theme-toggle], #themeBtnBig');
  if (themeBtn) { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); if (state.view === 'settings') render(); return; }

  const copy = t.closest('[data-copy]');
  if (copy) {
    const link = `https://t.me/${state.botUsername}?start=${copy.dataset.copy}`;
    try { await navigator.clipboard.writeText(link); toast('🔗 Havola nusxalandi — ota-onaga yuboring', 'ok'); }
    catch { prompt('Havolani nusxalang:', link); }
    return;
  }

  const mark = t.closest('[data-mark]');
  if (mark) {
    mark.disabled = true;
    const old = mark.innerHTML;
    mark.innerHTML = '<span class="spin"></span>';
    try {
      const r = await edge('mark-attendance', { student_id: mark.dataset.id, kind: mark.dataset.mark });
      await loadToday();
      const s = state.students.find((x) => x.id === mark.dataset.id);
      toast(r.notified ? `📨 ${s?.full_name}: ota-onaga xabar yuborildi`
                       : `✔️ ${s?.full_name}: belgilandi${s?.telegram_chat_id ? '' : ' (Telegram ulanmagan)'}`, 'ok');
      render();
    } catch (err) { toast('❌ ' + err.message, 'bad'); mark.innerHTML = old; mark.disabled = false; }
    return;
  }

  const del = t.closest('[data-del]');
  if (del) {
    if (!confirm("Bu belgini o'chirasizmi? (Yuborilgan xabar qaytarilmaydi)")) return;
    const { error } = await sb.from('attendance').delete().eq('id', del.dataset.del);
    if (error) toast('❌ ' + error.message, 'bad');
    await loadToday(); render();
    return;
  }

  const repRow = t.closest('[data-row]');
  if (repRow) {
    const d = document.querySelector(`[data-detail="${repRow.dataset.row}"]`);
    if (d) d.classList.toggle('hidden');
    return;
  }

  if (t.closest('#notifyLinkBtn')) {
    const btn = t.closest('#notifyLinkBtn');
    btn.disabled = true;
    try {
      const r = await edge('admin-api', { action: 'admin_link' });
      openSheet('Xabarnomalarga ulanish', `
        <p class="card-desc">Quyidagi tugmani bosing \u2014 Telegram ochiladi va "Start" bosganingizdan keyin
        saytdan kelgan arizalar shu chatga yuboriladi. Havola 30 daqiqa amal qiladi.</p>
        <a class="btn btn-primary btn-block" href="${r.link}" target="_blank" rel="noopener">Telegramda ochish</a>
        <button class="btn btn-block" style="margin-top:9px" data-copy-link="${esc(r.link)}" type="button">Havolani nusxalash</button>`,
        () => {
          const cp = document.querySelector('[data-copy-link]');
          cp.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(cp.dataset.copyLink); toast('Nusxalandi', 'ok'); }
            catch { prompt('Havola:', cp.dataset.copyLink); }
          });
        });
    } catch (err) { toast('\u274C ' + err.message, 'bad'); }
    finally { btn.disabled = false; }
    return;
  }

  const nd = t.closest('[data-notify-del]');
  if (nd) {
    try {
      await edge('admin-api', { action: 'remove_notify_chat', chat_id: Number(nd.dataset.notifyDel) });
      toast("O'chirildi", 'ok'); loadNotifyChats();
    } catch (err) { toast('\u274C ' + err.message, 'bad'); }
    return;
  }

  if (t.closest('#csvBtn')) return exportCsv();
  if (t.closest('#logoutBtn')) return logout();

  if (t.closest('#botSave')) {
    const token = $('botToken').value.trim();
    if (!token) { toast('Token kiriting', 'bad'); return; }
    const btn = $('botSave'); btn.disabled = true;
    try {
      const r = await edge('admin-api', { action: 'save_bot_token', token });
      toast(`🤖 Bot ulandi: @${r.username}`, 'ok');
      if (r.webhook === false) toast('⚠️ Tezkor rejim yoqilmadi: ' + (r.webhook_error || ''), 'bad');
      await loadConfig(); render(); checkWebhook(false);
    } catch (err) { toast('❌ ' + err.message, 'bad'); }
    finally { btn.disabled = false; }
    return;
  }

  if (t.closest('#whFix')) {
    try {
      const r = await edge('admin-api', { action: 'setup_webhook' });
      toast(r.ok ? '⚡ Tezkor rejim yoqildi' : '❌ ' + (r.error || ''), r.ok ? 'ok' : 'bad');
      checkWebhook(false);
    } catch (err) { toast('❌ ' + err.message, 'bad'); }
    return;
  }

  if (t.closest('#installBtn') && state.deferredInstall) {
    state.deferredInstall.prompt();
    state.deferredInstall = null;
    $('installCard')?.setAttribute('hidden', '');
    return;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'searchInp') {
    state.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = $('searchInp');
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'repMonth') loadReport();
});

$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });

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
