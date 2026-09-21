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

// Samarqand bo'yicha bugungi kun boshlanishi (UTC+5, yoz vaqti yo'q)
function dayStartIso(): string {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return new Date(`${key}T00:00:00+05:00`).toISOString();
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
    const studentId = String(body.student_id ?? '');
    const kind = String(body.kind ?? '') as Kind;
    const note = String(body.note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) || null;
    if (!studentId || !KINDS.includes(kind)) return json({ error: 'bad request' }, 400);

    const { data: student } = await admin
      .from('students')
      .select('id, full_name, telegram_chat_id, course_id, courses(name)')
      .eq('id', studentId)
      .maybeSingle();
    if (!student) return json({ error: 'student not found' }, 404);

    // Fan bo'yicha cheklov: admin hammasiga, o'qituvchi faqat o'z kursiga
    if (teacher.role !== 'admin') {
      const { data: link } = await admin
        .from('teacher_courses')
        .select('course_id')
        .ilike('email', email)
        .eq('course_id', student.course_id)
        .maybeSingle();
      if (!link) return json({ error: "Bu kurs sizga biriktirilmagan" }, 403);
    }

    // Bugungi yozuvlar
    const dayStart = dayStartIso();
    const { data: todays } = await admin
      .from('attendance').select('id, kind')
      .eq('student_id', studentId).gte('occurred_at', dayStart);
    const existing = todays ?? [];

    if (existing.some((r) => r.kind === kind)) {
      return json({ error: 'Bu holat bugun allaqachon belgilangan' }, 409);
    }
    if (kind === 'out' && !existing.some((r) => r.kind === 'in')) {
      return json({ error: "Avval \"Keldi\" belgilanishi kerak" }, 409);
    }

    // Ziddiyatli yozuvlarni olib tashlaymiz
    const drop = existing.filter((r) => REPLACES[kind].includes(r.kind as Kind)).map((r) => r.id);
    if (drop.length) await admin.from('attendance').delete().in('id', drop);

    const { data: row, error: ierr } = await admin
      .from('attendance')
      .insert({ student_id: studentId, kind, note, marked_by_email: email })
      .select('id, occurred_at, kind, note')
      .single();
    if (ierr) return json({ error: ierr.message }, 500);

    let notified = false;
    if (student.telegram_chat_id) {
      const { data: cfgRow } = await admin.from('app_config').select('value').eq('key', 'bot_token').maybeSingle();
      const token = cfgRow?.value;
      if (token) {
        const time = new Intl.DateTimeFormat('uz-UZ', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
        }).format(new Date(row.occurred_at));
        const courseName = (student as any).courses?.name ?? '';
        const who = `<b>${esc(student.full_name)}</b>`;
        const course = courseName ? `\n📚 ${esc(courseName)}` : '';

        const text =
          kind === 'in'      ? `✅ ${who} soat <b>${time}</b> da Parvoz O'quv Markaziga <b>keldi</b>.${course}`
        : kind === 'out'     ? `🏠 ${who} soat <b>${time}</b> da markazdan <b>ketdi</b>.`
        : kind === 'absent'  ? `❗️ ${who} bugungi darsga <b>kelmadi</b>.${course}\n\nAgar sabab bo'lsa, iltimos o'qituvchiga xabar bering.`
        :                      `📝 ${who} bugun <b>sababli</b> qoldi.${note ? `\n💬 ${esc(note)}` : ''}${course}`;

        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: student.telegram_chat_id, text, parse_mode: 'HTML' }),
        });
        notified = !!(await r.json().catch(() => null))?.ok;
      }
    }

    return json({
      ok: true, id: row.id, kind: row.kind, note: row.note,
      occurred_at: row.occurred_at, removed: drop.length, notified,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
