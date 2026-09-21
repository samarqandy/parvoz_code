// Telegram webhook — Telegram bu funksiyani har bir xabarda chaqiradi.
// verify_jwt: false, himoya X-Telegram-Bot-Api-Secret-Token sarlavhasi orqali.
//
// Ota-ona ulanishi ikki bosqichli:
//   1) /start <kod>  -> bot raqamni so'raydi (request_contact tugmasi)
//   2) contact       -> Telegram tasdiqlagan raqam bazadagi ota-ona raqami
//                       bilan solishtiriladi. Mos kelsa — ulanadi.
// Shu sababli havola boshqa odamning qo'liga tushsa ham u hech narsa ko'rmaydi.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const PENDING_TTL_MIN = 15;   // raqamni tasdiqlashga beriladigan vaqt
const MAX_ATTEMPTS = 3;       // noto'g'ri raqam bilan urinishlar chegarasi

async function getCfg(key: string): Promise<string | null> {
  const { data } = await admin.from('app_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

async function tg(token: string, method: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (_e) {
    return { ok: false };
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// "+998 97 234 44 42" -> "998972344442"; "972344442" -> "998972344442"
function normPhone(raw: string | null | undefined): string | null {
  const d = String(raw ?? '').replace(/\D+/g, '');
  if (!d) return null;
  if (d.length === 9) return '998' + d;
  if (d.length === 12 && d.startsWith('998')) return d;
  if (d.length === 13 && d.startsWith('9998')) return d.slice(1);
  return d.length >= 9 ? d : null;
}

const ASK_CONTACT = {
  keyboard: [[{ text: "📱 Raqamimni tasdiqlash", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};
const HIDE_KEYBOARD = { remove_keyboard: true };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');

  const secret = await getCfg('tg_webhook_secret');
  const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!secret || !timingSafeEqual(got, secret)) {
    return new Response('forbidden', { status: 403 });
  }

  let update: Record<string, any>;
  try { update = await req.json(); } catch { return new Response('ok'); }

  const msg = update?.message;
  const chatId = msg?.chat?.id;
  if (!chatId) return new Response('ok');

  const token = await getCfg('bot_token');
  if (!token) return new Response('ok');

  const text = String(msg.text ?? '').trim();
  const say = (t: string, extra: Record<string, unknown> = {}) =>
    tg(token, 'sendMessage', { chat_id: chatId, parse_mode: 'HTML', text: t, ...extra });

  try {
    /* ---------- Xodim: ariza xabarnomalariga ulanish ---------- */
    const adminMatch = text.match(/^\/start[ _]+admin[_-]([a-f0-9]{12,})/i);
    if (adminMatch) {
      const code = await getCfg('admin_link_code');
      const expires = await getCfg('admin_link_expires');
      const fresh = expires ? Date.parse(expires) > Date.now() : false;
      if (code && fresh && timingSafeEqual(adminMatch[1].toLowerCase(), code)) {
        const label = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ')
          || msg.from?.username || null;
        await admin.from('notify_chats').upsert({ chat_id: chatId, label });
        await say(`✅ Ulandi! Endi saytdan kelgan <b>yangi arizalar</b> shu yerga yuboriladi.\n\nO'chirish uchun /stopadmin yuboring.`);
      } else {
        await say(`❌ Havola eskirgan. Paneldan yangi havola oling.`);
      }
      return new Response('ok');
    }

    if (/^\/stopadmin/i.test(text)) {
      await admin.from('notify_chats').delete().eq('chat_id', chatId);
      await say(`🔕 Ariza xabarnomalari o'chirildi.`);
      return new Response('ok');
    }

    /* ---------- 2-bosqich: raqamni tasdiqlash ---------- */
    const contact = msg.contact;
    if (contact) {
      // O'zganing kontaktini yuborib bo'lmaydi: Telegram user_id ni o'zi qo'yadi
      if (!contact.user_id || contact.user_id !== msg.from?.id) {
        await say(`❌ Iltimos, pastdagi <b>«📱 Raqamimni tasdiqlash»</b> tugmasi orqali <u>o'z</u> raqamingizni yuboring.`,
          { reply_markup: ASK_CONTACT });
        return new Response('ok');
      }

      const cutoff = new Date(Date.now() - PENDING_TTL_MIN * 60_000).toISOString();
      const { data: pend } = await admin
        .from('students')
        .select('id, full_name, parent_phone, link_attempts, courses(name)')
        .eq('pending_chat_id', chatId)
        .gte('pending_at', cutoff)
        .order('pending_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pend) {
        await say(`⌛️ Vaqt tugadi yoki havola ochilmagan.\n\nO'qituvchidan yangi havola oling va uni qaytadan bosing.`,
          { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }

      const want = normPhone(pend.parent_phone);
      const gave = normPhone(contact.phone_number);

      if (!want || !gave || want !== gave) {
        const tries = (pend.link_attempts ?? 0) + 1;
        if (tries >= MAX_ATTEMPTS) {
          await admin.from('students').update({
            link_attempts: tries, link_expires_at: null, pending_chat_id: null, pending_at: null,
          }).eq('id', pend.id);
          await say(`🚫 Havola bekor qilindi — raqam bir necha marta mos kelmadi.\n\nO'qituvchiga murojaat qiling.`,
            { reply_markup: HIDE_KEYBOARD });
        } else {
          await admin.from('students').update({ link_attempts: tries }).eq('id', pend.id);
          await say(`❌ Bu raqam ro'yxatda yo'q.\n\nDavomat xabarlari faqat markazga qoldirilgan raqamga ulanadi. Raqamingiz o'zgargan bo'lsa — o'qituvchiga ayting.`,
            { reply_markup: ASK_CONTACT });
        }
        return new Response('ok');
      }

      // ✅ Mos keldi — ulaymiz va havolani yopamiz
      await admin.from('students').update({
        telegram_chat_id: chatId,
        linked_at: new Date().toISOString(),
        linked_phone: gave,
        link_code: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        link_expires_at: null,
        link_attempts: 0,
        pending_chat_id: null,
        pending_at: null,
      }).eq('id', pend.id);

      const courseName = (pend as any).courses?.name ?? '';
      await say(
        `✅ <b>${pend.full_name}</b> uchun davomat xabarlari ulandi!` +
        (courseName ? `\n📚 ${courseName}` : '') +
        `\n\nEndi farzandingiz markazga kelganda va ketganda shu yerga xabar keladi.\n\nXabarlarni to'xtatish uchun /stop yuboring.`,
        { reply_markup: HIDE_KEYBOARD }
      );
      return new Response('ok');
    }

    /* ---------- 1-bosqich: havola yoki kod ---------- */
    const startMatch = text.match(/^\/start[ _]+(\S+)/i);
    const code = startMatch
      ? startMatch[1].toLowerCase()
      : (/^[a-f0-9]{8,12}$/i.test(text) ? text.toLowerCase() : null);

    if (code) {
      const { data: student } = await admin
        .from('students')
        .select('id, full_name, parent_phone, link_expires_at, active')
        .eq('link_code', code)
        .maybeSingle();

      const valid = student && student.active
        && student.link_expires_at && Date.parse(student.link_expires_at) > Date.now();

      if (!valid) {
        await say(`❌ Havola eskirgan yoki noto'g'ri.\n\nO'qituvchidan yangi havola so'rang — har bir havola <b>48 soat</b> amal qiladi.`,
          { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }

      if (!normPhone(student!.parent_phone)) {
        await say(`⚠️ Bu o'quvchi uchun ota-ona raqami kiritilmagan.\n\nO'qituvchiga murojaat qiling.`,
          { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }

      // Bitta chat bir vaqtda bitta o'quvchini ulaydi
      await admin.from('students')
        .update({ pending_chat_id: null, pending_at: null })
        .eq('pending_chat_id', chatId);
      await admin.from('students')
        .update({ pending_chat_id: chatId, pending_at: new Date().toISOString() })
        .eq('id', student!.id);

      await say(
        `👋 <b>${student!.full_name}</b> ning davomat xabarlariga ulanmoqchisiz.\n\n` +
        `Xavfsizlik uchun raqamingizni tasdiqlang — u markazga qoldirilgan raqam bilan solishtiriladi.\n\n` +
        `Pastdagi <b>«📱 Raqamimni tasdiqlash»</b> tugmasini bosing.`,
        { reply_markup: ASK_CONTACT }
      );
      return new Response('ok');
    }

    if (/^\/stop/i.test(text)) {
      await admin.from('students')
        .update({ telegram_chat_id: null, linked_at: null, linked_phone: null })
        .eq('telegram_chat_id', chatId);
      await say(`🔕 Xabarlar o'chirildi. Qayta ulash uchun o'qituvchidan havola oling.`,
        { reply_markup: HIDE_KEYBOARD });
      return new Response('ok');
    }

    await say(
      `👋 Assalomu alaykum! Bu — <b>Parvoz O'quv Markazi</b> davomat boti.\n\n` +
      `Farzandingizga ulanish uchun o'qituvchi bergan maxsus havolani bosing.\n\n` +
      `Havola faqat markazga qoldirilgan telefon raqamingiz bilan ochiladi.`,
      { reply_markup: HIDE_KEYBOARD }
    );
  } catch (_e) {
    // Telegram qayta yubormasligi uchun baribir 200
  }

  return new Response('ok');
});
