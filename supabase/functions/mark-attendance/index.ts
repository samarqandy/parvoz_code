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
    const kind = String(body.kind ?? '');
    if (!studentId || !['in', 'out'].includes(kind)) return json({ error: 'bad request' }, 400);

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

    const { data: row, error: ierr } = await admin
      .from('attendance')
      .insert({ student_id: studentId, kind, marked_by_email: email })
      .select('id, occurred_at')
      .single();
    if (ierr) return json({ error: ierr.message }, 500);

    let notified = false;
    if (student.telegram_chat_id) {
      const { data: cfgRow } = await admin.from('app_config').select('value').eq('key', 'bot_token').maybeSingle();
      const token = cfgRow?.value;
      if (token) {
        const time = new Intl.DateTimeFormat('uz-UZ', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Samarkand',
        }).format(new Date(row.occurred_at));
        const courseName = (student as any).courses?.name ?? '';
        const text = kind === 'in'
          ? `✅ <b>${student.full_name}</b> soat <b>${time}</b> da Parvoz O'quv Markaziga <b>keldi</b>.` + (courseName ? `\n📚 ${courseName}` : '')
          : `🏠 <b>${student.full_name}</b> soat <b>${time}</b> da markazdan <b>ketdi</b>.`;
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: student.telegram_chat_id, text, parse_mode: 'HTML' }),
        });
        notified = !!(await r.json().catch(() => null))?.ok;
      }
    }

    return json({ ok: true, id: row.id, occurred_at: row.occurred_at, notified });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
