// mark-attendance — davomat holatini belgilaydi va ota-onaga xabar yuboradi.
//
// Holatlar:
//   in      keldi     (vaqti bilan)
//   out     ketdi     (vaqti bilan, faqat "keldi" dan keyin)
//   absent  kelmadi   (sababsiz)
//   excused sababli   (sabab `note` da)
//
// Bir kunda bir o'quvchida bitta mantiqiy holat bo'ladi: "kelmadi" yozilsa
// keldi/ketdi o'chadi, keyin bola kelib qolsa "keldi" kelmadi/sabablini o'chiradi.
// Yozish faqat shu funksiya orqali o'tadi (attendance da INSERT policy yo'q).
//
// So'rov shakllari:
//   { student_id, kind, note? }              — bitta o'quvchi
//   { student_ids: [...], kind, note? }      — butun guruh bir bosishda
//   { ..., date: 'YYYY-MM-DD' }              — o'tgan kunni tuzatish
//   { undo_id, restore?: [{kind, occurred_at, note}] }
//                                            — "Bekor qilish": yangi belgini o'chiradi va u
//                                              almashtirgan belgilarni asl vaqti bilan qaytaradi
//
// Javobda `replaced` — yangi belgi o'chirgan yozuvlar (kind, occurred_at, note). Panel
// ularni "Bekor qilish" uchun saqlab turadi: masalan, "Kelmadi" xato bosilsa, o'chgan
// "Keldi 10:05 / Ketdi 12:02" qaytadi.
//
// O'tgan kun uchun ota-onaga xabar YUBORILMAYDI: kechagi dars haqida bugun
// "farzandingiz keldi" deyish ota-onani chalg'itadi. Xabar faqat bugungi
// belgilashda ketadi.
//
// Xabar matni — shablondan (admin paneldan tahrirlaydi, app_config.msg_templates).
// Shablon yo'q yoki buzilgan bo'lsa — quyidagi standart matn.
//
// Yuborish ikki bosqichda: avval hamma belgilar yoziladi, keyin xabarlar ketadi (5 ta chat parallel,
// bitta chatga ketma-ket, umumiy vaqt chegarasi bilan) — 60 o'quvchilik guruh bitta sekin Telegramda
// so'rovni to'xtatib qo'ymaydi. Javobda har bir o'quvchi uchun `delivery` — xabar yetdimi:
//   sent | blocked | no_chat | failed | unknown (javob kelmadi, yetgan bo'lishi mumkin) | skipped (vaqt tugadi)
//   | muted (admin o'chirgan) | no_tg (ota-ona ulanmagan) | bad_name / bad_note (xavfsizlik) | null (o'tgan kun)
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const TZ = 'Asia/Samarkand';
const KINDS = ['in', 'out', 'absent', 'excused'] as const;
type Kind = typeof KINDS[number];

// Yangi holat yozilganda o'sha kundagi qaysi yozuvlar o'chishi kerak
const REPLACES: Record<Kind, Kind[]> = {
  in:      ['absent', 'excused'],
  out:     [],
  absent:  ['in', 'out', 'excused'],
  excused: ['in', 'out', 'absent'],
};

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Xato matnidan bot tokenini olib tashlaymiz: tarmoq xatosi URL ni (bot<TOKEN>) iqtibos qiladi
const redact = (s: string) => s.replace(/bot\d+:[\w-]+/g, 'bot***');
// ilike da _ va % qolip belgisi — foydalanuvchining o'z emaili qolip bo'lib qolmasin
const likeEsc = (s: string) => s.replace(/[\\%_]/g, '\\$&');

// O'qituvchi yozgan ism va izoh ota-onaga bot orqali boradi: karta raqami / havola bo'lib ketmasin
// (xuddi shu qoida admin-api dagi to'lov xabarida ham bor)
const normName = (n: unknown) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
const badName = (n: string) => /https?:\/\/|www\.|t\.me\/|@/i.test(n) || /\d{7,}/.test(n.replace(/[\s().-]/g, ''));
const badNote = (n: string) => /https?:\/\/|www\.|t\.me\/|@/i.test(n) || /\d{9,}/.test(n.replace(/[\s().-]/g, ''));

// Telegram javobini holatga aylantiramiz (admin-api dagi classify bilan bir xil). abort — qolganlarini yubormaslik kerak.
function classify(r: any): { status: 'sent' | 'failed' | 'unknown'; code: string; abort?: string } {
  if (r?.ok) return { status: 'sent', code: 'sent' };
  if (r?.net) return { status: 'unknown', code: 'unknown' };
  const ec = Number(r?.error_code) || 0;
  const d = String(r?.description ?? '');
  if (ec === 403) return { status: 'failed', code: 'blocked' };
  if (ec === 401 || ec === 404) return { status: 'failed', code: 'failed', abort: 'token' };
  if (ec === 429) return { status: 'failed', code: 'failed', abort: 'rate_limited' };
  if (ec === 400 && /can't parse entities|message is too long|text is empty|must be non-empty/i.test(d)) return { status: 'failed', code: 'failed', abort: 'format' };
  if (ec === 400 && /chat not found|PEER_ID_INVALID|user not found/i.test(d)) return { status: 'failed', code: 'no_chat' };
  if (!ec) return { status: 'unknown', code: 'unknown' };
  return { status: 'failed', code: 'failed' };
}

async function sendTg(token: string, chatId: number | string, text: string): Promise<any> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (_e) {
    return { ok: false, net: true };
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Xabar yuborish: bir vaqtda 5 ta chat, bitta chatga ketma-ket. Panel javobni 20 s kutadi: yangi xabar so'rov boshlanganidan
// 11 s o'tgach boshlanmaydi, bitta xabar esa ko'pi bilan 6 s kutiladi — eng yomon holda ham ~18 s da javob qaytadi.
const SEND_CONCURRENCY = 5;
const SEND_DEADLINE_MS = 11_000;
const SEND_TIMEOUT_MS = 6_000;

// Samarqand bo'yicha kun kaliti (UTC+5, yoz vaqti yo'q)
function dayKeyOf(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

const dayStartIso = (key: string) => new Date(`${key}T00:00:00+05:00`).toISOString();
const dayEndIso = (key: string) => new Date(new Date(`${key}T00:00:00+05:00`).getTime() + 86400_000).toISOString();

// ---- Ota-onaga xabar shablonlari ----
// {ism} {vaqt} {kurs} {sana} {sabab} — o'zgaruvchilar, *matn* — qalin.
// Qiymati bo'sh o'zgaruvchi turgan qator yuborilmaydi (masalan, sabab yozilmasa
// "💬 {sabab}" qatori tushib qoladi) — {ism} turgan asosiy qatordan tashqari.
// Xuddi shu mantiq panelda ham bor (assets/app.js → renderTpl): admin ko'rgan
// namuna ota-onaga boradigan xabar bilan bir xil bo'lishi uchun.
const DEFAULT_TPL: Record<Kind, string> = {
  in:      "✅ *{ism}* soat *{vaqt}* da Parvoz O'quv Markaziga *keldi*.\n📚 {kurs}",
  out:     "🏠 *{ism}* soat *{vaqt}* da markazdan *ketdi*.\n📚 {kurs}",
  absent:  "❗️ *{ism}* bugungi darsga *kelmadi*.\n📚 {kurs}\n\nAgar sabab bo'lsa, iltimos o'qituvchiga xabar bering.",
  excused: "📝 *{ism}* bugun *sababli* qoldi.\n💬 {sabab}\n📚 {kurs}",
};

type Tpl = { on: boolean; text: string };

function loadTemplates(raw: string | null | undefined): Record<Kind, Tpl> {
  let saved: any = {};
  try { saved = raw ? JSON.parse(raw) : {}; } catch { saved = {}; }
  if (!saved || typeof saved !== 'object') saved = {};
  const out = {} as Record<Kind, Tpl>;
  for (const k of KINDS) {
    const s = saved[k] && typeof saved[k] === 'object' ? saved[k] : {};
    const text = typeof s.text === 'string' && s.text.trim() ? s.text : DEFAULT_TPL[k];
    out[k] = { on: s.on !== false, text };
  }
  return out;
}

function renderTpl(text: string, vars: Record<string, string>): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) =>
    line.includes('{ism}') ||
    [...line.matchAll(/\{(\w+)\}/g)].every(([, n]) => !(n in vars) || vars[n] !== ''));
  return esc(lines.join('\n'))
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/\{(\w+)\}/g, (m, n) => (n in vars ? esc(vars[n]) : m))
    .replace(/[ \t]+$/gm, '')                         // bo'sh o'zgaruvchidan qolgan probel
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const sanaOf = (key: string) => `${Number(key.slice(8, 10))}-${OYLAR[Number(key.slice(5, 7)) - 1]}`;

// Necha kun orqaga tuzatishga ruxsat beramiz
const MAX_BACKFILL_DAYS = 30;
// Bir so'rovda nechta o'quvchi
const MAX_BATCH = 60;

// Sanani tekshiramiz: kelajak bo'lmasin, juda uzoq o'tmish ham bo'lmasin.
// Qaytadi: [kunKaliti, xatoMatni]
function resolveDay(raw: unknown): [string, null] | [null, string] {
  const today = dayKeyOf(new Date());
  if (raw === undefined || raw === null || raw === '') return [today, null];

  const key = String(raw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return [null, "Sana formati noto'g'ri"];
  const t = Date.parse(`${key}T00:00:00+05:00`);
  if (Number.isNaN(t)) return [null, "Sana formati noto'g'ri"];
  // V8 mavjud bo'lmagan sanani (31-sentabr, 30-fevral) rad etmaydi — keyingi
  // kunga aylantiradi. Qaytarib formatlab, aynan o'sha kun ekanini tekshiramiz.
  if (dayKeyOf(new Date(t)) !== key) return [null, "Bunday sana yo'q"];
  if (key > today) return [null, "Kelajakdagi kunni belgilab bo'lmaydi"];

  const back = Math.round((Date.parse(`${today}T00:00:00+05:00`) - t) / 86400_000);
  if (back > MAX_BACKFILL_DAYS) {
    return [null, `Eng ko'p ${MAX_BACKFILL_DAYS} kun orqaga tuzatish mumkin`];
  }
  return [key, null];
}

// "Bekor qilish": faqat o'zi qo'ygan belgini (admin — istalganini), faqat o'z kursida va
// faqat tuzatish mumkin bo'lgan kunlarda. Qaytariladigan belgilar o'sha kunga va o'chirilgan
// belgi almashtirishi mumkin bo'lgan turlarga tegishli bo'lishi shart. Ota-onaga xabar ketmaydi.
async function undoMark(undoId: string, restoreRaw: unknown, email: string, role: string) {
  const { data: row } = await admin.from('attendance')
    .select('id, student_id, kind, occurred_at, marked_by_email, students(course_id)')
    .eq('id', undoId).maybeSingle();
  if (!row) return json({ error: 'Belgi topilmadi' }, 404);

  if (role !== 'admin') {
    if ((row.marked_by_email ?? '').toLowerCase() !== email) return json({ error: 'forbidden' }, 403);
    const { data: links } = await admin
      .from('teacher_courses').select('course_id').ilike('email', likeEsc(email));
    const courseId = (row as any).students?.course_id;
    if (!(links ?? []).some((l) => l.course_id === courseId)) return json({ error: 'forbidden' }, 403);
  }

  const key = dayKeyOf(new Date(row.occurred_at));
  const [, dayErr] = resolveDay(key);
  if (dayErr) return json({ error: dayErr }, 400);
  const start = Date.parse(dayStartIso(key));
  const end = Date.parse(dayEndIso(key));

  const allowed = REPLACES[row.kind as Kind] ?? [];
  const list = Array.isArray(restoreRaw) ? restoreRaw.slice(0, 3) : [];
  const restore: Record<string, unknown>[] = [];
  for (const x of list as any[]) {
    const kind = String(x?.kind ?? '') as Kind;
    const at = Date.parse(String(x?.occurred_at ?? ''));
    if (!allowed.includes(kind) || Number.isNaN(at) || at < start || at >= end) {
      return json({ error: 'bad request' }, 400);
    }
    const note = x?.note == null ? null
      : String(x.note).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) || null;
    restore.push({ student_id: row.student_id, kind, note, occurred_at: new Date(at).toISOString(), marked_by_email: email });
  }

  // "Keldi" bekor qilinsa, unga bog'liq "Ketdi" ham o'chadi
  const drop = [row.id];
  if (row.kind === 'in') {
    const { data: outs } = await admin.from('attendance').select('id')
      .eq('student_id', row.student_id).eq('kind', 'out')
      .gte('occurred_at', dayStartIso(key)).lt('occurred_at', dayEndIso(key));
    drop.push(...(outs ?? []).map((o) => o.id));
  }
  const { error: derr } = await admin.from('attendance').delete().in('id', drop);
  if (derr) return json({ error: derr.message }, 500);

  // "Keldi" oldin, "Ketdi" keyin (ketdi keldisiz bo'lmaydi)
  restore.sort((a, b) => (a.kind === 'out' ? 1 : 0) - (b.kind === 'out' ? 1 : 0));
  let restored = 0;
  for (const r of restore) {
    const { error } = await admin.from('attendance').insert(r);
    if (!error) restored++;
  }
  return json({ ok: true, removed: drop.length, restored });
}

Deno.serve(async (req) => {
  const reqStart = Date.now();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);
    const { data: u, error: uerr } = await admin.auth.getUser(jwt);
    const email = u?.user?.email?.toLowerCase();
    if (uerr || !email) return json({ error: 'unauthorized' }, 401);

    const { data: teacher } = await admin
      .from('allowed_teachers').select('email, role').ilike('email', likeEsc(email)).maybeSingle();
    if (!teacher) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    if (body.undo_id) return await undoMark(String(body.undo_id), body.restore, email, teacher.role);
    const kind = String(body.kind ?? '') as Kind;
    const note = String(body.note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) || null;
    if (!KINDS.includes(kind)) return json({ error: 'bad request' }, 400);

    // Bitta o'quvchi ham, guruh ham bir xil yo'ldan o'tadi
    const ids: string[] = Array.isArray(body.student_ids)
      ? body.student_ids.map((x: unknown) => String(x ?? '')).filter(Boolean)
      : [String(body.student_id ?? '')].filter(Boolean);
    if (!ids.length) return json({ error: 'bad request' }, 400);
    if (ids.length > MAX_BATCH) return json({ error: `Bir marta eng ko'p ${MAX_BATCH} o'quvchi` }, 400);

    const [dayKey, dayErr] = resolveDay(body.date);
    if (dayErr) return json({ error: dayErr }, 400);
    const isToday = dayKey === dayKeyOf(new Date());
    const dayStart = dayStartIso(dayKey!);
    const dayEnd = dayEndIso(dayKey!);

    // O'tgan kun uchun aniq vaqt yo'q — kun boshini yozamiz va panel
    // o'tgan kunlarda vaqtni ko'rsatmaydi (soxta soat chiqmasligi uchun).
    const occurredAt = isToday ? new Date().toISOString() : dayStart;

    const { data: rows } = await admin
      .from('students')
      .select('id, full_name, telegram_chat_id, course_id, active, courses(name)')
      .in('id', ids);
    const students = rows ?? [];
    if (!students.length) return json({ error: 'student not found' }, 404);

    // Fan bo'yicha cheklov: admin hammasiga, o'qituvchi faqat o'z kurslariga
    let allowedCourses: Set<string> | null = null;
    if (teacher.role !== 'admin') {
      const { data: links } = await admin
        .from('teacher_courses').select('course_id').ilike('email', likeEsc(email));
      allowedCourses = new Set((links ?? []).map((l) => l.course_id));
    }

    // Shu kundagi mavjud yozuvlar — bitta so'rovda hammasi uchun
    const { data: dayRows } = await admin
      .from('attendance').select('id, kind, student_id, occurred_at, note')
      .in('student_id', students.map((s) => s.id))
      .gte('occurred_at', dayStart).lt('occurred_at', dayEnd);

    type DayRow = { id: string; kind: string; occurred_at: string; note: string | null };
    const byStudent = new Map<string, DayRow[]>();
    for (const r of dayRows ?? []) {
      const arr = byStudent.get(r.student_id) ?? [];
      arr.push({ id: r.id, kind: r.kind, occurred_at: r.occurred_at, note: r.note });
      byStudent.set(r.student_id, arr);
    }

    const results: Record<string, unknown>[] = [];
    const toSend: { chat: number; text: string; res: Record<string, unknown> }[] = [];
    let notifiedCount = 0;

    // Bot tokeni va shablonlar — faqat bugungi belgilashda, bitta so'rovda
    let token: string | null = null;
    let tpls = loadTemplates(null);
    if (isToday) {
      const { data: cfg } = await admin.from('app_config').select('key, value').in('key', ['bot_token', 'msg_templates']);
      const byKey = new Map<string, string>((cfg ?? []).map((r) => [r.key, r.value] as [string, string]));
      token = byKey.get('bot_token') ?? null;
      tpls = loadTemplates(byKey.get('msg_templates'));
    }

    for (const student of students) {
      const skip = (reason: string, code: string) => {
        results.push({ student_id: student.id, name: student.full_name, ok: false, reason, code });
      };

      if (allowedCourses && !allowedCourses.has(student.course_id)) {
        skip('Bu kurs sizga biriktirilmagan', 'forbidden');
        continue;
      }
      if (student.active === false) { skip('Arxivdagi o\'quvchi', 'inactive'); continue; }

      const existing = byStudent.get(student.id) ?? [];
      // Guruhni belgilaganda allaqachon belgilangani sukut bilan o'tkazib yuboriladi
      if (existing.some((r) => r.kind === kind)) { skip('Allaqachon belgilangan', 'already'); continue; }
      if (kind === 'out' && !existing.some((r) => r.kind === 'in')) {
        skip('Avval "Keldi" belgilanishi kerak', 'needs_in');
        continue;
      }

      const dropRows = existing.filter((r) => REPLACES[kind].includes(r.kind as Kind));
      const drop = dropRows.map((r) => r.id);
      if (drop.length) await admin.from('attendance').delete().in('id', drop);

      const { data: row, error: ierr } = await admin
        .from('attendance')
        .insert({ student_id: student.id, kind, note, marked_by_email: email, occurred_at: occurredAt })
        .select('id, occurred_at, kind, note')
        .single();
      if (ierr) {
        // Ikki qurilmadan bir vaqtda bosildi — bazadagi indeks ikkinchisini rad etdi
        if (ierr.code === '23505') skip('Allaqachon belgilangan', 'already');
        else skip(ierr.message, 'db');
        continue;
      }

      // Xabar holati: sent/... ketadigan bo'lsa quyida (2-bosqich) to'ldiriladi
      let delivery: string | null = null;
      let text: string | null = null;
      if (isToday) {
        if (!tpls[kind].on) delivery = 'muted';                    // admin bu turdagi xabarni o'chirib qo'ygan — belgi yoziladi, xabar ketmaydi
        else if (!student.telegram_chat_id) delivery = 'no_tg';
        else if (!token) delivery = 'no_bot';
        else if (badName(normName(student.full_name))) delivery = 'bad_name';
        else if (note && badNote(note)) delivery = 'bad_note';
        else {
          const time = new Intl.DateTimeFormat('uz-UZ', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
          }).format(new Date(row.occurred_at));
          text = renderTpl(tpls[kind].text, {
            ism: normName(student.full_name),
            vaqt: time,
            kurs: (student as any).courses?.name ?? '',
            sana: sanaOf(dayKey!),
            sabab: note ?? '',
          });
          delivery = text ? 'pending' : 'failed';
          if (!text) text = null;
        }
      }

      const res: Record<string, unknown> = {
        student_id: student.id, name: student.full_name, ok: true,
        id: row.id, kind: row.kind, note: row.note, occurred_at: row.occurred_at,
        removed: drop.length, notified: false, muted: delivery === 'muted', delivery,
        replaced: dropRows.map((r) => ({ kind: r.kind, occurred_at: r.occurred_at, note: r.note })),
      };
      results.push(res);
      if (text) toSend.push({ chat: Number(student.telegram_chat_id), text, res });
    }

    // ---- 2-bosqich: xabarlar. Telegram ishlamasa ham belgilar saqlangan — xato hech narsani qaytarmaydi ----
    if (toSend.length && token) {
      const byChat = new Map<number, typeof toSend>();
      for (const m of toSend) byChat.set(m.chat, [...(byChat.get(m.chat) ?? []), m]);
      const queues = [...byChat.values()];
      let qi = 0, aborted = false, netStreak = 0;
      const worker = async () => {
        for (;;) {
          const q = queues[qi++];
          if (!q) return;
          for (const m of q) {
            if (aborted || Date.now() - reqStart > SEND_DEADLINE_MS) { m.res.delivery = 'skipped'; continue; }
            let r = await sendTg(token!, m.chat, m.text);
            if (!r?.ok && Number(r?.error_code) === 429 && Number(r?.parameters?.retry_after) <= 3) {
              await sleep(Number(r.parameters.retry_after) * 1000 + 100);
              r = await sendTg(token!, m.chat, m.text);
            }
            const c = classify(r);
            m.res.delivery = c.code;
            if (c.status === 'sent') { m.res.notified = true; notifiedCount++; netStreak = 0; }
            else if (c.status === 'unknown') { if (++netStreak >= 3) aborted = true; }
            else netStreak = 0;
            if (c.abort) aborted = true;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, queues.length) }, worker));
    }

    const okCount = results.filter((r) => r.ok).length;

    // Bitta o'quvchi so'ralgan bo'lsa — eski javob shakli saqlanadi
    if (ids.length === 1 && !Array.isArray(body.student_ids)) {
      const one = results[0];
      if (!one) return json({ error: 'student not found' }, 404);
      if (!one.ok) return json({ error: one.reason }, one.code === 'forbidden' ? 403 : one.code === 'db' ? 500 : 409);
      return json({ ...one, ok: true, day: dayKey, past: !isToday });
    }

    return json({
      ok: true, day: dayKey, past: !isToday,
      marked: okCount, skipped: results.length - okCount,
      notified: notifiedCount,
      // Xabar yetmaganlar: ota-ona botni bloklagan / yuborilmadi / vaqt tugadi (unknown — yetgan bo'lishi mumkin, alohida)
      notify_failed: results.filter((r) => r.ok && ['blocked', 'no_chat', 'failed', 'skipped', 'bad_name', 'bad_note'].includes(String(r.delivery))).length,
      notify_unknown: results.filter((r) => r.ok && r.delivery === 'unknown').length,
      results,
    });

  } catch (e) {
    return json({ error: redact(String(e)) }, 500);
  }
});
