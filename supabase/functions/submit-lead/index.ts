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

// ---- Reklama manbasi (UTM, reklama bosish identifikatorlari) ----
// Sayt (assets/analytics.js) uni brauzerda 90 kun eslab qoladi va arizaga qo'shib yuboradi. Faqat ruxsat etilgan
// kalitlar, qisqartirilgan; qolgani tashlab yuboriladi (ochiq endpoint — ishonib bo'lmaydi).
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid', 'yclid', 'fbclid', 'landing', 'referrer'] as const;
function cleanAttribution(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const k of ATTR_KEYS) {
    const v = clean((raw as Record<string, unknown>)[k], 200);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

const hostOf = (u: string | undefined): string => {
  try { return new URL(u ?? '').hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
// Qaysi kanal keltirdi: reklama bosish identifikatori > UTM > qidiruv/ijtimoiy tarmoqdan o'tish > to'g'ridan-to'g'ri
function channelOf(a: Record<string, string> | null): string {
  if (!a) return 'direct';
  const src = (a.utm_source ?? '').toLowerCase();
  const med = (a.utm_medium ?? '').toLowerCase();
  const paid = /^(cpc|ppc|paid|paidsearch|paid_search|display|cpm)$/.test(med);
  if (a.gclid || a.gbraid || a.wbraid || (src.includes('google') && paid)) return 'google_ads';
  if (a.yclid || (src.includes('yandex') && paid)) return 'yandex_ads';
  if (a.fbclid || /^(facebook|fb|instagram|ig|meta)$/.test(src)) return 'meta';
  if (src) return ('utm_' + src.replace(/[^a-z0-9_-]/g, '').slice(0, 30)) || 'utm';
  const h = hostOf(a.referrer);
  if (!h) return 'direct';
  if (/(^|\.)google\./.test(h)) return 'google_organic';
  if (/(^|\.)yandex\./.test(h) || h === 'ya.ru') return 'yandex_organic';
  if (/(^|\.)bing\.com$/.test(h)) return 'bing_organic';
  if (/(^|\.)duckduckgo\.com$/.test(h)) return 'ddg_organic';
  if (h === 't.me' || /(^|\.)telegram\./.test(h)) return 'telegram';
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
  if (/(^|\.)facebook\.com$/.test(h)) return 'facebook';
  return 'referral';
}
const CHANNEL_LABEL: Record<string, string> = {
  google_ads: 'Google Ads', yandex_ads: 'Yandex Direct', meta: 'Meta (Instagram/Facebook)',
  google_organic: 'Google (qidiruv)', yandex_organic: 'Yandex (qidiruv)', bing_organic: 'Bing (qidiruv)',
  ddg_organic: 'DuckDuckGo (qidiruv)', telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook',
  referral: 'Boshqa sayt',
};

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

    const attribution = cleanAttribution(body.attribution);
    const channel = channelOf(attribution);
    const row = {
      full_name: fullName,
      phone,
      course_id: course?.id ?? null,
      preferred_time: preferredTime,
      note: course ? note : [courseName ? `Yo'nalish: ${courseName}` : null, note].filter(Boolean).join(' · ') || null,
      page,
      source: clean(body.source, 40) || 'website',
    };
    let ins = await admin.from('leads').insert({ ...row, channel, attribution }).select('id, created_at').single();
    // channel/attribution ustunlari bo'lmasa (migratsiya hali qo'llanmagan) — arizani baribir saqlaymiz
    if (ins.error && (ins.error.code === '42703' || ins.error.code === 'PGRST204')) {
      ins = await admin.from('leads').insert(row).select('id, created_at').single();
    }
    const { data: lead, error } = ins;
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
        (channel !== 'direct'
          ? `📣 ${esc(CHANNEL_LABEL[channel] ?? channel.replace(/^utm_/, ''))}` +
            (attribution?.utm_campaign ? ` · ${esc(attribution.utm_campaign)}` : '') +
            (attribution?.utm_term ? ` · 🔎 ${esc(attribution.utm_term)}` : '') + '\n'
          : '') +
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
