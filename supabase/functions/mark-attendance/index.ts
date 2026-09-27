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
//
// O'tgan kun uchun ota-onaga xabar YUBORILMAYDI: kechagi dars haqida bugun
// "farzandingiz keldi" deyish ota-onani chalg'itadi. Xabar faqat bugungi
// belgilashda ketadi.
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

// Samarqand bo'yicha kun kaliti (UTC+5, yoz vaqti yo'q)
function dayKeyOf(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

const dayStartIso = (key: string) => new Date(`${key}T00:00:00+05:00`).toISOString();
const dayEndIso = (key: string) => new Date(new Date(`${key}T00:00:00+05:00`).getTime() + 86400_000).toISOString();

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

Deno.serve(async (req) => {
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
      .from('allowed_teachers').select('email, role').ilike('email', email).maybeSingle();
    if (!teacher) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
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
        .from('teacher_courses').select('course_id').ilike('email', email);
      allowedCourses = new Set((links ?? []).map((l) => l.course_id));
    }

    // Shu kundagi mavjud yozuvlar — bitta so'rovda hammasi uchun
    const { data: dayRows } = await admin
      .from('attendance').select('id, kind, student_id')
      .in('student_id', students.map((s) => s.id))
      .gte('occurred_at', dayStart).lt('occurred_at', dayEnd);

    const byStudent = new Map<string, { id: string; kind: string }[]>();
    for (const r of dayRows ?? []) {
      const arr = byStudent.get(r.student_id) ?? [];
      arr.push({ id: r.id, kind: r.kind });
      byStudent.set(r.student_id, arr);
    }

    const results: Record<string, unknown>[] = [];
    let notifiedCount = 0;

    // Bot tokeni — faqat bugungi belgilashda va faqat bir marta o'qiymiz
    let token: string | null = null;
    if (isToday) {
      const { data: cfgRow } = await admin.from('app_config').select('value').eq('key', 'bot_token').maybeSingle();
      token = cfgRow?.value ?? null;
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

      const drop = existing.filter((r) => REPLACES[kind].includes(r.kind as Kind)).map((r) => r.id);
      if (drop.length) await admin.from('attendance').delete().in('id', drop);

      const { data: row, error: ierr } = await admin
        .from('attendance')
        .insert({ student_id: student.id, kind, note, marked_by_email: email, occurred_at: occurredAt })
        .select('id, occurred_at, kind, note')
        .single();
      if (ierr) { skip(ierr.message, 'db'); continue; }

      let notified = false;
      if (isToday && token && student.telegram_chat_id) {
        const time = new Intl.DateTimeFormat('uz-UZ', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
        }).format(new Date(row.occurred_at));
        const courseName = (student as any).courses?.name ?? '';
        const who = `<b>${esc(student.full_name)}</b>`;
        const course = courseName ? `\n📚 ${esc(courseName)}` : '';

        const text =
          kind === 'in'      ? `✅ ${who} soat <b>${time}</b> da Parvoz O'quv Markaziga <b>keldi</b>.${course}`
        : kind === 'out'     ? `🏠 ${who} soat <b>${time}</b> da markazdan <b>ketdi</b>.${course}`
        : kind === 'absent'  ? `❗️ ${who} bugungi darsga <b>kelmadi</b>.${course}\n\nAgar sabab bo'lsa, iltimos o'qituvchiga xabar bering.`
        :                      `📝 ${who} bugun <b>sababli</b> qoldi.${note ? `\n💬 ${esc(note)}` : ''}${course}`;

        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: student.telegram_chat_id, text, parse_mode: 'HTML' }),
        });
        notified = !!(await r.json().catch(() => null))?.ok;
        if (notified) notifiedCount++;
      }

      results.push({
        student_id: student.id, name: student.full_name, ok: true,
        id: row.id, kind: row.kind, note: row.note, occurred_at: row.occurred_at,
        removed: drop.length, notified,
      });
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
      notified: notifiedCount, results,
    });

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
