import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function getCfg(key: string): Promise<string | null> {
  const { data } = await admin.from('app_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

async function setCfg(key: string, value: string) {
  await admin.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() });
}

// Telegram so'rovi hech qachon throw qilmaydi: tarmoq xatosining matnida URL, ya'ni
// bot tokeni bo'ladi — u panelga yoki bazaga tushmasligi kerak.
async function tg(token: string, method: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json().catch(() => null)) ?? { ok: false, description: 'Telegram javobi tushunarsiz' };
  } catch (e) {
    return { ok: false, description: (e as Error)?.name === 'TimeoutError' ? 'Telegram javob bermadi' : "Telegram bilan aloqa yo'q", net: true };
  }
}

// Xato matnidan bot tokenini olib tashlaymiz (har ehtimolga qarshi)
const redact = (s: string) => s.replace(/bot\d+:[\w-]+/g, 'bot***');

// ilike da _ va % qolip belgisi — foydalanuvchining o'z emaili qolip bo'lib qolmasin
const likeEsc = (s: string) => s.replace(/[\\%_]/g, '\\$&');

function randomHex(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function webhookSecret(): Promise<string> {
  let secret = await getCfg('tg_webhook_secret');
  if (!secret) { secret = randomHex(32); await setCfg('tg_webhook_secret', secret); }
  return secret;
}

async function enableWebhook(token: string) {
  const secret = await webhookSecret();
  const r = await tg(token, 'setWebhook', {
    url: WEBHOOK_URL, secret_token: secret, allowed_updates: ['message'],
    drop_pending_updates: false, max_connections: 20,
  });
  if (r?.ok) { await setCfg('tg_mode', 'webhook'); return { ok: true }; }
  await setCfg('tg_mode', 'polling');
  return { ok: false, error: r?.description ?? 'setWebhook muvaffaqiyatsiz' };
}

// ---- Ota-onaga xabar shablonlari ----
// Matnni mark-attendance yuboradi; bu yerda faqat tekshirib saqlaymiz.
// app_config.msg_templates = {"in": {"on": true, "text": "..." | null}, ...}
// text=null — standart matn (standart keyin yaxshilansa, o'zi yangilanadi).
const TPL_VARS: Record<string, string[]> = {
  in:      ['ism', 'vaqt', 'kurs', 'sana'],
  out:     ['ism', 'vaqt', 'kurs', 'sana'],
  absent:  ['ism', 'kurs', 'sana'],
  excused: ['ism', 'sabab', 'kurs', 'sana'],
  pay:     ['ism', 'kurs', 'oy', 'oylar'],     // to'lov eslatmasi — faqat qo'lda yuboriladi
  payfam:  ['bolalar', 'oy'],                  // to'lov eslatmasi, bir oilaning bir nechta farzandi — bitta xabar
  paid:    ['ism', 'kurs', 'oy', 'summa', 'sana'], // to'lov qabul qilindi — to'lov yozilganda
};
const TPL_MAX = 1000;

// To'lov eslatmasining standart matni. Panelda (assets/app.js → TPL_DEFAULT.pay) aynan
// shu matn — namuna ota-ona oladigan xabar bilan bir xil bo'lishi uchun.
const DEFAULT_PAY = "💳 Hurmatli ota-ona! *{ism}* uchun *{oy}* oyi to'lovi bizda hali qayd etilmagan.\n🗓 Qayd etilmagan oylar: {oylar}\n📚 {kurs}\n\nAgar to'lovni qilgan bo'lsangiz, iltimos, o'qituvchiga yoki markaz ma'muriyatiga ayting — tekshirib, belgilab qo'yamiz. Rahmat!";

// Bir ota-onaga bir nechta farzand uchun eslatma: {bolalar} — "• Ism (kurs) — qarz oylar" qatorlari. Panelda TPL_DEFAULT.payfam bilan bir xil.
const DEFAULT_PAYFAM = "💳 Hurmatli ota-ona! Farzandlaringiz uchun *{oy}* oyi to'lovi bizda hali qayd etilmagan:\n{bolalar}\n\nAgar to'lovni qilgan bo'lsangiz, iltimos, o'qituvchiga yoki markaz ma'muriyatiga ayting — tekshirib, belgilab qo'yamiz. Rahmat!";
const FAM_MAX = 10;   // bir xabarda ko'pi bilan nechta farzand (qolgani "… +N")

// "To'lov qabul qilindi" — to'lov yozilganda ota-onaga. Panelda TPL_DEFAULT.paid bilan bir xil.
const DEFAULT_PAID = "✅ Hurmatli ota-ona! *{ism}* uchun *{oy}* oyi to'lovi qabul qilindi.\n💵 {summa} so'm\n📚 {kurs}\n📅 {sana}\n\nRahmat!";
// 300000 -> "300 000" (bo'linmas probel)
const fmtSum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// mark-attendance dagi renderTpl bilan AYNAN bir xil (testda solishtiriladi)
function renderTpl(text: string, vars: Record<string, string>): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) =>
    line.includes('{ism}') ||
    [...line.matchAll(/\{(\w+)\}/g)].every(([, n]) => !(n in vars) || vars[n] !== ''));
  return escHtml(lines.join('\n'))
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/\{(\w+)\}/g, (m, n) => (n in vars ? escHtml(vars[n]) : m))
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---- To'lov eslatmalari ----
const REMIND_COOLDOWN_DAYS = 7;   // bir o'quvchiga (qaysi oy bo'lmasin) haftasiga ko'pi bilan bitta
const REMIND_MAX = 50;            // bir so'rovda; panel bo'laklab yuboradi
const REMIND_BUDGET_MS = 60_000;  // so'rov 150 s chegarasiga yetmasin
const TZ = 'Asia/Samarkand';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
function ymShift(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const oyName = (ym: string) => OYLAR[Number(ym.slice(5, 7)) - 1];
const sanaOf = (key: string) => `${Number(key.slice(8, 10))}-${OYLAR[Number(key.slice(5, 7)) - 1]}`;
// O'qituvchi yozgan ism — to'lov xabarida karta raqami / havola bo'lib kelmasin
const normName = (n: unknown) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
const badName = (n: string) => /https?:\/\/|www\.|t\.me\/|@/i.test(n) || /\d{7,}/.test(n.replace(/[\s().-]/g, ''));

// O'quvchining Telegram chatlari: ulangan ota-onalar (parent_chats) + students dagi birinchi ota-ona nusxasi.
// Ona va ota ikkalasi ulangan bo'lsa, xabar ikkalasiga ketadi.
const chatsOf = (st: any): number[] => [...new Set([
  ...((st?.parent_chats ?? []) as any[]).map((c) => Number(c.chat_id)),
  st?.telegram_chat_id ? Number(st.telegram_chat_id) : 0,
].filter(Boolean))];

// Auth foydalanuvchisini email bo'yicha topamiz. listUsers() bir sahifada 50 tani qaytaradi — sahifalab o'qiymiz,
// aks holda ro'yxat oxiridagi foydalanuvchi "topilmadi" bo'lib, parol o'zgarmay / o'chmay qolardi.
async function findAuthUser(email: string) {
  const want = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data?.users?.find((x) => (x.email ?? '').toLowerCase() === want);
    if (hit) return hit;
    if (!data?.users || data.users.length < 200) return null;
  }
  return null;
}

// Telegram javobini holatga aylantiramiz. abort — qolganlarini yubormaslik kerak.
function classify(r: any): { status: 'sent' | 'failed' | 'unknown'; code: string; abort?: string } {
  if (r?.ok) return { status: 'sent', code: 'sent' };
  if (r?.net) return { status: 'unknown', code: r.description === 'Telegram javob bermadi' ? 'timeout' : 'network' };
  const ec = Number(r?.error_code) || 0;
  const d = String(r?.description ?? '');
  if (ec === 403) return { status: 'failed', code: 'blocked' };
  if (ec === 401 || ec === 404) return { status: 'failed', code: 'token', abort: 'token' };
  if (ec === 429) return { status: 'failed', code: 'rate_limited', abort: 'rate_limited' };
  if (ec === 400 && /can't parse entities|message is too long|text is empty|must be non-empty/i.test(d)) {
    return { status: 'failed', code: 'format', abort: 'format' };
  }
  if (ec === 400 && /chat not found|PEER_ID_INVALID|user not found/i.test(d)) return { status: 'failed', code: 'no_chat' };
  if (!ec) return { status: 'unknown', code: 'network' };
  return { status: 'failed', code: 'failed' };
}

function checkTemplate(kind: string, text: string): string | null {
  if (text.length > TPL_MAX) return `Xabar ${TPL_MAX} belgidan oshmasin`;
  const unknown = [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
    .filter((n) => !TPL_VARS[kind].includes(n));
  if (unknown.length) return `Bu xabarda ishlatib bo'lmaydi: ${unknown.map((n) => `{${n}}`).join(', ')}`;
  // Oilada bir nechta farzand o'qishi mumkin — ota-ona kim haqida ekanini bilishi shart
  if (kind === 'payfam') return text.includes('{bolalar}') ? null : "Xabarda {bolalar} bo'lishi shart";
  if (!text.includes('{ism}')) return "Xabarda {ism} bo'lishi shart";
  return null;
}

type Actor = { email: string; role: string; full_name: string | null };

async function currentActor(req: Request): Promise<Actor | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  const email = data?.user?.email;
  if (error || !email) return null;
  const { data: t } = await admin.from('allowed_teachers')
    .select('email, role, full_name').ilike('email', likeEsc(email)).maybeSingle();
  return t ? { email: t.email, role: t.role, full_name: t.full_name } : null;
}

// Webhook ishlamay qolsa — zaxira yo'l. Xabarlarni o'zimiz qayta ishlamaymiz,
// telegram-webhook funksiyasiga uzatamiz: ulanish qoidalari bitta joyda qolsin
// (jumladan ota-onaning telefon raqamini tasdiqlash).
async function processTelegramUpdates(token: string) {
  const offsetStr = await getCfg('tg_offset');
  let offset = offsetStr ? parseInt(offsetStr, 10) : 0;
  const params: Record<string, unknown> = { timeout: 0, allowed_updates: ['message'] };
  if (offset > 0) params.offset = offset + 1;
  const resp = await tg(token, 'getUpdates', params);
  if (!resp.ok) return { processed: 0, error: resp.description };

  const secret = await webhookSecret();
  let processed = 0;
  for (const upd of resp.result ?? []) {
    offset = Math.max(offset, upd.update_id);
    if (!upd.message?.chat?.id) continue;
    processed++;
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify(upd),
    }).catch(() => null);
  }
  if (processed > 0) await setCfg('tg_offset', String(offset));
  return { processed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const action = body?.action;

  try {
    if (action === 'status') {
      const { count } = await admin.from('allowed_teachers').select('*', { count: 'exact', head: true });
      return json({ needs_bootstrap: (count ?? 0) === 0, bot_username: await getCfg('bot_username') });
    }

    if (action === 'bootstrap') {
      const { count } = await admin.from('allowed_teachers').select('*', { count: 'exact', head: true });
      if ((count ?? 0) > 0) return json({ error: 'Tizim allaqachon sozlangan' }, 403);
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      const fullName = String(body.full_name ?? '').trim() || null;
      if (!email || password.length < 8) return json({ error: "Email va kamida 8 belgili parol kerak" }, 400);
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      await admin.from('allowed_teachers').insert({ email: email.toLowerCase(), full_name: fullName, role: 'admin', added_by: 'bootstrap' });
      return json({ ok: true });
    }

    const actor = await currentActor(req);
    if (!actor) return json({ error: 'unauthorized' }, 401);
    const isAdmin = actor.role === 'admin';

    if (action === 'me') {
      const { data: tc } = await admin.from('teacher_courses').select('course_id').ilike('email', likeEsc(actor.email));
      return json({ email: actor.email, role: actor.role, full_name: actor.full_name, course_ids: (tc ?? []).map((r) => r.course_id) });
    }

    if (!isAdmin) return json({ error: 'Bu amal uchun administrator huquqi kerak' }, 403);

    if (action === 'list_teachers') {
      const { data: teachers } = await admin.from('allowed_teachers')
        .select('email, full_name, role, created_at').order('created_at');
      const { data: links } = await admin.from('teacher_courses').select('email, course_id');
      const byEmail = new Map<string, string[]>();
      (links ?? []).forEach((l) => {
        const k = l.email.toLowerCase();
        if (!byEmail.has(k)) byEmail.set(k, []);
        byEmail.get(k)!.push(l.course_id);
      });
      return json({ teachers: (teachers ?? []).map((t) => ({ ...t, course_ids: byEmail.get(t.email.toLowerCase()) ?? [] })) });
    }

    if (action === 'save_teacher') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const fullName = String(body.full_name ?? '').trim() || null;
      const role = body.role === 'admin' ? 'admin' : 'teacher';
      const courseIds: string[] = Array.isArray(body.course_ids) ? body.course_ids : [];
      if (!email) return json({ error: 'Email kerak' }, 400);
      // Kurslar mavjudligini oldindan tekshiramiz: boshqa administrator kursni o'chirgan bo'lsa, o'qituvchi jimgina
      // kurssiz qolmasin (avval eski biriktirishlar o'chib, yangilari xato bilan yozilmay qolardi)
      const wanted = role === 'admin' ? [] : [...new Set(courseIds.map((c) => String(c)))];
      if (wanted.some((c) => !UUID_RE.test(c))) return json({ error: "Kurs identifikatori noto'g'ri" }, 400);
      if (wanted.length) {
        const { data: found } = await admin.from('courses').select('id').in('id', wanted);
        if ((found ?? []).length !== wanted.length) {
          return json({ error: "Tanlangan kurslardan biri topilmadi (boshqa administrator o'chirgan bo'lishi mumkin). Sahifani yangilang." }, 409);
        }
      }
      const { data: existing } = await admin.from('allowed_teachers').select('email, role').eq('email', email).maybeSingle();
      // "Yangi o'qituvchi" formasi mavjud hisobni jimgina qayta yozmasin (ism, rol, parol, kurslar)
      if (body.create && existing) return json({ error: "Bu email allaqachon ro'yxatda" }, 409);
      // O'zini yoki oxirgi administratorni o'qituvchiga tushirib bo'lmaydi — tizim boshqaruvsiz qoladi
      if (existing?.role === 'admin' && role !== 'admin') {
        if (email === actor.email.toLowerCase()) return json({ error: "O'z rolingizni o'zgartira olmaysiz" }, 400);
        const { count } = await admin.from('allowed_teachers').select('*', { count: 'exact', head: true }).eq('role', 'admin');
        if ((count ?? 0) <= 1) return json({ error: "Oxirgi administratorni o'qituvchiga aylantirib bo'lmaydi" }, 400);
      }
      if (!existing) {
        if (password.length < 8) return json({ error: "Yangi hisob uchun kamida 8 belgili parol kerak" }, 400);
        const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) {
          if (!/already|exists|registered/i.test(error.message)) return json({ error: error.message }, 400);
          // Bu email bilan hisob allaqachon bor (masalan, o'zi ro'yxatdan o'tgan va tasdiqlanmagan): administrator
          // belgilagan parol qo'llanadi va hisob tasdiqlanadi — aks holda eski parol qolib, yangisi ishlamasdi
          const u = await findAuthUser(email);
          if (!u) return json({ error: "Bu email bilan hisob bor, lekin uni yangilab bo'lmadi" }, 500);
          const { error: perr } = await admin.auth.admin.updateUserById(u.id, { password, email_confirm: true });
          if (perr) return json({ error: perr.message }, 400);
        }
      } else if (password) {
        if (password.length < 8) return json({ error: "Parol kamida 8 belgi bo'lishi kerak" }, 400);
        const u = await findAuthUser(email);
        if (u) {
          const { error: perr } = await admin.auth.admin.updateUserById(u.id, { password });
          if (perr) return json({ error: perr.message }, 400);
        }
      }
      const { error: uerr } = await admin.from('allowed_teachers').upsert({ email, full_name: fullName, role, added_by: actor.email });
      if (uerr) return json({ error: uerr.message }, 500);
      // Avval yangi biriktirishlar yoziladi, keyin ortiqchasi o'chadi: yozish xato bersa eski biriktirishlar saqlanib qoladi
      if (wanted.length) {
        const { error: terr } = await admin.from('teacher_courses').upsert(wanted.map((cid) => ({ email, course_id: cid })));
        if (terr) return json({ error: terr.message }, 500);
      }
      const { data: have } = await admin.from('teacher_courses').select('course_id').eq('email', email);
      const stale = (have ?? []).map((r) => r.course_id).filter((c) => !wanted.includes(c));
      if (stale.length) {
        const { error: derr } = await admin.from('teacher_courses').delete().eq('email', email).in('course_id', stale);
        if (derr) return json({ error: derr.message }, 500);
      }
      return json({ ok: true });
    }

    if (action === 'remove_teacher') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!email) return json({ error: 'Email kerak' }, 400);
      if (email === actor.email.toLowerCase()) return json({ error: "O'zingizni o'chira olmaysiz" }, 400);
      await admin.from('teacher_courses').delete().eq('email', email);
      await admin.from('allowed_teachers').delete().eq('email', email);
      const u = await findAuthUser(email);
      if (u) await admin.auth.admin.deleteUser(u.id);
      return json({ ok: true });
    }

    if (action === 'save_course') {
      const id = body.id ? String(body.id) : null;
      // Rang panelda style="--acc:var(--<rang>)" ga tushadi — faqat ma'lum qiymatlar
      const COLORS = ['sky', 'green', 'teal', 'violet', 'rose', 'gold'];
      const color = String(body.color ?? 'sky');
      const row: Record<string, unknown> = {
        name: String(body.name ?? '').replace(/\s+/g, ' ').trim(),
        icon: [...String(body.icon ?? '📘').trim()].slice(0, 8).join('') || '📘',
        color: COLORS.includes(color) ? color : 'sky',
        active: body.active !== false,
      };
      if (!row.name) return json({ error: 'Kurs nomi kerak' }, 400);
      if ((row.name as string).length > 80) return json({ error: 'Kurs nomi juda uzun (80 belgigacha)' }, 400);
      // Oylik narx: faqat so'rovda bo'lsa o'zgaradi (eski panel uni o'chirib yubormasin)
      if ('monthly_fee' in body) {
        const v = body.monthly_fee;
        const fee = v === null || v === '' ? null
          : typeof v === 'number' ? v
          : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
        if (fee !== null && !(Number.isInteger(fee) && fee >= 0 && fee <= 100_000_000)) {
          return json({ error: "Oylik narx noto'g'ri" }, 400);
        }
        row.monthly_fee = fee;
      }
      const q = id ? await admin.from('courses').update(row).eq('id', id).select('id')
        : await admin.from('courses').insert(row).select('id');
      if (q.error) {
        if (q.error.code === '23505') return json({ error: `«${row.name}» nomli kurs allaqachon bor` }, 409);
        return json({ error: q.error.message }, 400);
      }
      if (!q.data?.length) return json({ error: 'Kurs topilmadi' }, 404);
      return json({ ok: true, id: q.data[0].id });
    }

    if (action === 'remove_course') {
      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id kerak' }, 400);
      const { count } = await admin.from('students').select('*', { count: 'exact', head: true }).eq('course_id', id);
      if ((count ?? 0) > 0) return json({ error: `Bu kursda ${count} ta o'quvchi bor — avval ularni ko'chiring` }, 400);
      const { error } = await admin.from('courses').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- Ariza xabarnomalari ----
    if (action === 'admin_link') {
      const botUsername = await getCfg('bot_username');
      if (!botUsername) return json({ error: 'Avval Telegram botni ulang' }, 400);
      const code = randomHex(8);
      await setCfg('admin_link_code', code);
      await setCfg('admin_link_expires', new Date(Date.now() + 30 * 60 * 1000).toISOString());
      return json({ ok: true, link: `https://t.me/${botUsername}?start=admin_${code}` });
    }

    if (action === 'list_notify_chats') {
      const { data } = await admin.from('notify_chats').select('chat_id, label, created_at').order('created_at');
      return json({ chats: data ?? [] });
    }

    if (action === 'remove_notify_chat') {
      const chatId = Number(body.chat_id);
      if (!chatId) return json({ error: 'chat_id kerak' }, 400);
      await admin.from('notify_chats').delete().eq('chat_id', chatId);
      return json({ ok: true });
    }

    if (action === 'save_template') {
      const kind = String(body.kind ?? '');
      if (!Object.prototype.hasOwnProperty.call(TPL_VARS, kind)) return json({ error: 'bad kind' }, 400);
      const on = body.on !== false;
      const raw = body.text == null ? '' : String(body.text)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '');
      const text = raw.trim() ? raw : null;
      if (text) {
        const err = checkTemplate(kind, text);
        if (err) return json({ error: err }, 400);
      }
      let all: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse((await getCfg('msg_templates')) ?? '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) all = parsed;
      } catch { /* buzilgan bo'lsa — noldan */ }
      all[kind] = { on, text, updated_at: new Date().toISOString() };
      const { error } = await admin.from('app_config')
        .upsert({ key: 'msg_templates', value: JSON.stringify(all), updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, templates: all });
    }

    // ---- To'lov eslatmasi: qarzdor o'quvchilarning ota-onasiga ----
    if (action === 'send_reminders') {
      const t0 = Date.now();
      const month = String(body.month ?? '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: "Oy formati noto'g'ri" }, 400);
      const cur = ymOf(new Date());
      const from = ymShift(cur, -11);
      if (month > cur || month < from) return json({ error: "Eslatmani joriy oy va oldingi 11 oy uchun yuborish mumkin" }, 400);
      if (!Array.isArray(body.student_ids)) return json({ error: 'student_ids kerak' }, 400);
      const ids = [...new Set(body.student_ids.filter((x: unknown) => typeof x === 'string' && UUID_RE.test(x)))] as string[];
      if (!ids.length) return json({ error: "O'quvchi tanlanmagan" }, 400);
      if (ids.length > REMIND_MAX) return json({ error: `Bir marta eng ko'p ${REMIND_MAX} o'quvchi` }, 400);

      const token = await getCfg('bot_token');
      if (!token) return json({ error: 'Avval Telegram botni ulang' }, 400);
      let tplText = DEFAULT_PAY, famTplText = DEFAULT_PAYFAM;
      try {
        const all = JSON.parse((await getCfg('msg_templates')) ?? '{}');
        if (typeof all?.pay?.text === 'string' && all.pay.text.trim()) tplText = all.pay.text;
        if (typeof all?.payfam?.text === 'string' && all.payfam.text.trim()) famTplText = all.payfam.text;
      } catch { /* standart matn */ }

      const [{ data: studs }, { data: pays }, { data: recent }] = await Promise.all([
        admin.from('students').select('id, full_name, active, telegram_chat_id, created_at, courses(name), parent_chats(chat_id)').in('id', ids),
        admin.from('payments').select('student_id, month').in('student_id', ids).gte('month', from + '-01').lte('month', cur + '-01'),
        admin.from('payment_reminders').select('student_id').in('student_id', ids).neq('status', 'failed')
          .gte('sent_at', new Date(Date.now() - REMIND_COOLDOWN_DAYS * 86400_000).toISOString()),
      ]);
      const byId = new Map((studs ?? []).map((s: any) => [s.id, s]));
      const paid = new Map<string, Set<string>>();
      (pays ?? []).forEach((p: any) => {
        if (!paid.has(p.student_id)) paid.set(p.student_id, new Set());
        paid.get(p.student_id)!.add(String(p.month).slice(0, 7));
      });
      const recentSet = new Set((recent ?? []).map((r: any) => r.student_id));

      // Tunda xabar ovozsiz boradi
      const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date()));
      const quiet = hour < 8 || hour >= 21;

      const skipped: Record<string, number> = {};
      const notSent: string[] = [];
      const outcome = new Map<string, Record<string, unknown>>();   // o'quvchi -> natija (javobda so'rov tartibida chiqadi)
      let sent = 0, failed = 0, unknown = 0, netStreak = 0, retried429 = false;
      let aborted: string | null = null;
      const lastByChat = new Map<number, number>();
      let lastSend = 0;
      const skip = (s: any, id: string, code: string) => {
        skipped[code] = (skipped[code] ?? 0) + 1;
        outcome.set(id, { student_id: id, name: s ? normName(s.full_name) : null, status: 'skipped', code });
      };

      // 1) Kimga yuboriladi: har bir o'quvchi uchun qoidalar (o'tkazib yuborilganlar skip bilan belgilanadi)
      type Res = { c: ReturnType<typeof classify>; r: any };
      type Cand = {
        id: string; s: any; ism: string; kurs: string; chats: number[]; owed: string[];
        row?: string; tried: boolean; sent: boolean; unk: Res | null; fail: Res | null;
      };
      const cands = new Map<string, Cand>();
      for (const id of ids) {
        const s: any = byId.get(id);
        try {
          if (!s) { skip(null, id, 'not_found'); continue; }
          const start = ymOf(new Date(s.created_at ?? Date.now()));
          const pm = paid.get(id) ?? new Set<string>();
          const ism = normName(s.full_name);
          if (s.active === false) { skip(s, id, 'inactive'); continue; }
          if (start > month) { skip(s, id, 'not_started'); continue; }
          if (pm.has(month)) { skip(s, id, 'paid'); continue; }
          const chatList = chatsOf(s);
          if (!chatList.length) { skip(s, id, 'no_tg'); continue; }
          if (badName(ism)) { skip(s, id, 'bad_name'); continue; }
          if (recentSet.has(id)) { skip(s, id, 'recent'); continue; }
          // Joriy oygacha qarz oylari (tanlangan oy emas) — ota-ona to'liq qarzni ko'rsin
          const owed: string[] = [];
          for (let m = from; m <= cur; m = ymShift(m, 1)) if (m >= start && !pm.has(m)) owed.push(m);
          cands.set(id, { id, s, ism, kurs: String(s.courses?.name ?? ''), chats: chatList, owed, tried: false, sent: false, unk: null, fail: null });
        } catch (_e) {
          // Bitta o'quvchidagi kutilmagan xato butun ro'yxatni to'xtatmasin
          skip(s, id, 'db');
        }
      }

      // 2) Chat bo'yicha guruhlaymiz: bir ota-onaga (chatga) tushadigan farzandlar BITTA xabarda.
      // Ona va ota ikkalasi ulangan bo'lsa — har biriga o'z xabari (ikkalasi ham to'liq ro'yxatni ko'radi)
      const groups = new Map<number, Cand[]>();
      for (const id of ids) {
        const c = cands.get(id);
        if (!c) continue;
        for (const chat of c.chats) { const g = groups.get(chat); if (g) g.push(c); else groups.set(chat, [c]); }
      }
      let messages = 0, familyMsgs = 0;
      for (const [chat, members] of groups) {
        if (aborted || Date.now() - t0 > REMIND_BUDGET_MS) break;      // yetmaganlar not_sent bo'lib qoladi (panel qayta yuboradi)

        // Avval jurnalga "pending" — jarayon yiqilsa ham qayta yuborilmaydi
        for (const m of members) {
          if (m.row || outcome.has(m.id)) continue;
          const { data: row, error: insErr } = await admin.from('payment_reminders')
            .insert({ student_id: m.id, month: month + '-01', sent_by_email: actor.email, status: 'pending' })
            .select('id').single();
          if (insErr) { skip(m.s, m.id, insErr.code === '23505' ? 'recent' : 'db'); continue; }
          m.row = row.id;
        }
        const live = members.filter((m) => m.row);
        if (!live.length) continue;

        const text = live.length === 1
          ? renderTpl(tplText, {
            ism: live[0].ism,
            kurs: live[0].kurs,
            oy: oyName(month),
            oylar: live[0].owed.length === 1 && live[0].owed[0] === month ? '' : live[0].owed.map(oyName).join(', '),
          })
          : renderTpl(famTplText, {
            oy: oyName(month),
            bolalar: [
              ...live.slice(0, FAM_MAX).map((m) => `• ${m.ism}${m.kurs ? ` (${m.kurs})` : ''} — ${m.owed.map(oyName).join(', ')}`),
              ...(live.length > FAM_MAX ? [`… +${live.length - FAM_MAX}`] : []),
            ].join('\n'),
          });

        // Bir chatga sekundiga bittadan ko'p emas (Telegram chegarasi)
        const waitChat = 1100 - (Date.now() - (lastByChat.get(chat) ?? 0));
        const waitAll = 40 - (Date.now() - lastSend);
        if (Math.max(waitChat, waitAll) > 0) await sleep(Math.max(waitChat, waitAll));

        const payload = {
          chat_id: chat, text, parse_mode: 'HTML',
          link_preview_options: { is_disabled: true }, disable_notification: quiet,
        };
        let r: any = await tg(token, 'sendMessage', payload);
        if (!r?.ok && Number(r?.error_code) === 429 && !retried429 && Number(r?.parameters?.retry_after) <= 5) {
          retried429 = true;
          await sleep(Number(r.parameters.retry_after) * 1000 + 100);
          r = await tg(token, 'sendMessage', payload);
        }
        lastSend = Date.now();
        lastByChat.set(chat, lastSend);
        const cc = classify(r);
        messages++;
        if (live.length > 1) familyMsgs++;
        for (const m of live) {
          m.tried = true;
          if (cc.status === 'sent') m.sent = true;
          else if (cc.status === 'unknown') m.unk ??= { c: cc, r };
          else m.fail ??= { c: cc, r };
        }
        netStreak = cc.status === 'unknown' ? netStreak + 1 : 0;
        if (cc.abort) aborted = cc.abort;
        else if (netStreak >= 3) aborted = 'network';
      }

      // 3) Natija: o'quvchi uchun "yuborildi" — kamida bitta ota-onaga (xabarga) yetgan bo'lsa; yetmagan bo'lsa
      // "noma'lum" (javob kelmadi — yetgan bo'lishi mumkin) xatodan ustun
      for (const id of ids) {
        if (outcome.has(id)) continue;
        const m = cands.get(id);
        if (!m) continue;
        if (!m.tried) { notSent.push(id); continue; }
        const bad = m.unk ?? m.fail;
        const c = m.sent ? { status: 'sent' as const, code: 'sent' } : bad!.c;
        const r = m.sent ? { ok: true } : bad!.r;
        const errText = c.status === 'sent' ? null : redact(String(r?.description ?? '')).slice(0, 200) || null;
        await admin.from('payment_reminders').update({ status: c.status, code: c.code, error: errText }).eq('id', m.row!);
        if (c.status === 'sent') sent++;
        else if (c.status === 'unknown') unknown++;
        else failed++;
        outcome.set(id, { student_id: id, name: m.ism, status: c.status, code: c.code });
      }
      const results = ids.map((id) => outcome.get(id)).filter(Boolean) as Record<string, unknown>[];

      return json({
        ok: true, month, sent, failed, unknown, skipped, results, not_sent: notSent,
        messages, family: familyMsgs,
        ...(aborted ? { aborted } : {}),
      });
    }

    // ---- To'lov qabul qilindi: yangi to'lov yozilganda ota-onaga ----
    if (action === 'notify_payment') {
      const pid = String(body.payment_id ?? '');
      if (!UUID_RE.test(pid)) return json({ error: 'payment_id kerak' }, 400);
      const { data: pay } = await admin.from('payments')
        .select('id, month, amount, paid_on, notified_at, students(full_name, telegram_chat_id, courses(name), parent_chats(chat_id))')
        .eq('id', pid).maybeSingle();
      if (!pay) return json({ error: 'payment not found' }, 404);
      const st: any = (pay as any).students;
      if (pay.notified_at) return json({ ok: true, sent: false, code: 'already' });
      const payChats = chatsOf(st);
      if (!payChats.length) return json({ ok: true, sent: false, code: 'no_tg' });
      // Eslatmadagidek: ismda karta raqami / havola bo'lsa, bot orqali ota-onaga yubormaymiz
      const ism = normName(st.full_name);
      if (badName(ism)) return json({ ok: true, sent: false, code: 'bad_name' });
      const token = await getCfg('bot_token');
      if (!token) return json({ ok: true, sent: false, code: 'no_bot' });
      const tpl = { on: true, text: DEFAULT_PAID };
      try {
        const saved = JSON.parse((await getCfg('msg_templates')) ?? '{}')?.paid;
        if (saved && typeof saved === 'object') {
          if (saved.on === false) tpl.on = false;
          if (typeof saved.text === 'string' && saved.text.trim()) tpl.text = saved.text;
        }
      } catch { /* standart matn */ }
      if (!tpl.on) return json({ ok: true, sent: false, code: 'muted' });

      // Avval band qilamiz — ikki oyna / qayta urinish ikki marta yubormasin
      const { data: claimed } = await admin.from('payments')
        .update({ notified_at: new Date().toISOString() }).eq('id', pid).is('notified_at', null).select('id');
      if (!claimed?.length) return json({ ok: true, sent: false, code: 'already' });

      const text = renderTpl(tpl.text, {
        ism,
        kurs: String(st.courses?.name ?? ''),
        oy: oyName(String(pay.month).slice(0, 7)),
        summa: pay.amount == null ? '' : fmtSum(Number(pay.amount)),
        sana: sanaOf(String(pay.paid_on)),
      });
      // Ona va ota ikkalasiga; kamida bittasiga yetsa — yuborildi
      let paySent = false, payFail: ReturnType<typeof classify> | null = null;
      for (const chat of payChats) {
        const r = await tg(token, 'sendMessage', {
          chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
        });
        const c = classify(r);
        if (c.status === 'sent') paySent = true; else if (!payFail) payFail = c;
      }
      if (!paySent) {
        // Yetmadi — bandni bo'shatamiz, admin qayta yuborishi mumkin
        await admin.from('payments').update({ notified_at: null }).eq('id', pid);
        return json({ ok: true, sent: false, code: payFail?.code ?? 'failed' });
      }
      return json({ ok: true, sent: true });
    }

    // ---- Telegram bot ----
    if (action === 'save_bot_token') {
      const token = String(body.token ?? '').trim();
      if (!token) return json({ error: 'Token kerak' }, 400);
      const me = await tg(token, 'getMe', {});
      if (!me.ok) return json({ error: "Token noto'g'ri: " + (me.description ?? '') }, 400);
      await setCfg('bot_token', token);
      await setCfg('bot_username', me.result.username);
      await setCfg('tg_offset', '0');
      const wh = await enableWebhook(token);
      return json({ ok: true, username: me.result.username, webhook: wh.ok, webhook_error: wh.error });
    }

    if (action === 'setup_webhook') {
      const token = await getCfg('bot_token');
      if (!token) return json({ error: 'Avval bot tokenini ulang' }, 400);
      const wh = await enableWebhook(token);
      return json({ ok: wh.ok, error: wh.error });
    }

    if (action === 'webhook_status') {
      const token = await getCfg('bot_token');
      const mode = await getCfg('tg_mode');
      if (!token) return json({ no_token: true, mode });
      const info = await tg(token, 'getWebhookInfo', {});
      const r = info?.result ?? {};
      return json({ mode, active: typeof r.url === 'string' && r.url.length > 0, url: r.url ?? '', pending: r.pending_update_count ?? 0, last_error: r.last_error_message ?? null });
    }

    if (action === 'check_telegram') {
      const mode = await getCfg('tg_mode');
      if (mode === 'webhook') return json({ processed: 0, webhook: true });
      const token = await getCfg('bot_token');
      if (!token) return json({ processed: 0, no_token: true });
      return json(await processTelegramUpdates(token));
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: redact(String(e)) }, 500);
  }
});
