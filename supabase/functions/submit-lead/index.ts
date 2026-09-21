// Saytdagi ariza formasi — ochiq endpoint (verify_jwt: false).
// Himoya: kiritmalarni tekshirish, honeypot, takroriy va ommaviy yuborishdan cheklov.
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

function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  // Honeypot: odam ko'rmaydigan maydon to'ldirilgan bo'lsa — bot
  if (clean(body.website, 50)) return json({ ok: true });

  const fullName = clean(body.full_name, 120);
  const phoneRaw = clean(body.phone, 30);
  const phone = phoneRaw.replace(/[^\d+]/g, '');
  const note = clean(body.note, 500) || null;
  const preferredTime = clean(body.preferred_time, 60) || null;
  const page = clean(body.page, 200) || null;
  const courseId = clean(body.course_id, 40) || null;
  const courseName = clean(body.course_name, 80) || null;

  if (fullName.length < 2) return json({ error: "Ismni to'liq kiriting" }, 400);
  if (phone.replace(/\D/g, '').length < 9) return json({ error: "Telefon raqamini to'g'ri kiriting" }, 400);

  try {
    // Takroriy yuborish: shu raqamdan oxirgi 5 daqiqada ariza bo'lsa — qayta yozmaymiz
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: dup } = await admin
      .from('leads').select('id').eq('phone', phone).gte('created_at', fiveMinAgo).maybeSingle();
    if (dup) return json({ ok: true, duplicate: true });

    // Ommaviy spamdan himoya
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await admin
      .from('leads').select('*', { count: 'exact', head: true }).gte('created_at', hourAgo);
    if ((count ?? 0) > 40) return json({ error: "Keyinroq urinib ko'ring" }, 429);

    // Kursni id yoki nom bo'yicha aniqlaymiz
    let course: { id: string; name: string } | null = null;
    if (courseId) {
      const { data } = await admin.from('courses').select('id, name').eq('id', courseId).maybeSingle();
      course = data ?? null;
    }
    if (!course && courseName) {
      const { data } = await admin.from('courses').select('id, name').ilike('name', courseName).maybeSingle();
      course = data ?? null;
    }

    const { data: lead, error } = await admin.from('leads').insert({
      full_name: fullName,
      phone,
      course_id: course?.id ?? null,
      preferred_time: preferredTime,
      note: course ? note : [courseName ? `Yo'nalish: ${courseName}` : null, note].filter(Boolean).join(' · ') || null,
      page,
      source: clean(body.source, 40) || 'website',
    }).select('id, created_at').single();
    if (error) return json({ error: error.message }, 500);

    // Telegram orqali xabar berish
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'bot_token').maybeSingle();
    const token = cfg?.value;
    if (token) {
      const { data: chats } = await admin.from('notify_chats').select('chat_id');
      const time = new Intl.DateTimeFormat('uz-UZ', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Samarkand',
      }).format(new Date(lead.created_at));
      const text =
        `🔔 <b>Yangi ariza</b> · ${time}\n\n` +
        `👤 <b>${esc(fullName)}</b>\n` +
        `📞 <a href="tel:${esc(phone)}">${esc(phone)}</a>\n` +
        (course ? `📚 ${esc(course.name)}\n` : (courseName ? `📚 ${esc(courseName)}\n` : '')) +
        (preferredTime ? `⏰ ${esc(preferredTime)}\n` : '') +
        (note ? `💬 ${esc(note)}\n` : '') +
        `\n<i>Tezroq qo'ng'iroq qiling — birinchi daqiqalar hal qiluvchi.</i>`;

      await Promise.all((chats ?? []).map((c) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        }).catch(() => null)
      ));
    }

    return json({ ok: true, id: lead.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
