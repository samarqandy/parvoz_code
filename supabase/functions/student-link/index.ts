// student-link — o'qituvchi uchun ota-ona havolasini yaratadi.
// Havola: muddatli (48 soat), bir martalik va faqat o'quvchining ro'yxatdagi
// ota-ona raqami egasi Telegramda tasdiqlay oladi (telegram-webhook tekshiradi).
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

const LINK_TTL_HOURS = 48;

function newCode(): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// "+998 97 234 44 42" -> "998972344442"; "972344442" -> "998972344442"
function normPhone(raw: string | null | undefined): string | null {
  const d = String(raw ?? '').replace(/\D+/g, '');
  if (!d) return null;
  if (d.length === 9) return '998' + d;
  if (d.length === 12 && d.startsWith('998')) return d;
  if (d.length === 13 && d.startsWith('9998')) return d.slice(1); // "+9 998..." kabi xatolar
  return d.length >= 9 ? d : null;
}

// Oxirgi 4 raqamdan boshqasini yashiramiz: +998 ** *** ** 42
function maskPhone(norm: string): string {
  const tail = norm.slice(-4);
  return `+${norm.slice(0, 3)} ** *** ${tail.slice(0, 2)} ${tail.slice(2)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);
    const { data: u, error: uerr } = await admin.auth.getUser(jwt);
    const email = u?.user?.email?.toLowerCase();
    if (uerr || !email) return json({ error: 'unauthorized' }, 401);

    const { data: teacher } = await admin
      .from('allowed_teachers').select('email, role').ilike('email', email).maybeSingle();
    if (!teacher) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const studentId = String(body.student_id ?? '');
    const action = String(body.action ?? 'create');
    if (!studentId) return json({ error: 'bad request' }, 400);

    const { data: student } = await admin
      .from('students')
      .select('id, full_name, course_id, parent_phone, telegram_chat_id')
      .eq('id', studentId)
      .maybeSingle();
    if (!student) return json({ error: 'student not found' }, 404);

    // Fan bo'yicha cheklov: admin hammasiga, o'qituvchi faqat o'z kursiga
    if (teacher.role !== 'admin') {
      const { data: link } = await admin
        .from('teacher_courses').select('course_id')
        .ilike('email', email).eq('course_id', student.course_id).maybeSingle();
      if (!link) return json({ error: 'Bu kurs sizga biriktirilmagan' }, 403);
    }

    // Ulanishni uzish
    if (action === 'unlink') {
      await admin.from('students').update({
        telegram_chat_id: null, linked_at: null, linked_phone: null,
        link_expires_at: null, link_attempts: 0, pending_chat_id: null, pending_at: null,
      }).eq('id', student.id);
      return json({ ok: true, unlinked: true });
    }

    const phone = normPhone(student.parent_phone);
    if (!phone) {
      return json({
        error: "Avval ota-onaning telefon raqamini kiriting — havola faqat o'sha raqam egasiga ochiladi.",
        code: 'no_phone',
      }, 400);
    }

    const { data: cfg } = await admin
      .from('app_config').select('value').eq('key', 'bot_username').maybeSingle();
    const botUsername = cfg?.value;
    if (!botUsername) return json({ error: 'Bot ulanmagan' }, 400);

    const code = newCode();
    const expiresAt = new Date(Date.now() + LINK_TTL_HOURS * 3600_000).toISOString();

    // Eski havola bilan boshlangan yarim ulanish ham bekor bo'ladi
    const { error: uerr2 } = await admin.from('students').update({
      link_code: code, link_expires_at: expiresAt, link_attempts: 0,
      pending_chat_id: null, pending_at: null,
    }).eq('id', student.id);
    if (uerr2) return json({ error: uerr2.message }, 500);

    return json({
      ok: true,
      url: `https://t.me/${botUsername}?start=${code}`,
      expires_at: expiresAt,
      ttl_hours: LINK_TTL_HOURS,
      phone_hint: maskPhone(phone),
      student_name: student.full_name,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
