// Telegram webhook — Telegram bu funksiyani har bir xabarda chaqiradi.
// verify_jwt: false, himoya X-Telegram-Bot-Api-Secret-Token sarlavhasi orqali.
//
// Ota-ona ulanishi ikki bosqichli:
//   1) /start <kod>  -> bot raqamni so'raydi (request_contact tugmasi)
//   2) contact       -> Telegram tasdiqlagan raqam bazadagi ota-ona raqami
//                       bilan solishtiriladi. Mos kelsa — ulanadi.
// Shu sababli havola boshqa odamning qo'liga tushsa ham u hech narsa ko'rmaydi.
//
// Ikki ota-ona (ona va ota): o'quvchida ikkita ota-ona raqami bo'lishi mumkin (parent_phone, parent_phone2) va har bir
// ota-ona o'z Telegramidan ulanadi — ikkalasi ham xabar oladi. Ulanishlar parent_chats jadvalida (o'quvchi + chat);
// students.telegram_chat_id / linked_phone / linked_at — birinchi ulangan ota-onaning nusxasi (trigger yuritadi).
//
// Oila (bitta ota-onada 2-3 farzand): har bir farzandning o'z havolasi bor, lekin raqam bir marta tasdiqlanadi.
//   - Raqam tasdiqlangach, shu raqamga ro'yxatdan o'tgan boshqa farzandlar taklif qilinadi — "Ha" bosilsa hammasi ulanadi.
//   - Shu chat raqamni allaqachon tasdiqlagan bo'lsa, boshqa farzandning havolasini ochish uni darhol ulaydi
//     (raqam qayta so'ralmaydi): tasdiqlangan raqam == o'sha farzandga yozilgan ota-ona raqami, havola esa faqat xodimda.
//   - Ma'lumot faqat shu raqamni Telegram orqali tasdiqlagan chatga ko'rsatiladi.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// Ism va kurs nomini o'qituvchi yozadi — parse_mode HTML da xom qo'yilsa, "<" yoki "&"
// belgisi xabarni butunlay buzadi (Telegram "can't parse entities" deb rad etadi)
const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

// Qo'lda yozilgan telefon raqami: "998901234567", "90 123 45 67", "+998 90 123 45 67".
// Yozilgan raqamni tekshirib bo'lmaydi — faqat Telegram o'zi tasdiqlagan kontakt (tugma) qabul qilinadi.
const PHONE_LIKE = /^\+?[\d\s\-()]{7,20}$/;

// Raqamni tasdiqlash kutilmoqdami (havola ochilgan, 15 daqiqa o'tmagan)
async function waitingForContact(chatId: number | string): Promise<boolean> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MIN * 60_000).toISOString();
  const { data } = await admin.from('students').select('id')
    .eq('pending_chat_id', chatId).gte('pending_at', cutoff).limit(1).maybeSingle();
  return !!data;
}
const ASK_AGAIN = `📱 Raqamni yozib yuborish shart emas — yozilgan raqam tekshirilmaydi.\n\n` +
  `Pastdagi <b>«📱 Raqamimni tasdiqlash»</b> tugmasini bosing.`;

// ---- Oila ----
const YES_ALL = '✅ Ha, hammasini ulash';
const NO_FAMILY = "Yo'q, hozir emas";
const FAMILY_KB = { keyboard: [[{ text: YES_ALL }], [{ text: NO_FAMILY }]], resize_keyboard: true, one_time_keyboard: true };

// O'quvchiga yozilgan ota-ona raqamlari (birinchi va ikkinchi ota-ona), 998901234567 ko'rinishida
const regPhones = (s: any): string[] => [...new Set([normPhone(s.parent_phone), normPhone(s.parent_phone2)].filter(Boolean) as string[])];

// Telegram o'zi tasdiqlagan raqamlar: shu chat ulangan har bir o'quvchi uchun tasdiqlangan raqam
async function verifiedPhones(chatId: number | string): Promise<Set<string>> {
  const { data } = await admin.from('parent_chats').select('phone').eq('chat_id', chatId);
  return new Set((data ?? []).map((r: any) => normPhone(r.phone)).filter(Boolean) as string[]);
}
async function namesOn(chatId: number | string): Promise<string[]> {
  const { data } = await admin.from('parent_chats').select('students(full_name)').eq('chat_id', chatId);
  return (data ?? []).map((r: any) => String(r.students?.full_name ?? '')).filter(Boolean);
}
// Shu raqamlardan biriga ro'yxatdan o'tgan, hali SHU chatga ulanmagan faol o'quvchilar (boshqa ota-onaga ulangan bo'lsa ham:
// ona va ota ikkalasi ham olishi kerak)
async function pendingFamily(phones: Set<string>, chatId: number | string, exceptId?: string): Promise<any[]> {
  if (!phones.size) return [];
  const { data } = await admin.from('students')
    .select('id, full_name, parent_phone, parent_phone2, courses(name), parent_chats(chat_id)')
    .eq('active', true).limit(2000);
  return (data ?? [])
    .filter((s: any) => s.id !== exceptId && !(s.parent_chats ?? []).some((c: any) => c.chat_id === chatId) && regPhones(s).some((p) => phones.has(p)))
    .map((s: any) => ({ ...s, phone: regPhones(s).find((p) => phones.has(p)) }));
}
async function linkTo(studentId: string, chatId: number | string, phone: string) {
  await admin.from('parent_chats').upsert(
    { student_id: studentId, chat_id: chatId, phone, linked_at: new Date().toISOString() },
    { onConflict: 'student_id,chat_id', ignoreDuplicates: true },
  );
  // Havola yopiladi; students.telegram_chat_id ni trigger parent_chats dan yangilaydi
  await admin.from('students').update({
    link_code: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    link_expires_at: null,
    link_attempts: 0,
    pending_chat_id: null,
    pending_at: null,
  }).eq('id', studentId);
}
const listOf = (rows: any[]) => rows.slice(0, 8).map((s) => `• ${esc(s.full_name)}${s.courses?.name ? ` (${esc(s.courses.name)})` : ''}`).join('\n')
  + (rows.length > 8 ? `\n… +${rows.length - 8}` : '');
const offerText = (rows: any[]) =>
  `\n\n👨‍👩‍👧 Shu raqamga yana farzandlar ro'yxatdan o'tgan:\n${listOf(rows)}\n\nUlarning xabarlari ham shu yerga kelsinmi?`;

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

  const greet = () => say(
    `👋 Assalomu alaykum! Bu — <b>Parvoz O'quv Markazi</b> davomat boti.\n\n` +
    `Farzandingizga ulanish uchun o'qituvchi bergan maxsus havolani bosing.\n\n` +
    `Havola faqat markazga qoldirilgan telefon raqamingiz bilan ochiladi.`,
    { reply_markup: HIDE_KEYBOARD }
  );

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

    /* ---------- Oila: "hammasini ulash" ---------- */
    // Xavfsiz: faqat shu chat Telegram orqali tasdiqlagan raqamga yozilgan o'quvchilar ulanadi — boshqa hech narsa ochilmaydi
    if (text === YES_ALL) {
      const phones = await verifiedPhones(chatId);
      if (!phones.size) {
        await say(`ℹ️ Avval farzandingizning havolasini oching va raqamingizni tasdiqlang.`, { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }
      const sibs = await pendingFamily(phones, chatId);
      if (!sibs.length) {
        await say(`ℹ️ Ulanadigan boshqa farzand topilmadi.\n\nHozir ulangan: ${esc((await namesOn(chatId)).join(', '))}`, { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }
      for (const sb of sibs) await linkTo(sb.id, chatId, sb.phone);
      await say(`✅ Ulandi:\n${listOf(sibs)}\n\nEndi ${esc((await namesOn(chatId)).join(', '))} haqidagi xabarlar shu yerga keladi.\n\nXabarlarni to'xtatish uchun /stop yuboring.`,
        { reply_markup: HIDE_KEYBOARD });
      return new Response('ok');
    }
    if (text === NO_FAMILY) {
      await say(`Xo'p. Qolgan farzandlar uchun o'qituvchidan havola oling — uni ochsangiz, raqam qayta so'ralmasdan ulanadi.`,
        { reply_markup: HIDE_KEYBOARD });
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
        .select('id, full_name, parent_phone, parent_phone2, link_attempts, courses(name)')
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

      const wantAll = regPhones(pend);
      const gave = normPhone(contact.phone_number);

      if (!gave || !wantAll.includes(gave)) {
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
      await linkTo(pend.id, chatId, gave);

      const courseName = (pend as any).courses?.name ?? '';
      const sibs = await pendingFamily(new Set([gave]), chatId, pend.id);
      await say(
        `✅ <b>${esc(pend.full_name)}</b> uchun davomat xabarlari ulandi!` +
        (courseName ? `\n📚 ${esc(courseName)}` : '') +
        `\n\nEndi farzandingiz markazga kelganda va ketganda, shuningdek to'lov haqidagi xabarlar shu yerga keladi.\n\nXabarlarni to'xtatish uchun /stop yuboring.` +
        (sibs.length ? offerText(sibs) : ''),
        { reply_markup: sibs.length ? FAMILY_KB : HIDE_KEYBOARD }
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
        .select('id, full_name, parent_phone, parent_phone2, link_expires_at, active, courses(name)')
        .eq('link_code', code)
        .maybeSingle();

      const valid = student && student.active
        && student.link_expires_at && Date.parse(student.link_expires_at) > Date.now();

      if (!valid) {
        // Ota-ona havola o'rniga raqamni yozib yuborgan bo'lishi mumkin ("998901234567" — 12 belgi, kodga o'xshaydi):
        // tugmani yashirmaymiz va havola "eskirgan" demaymiz
        if (!startMatch) {
          if (await waitingForContact(chatId)) { await say(ASK_AGAIN, { reply_markup: ASK_CONTACT }); return new Response('ok'); }
          if (PHONE_LIKE.test(text)) { await greet(); return new Response('ok'); }
        }
        await say(`❌ Havola eskirgan yoki noto'g'ri.\n\nO'qituvchidan yangi havola so'rang — har bir havola <b>48 soat</b> amal qiladi.`,
          { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }

      if (!regPhones(student).length) {
        await say(`⚠️ Bu o'quvchi uchun ota-ona raqami kiritilmagan.\n\nO'qituvchiga murojaat qiling.`,
          { reply_markup: HIDE_KEYBOARD });
        return new Response('ok');
      }

      // Bu chat shu raqamni allaqachon tasdiqlagan (boshqa farzand orqali): raqam qayta so'ralmaydi — farzand darhol ulanadi.
      // Xavfsizlik oldingisi bilan teng: tasdiqlangan raqam == shu farzandga yozilgan ota-ona raqami, havola esa faqat xodimda.
      const phones = await verifiedPhones(chatId);
      const want = regPhones(student).find((p) => phones.has(p));
      if (want) {
        await admin.from('students').update({ pending_chat_id: null, pending_at: null }).eq('pending_chat_id', chatId);
        await linkTo(student!.id, chatId, want);
        const sibs = await pendingFamily(phones, chatId, student!.id);
        const course = (student as any).courses?.name;
        await say(
          `✅ <b>${esc(student!.full_name)}</b> ham ulandi!` + (course ? `\n📚 ${esc(course)}` : '') +
          `\n\nRaqamingiz allaqachon tasdiqlangan, shuning uchun qayta so'ralmadi. Endi ${esc((await namesOn(chatId)).join(', '))} haqidagi xabarlar shu yerga keladi.` +
          (sibs.length ? offerText(sibs) : ''),
          { reply_markup: sibs.length ? FAMILY_KB : HIDE_KEYBOARD }
        );
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
        `👋 <b>${esc(student!.full_name)}</b> ning davomat xabarlariga ulanmoqchisiz.\n\n` +
        `Xavfsizlik uchun raqamingizni tasdiqlang — u markazga qoldirilgan raqam bilan solishtiriladi.\n\n` +
        `Pastdagi <b>«📱 Raqamimni tasdiqlash»</b> tugmasini bosing.`,
        { reply_markup: ASK_CONTACT }
      );
      return new Response('ok');
    }

    if (/^\/stop/i.test(text)) {
      const names = await namesOn(chatId);
      await admin.from('parent_chats').delete().eq('chat_id', chatId);     // boshqa ota-onaning ulanishi qoladi
      // Jadvalda yozuvi bo'lmagan eski ulanish qoldig'i bo'lsa — tozalaymiz (trigger ularni allaqachon yangilagan)
      await admin.from('students')
        .update({ telegram_chat_id: null, linked_at: null, linked_phone: null })
        .eq('telegram_chat_id', chatId);
      await admin.from('students').update({ pending_chat_id: null, pending_at: null }).eq('pending_chat_id', chatId);
      await say(`🔕 Xabarlar o'chirildi${names.length ? ` (${esc(names.join(', '))})` : ''}. Qayta ulash uchun o'qituvchidan havola oling.`,
        { reply_markup: HIDE_KEYBOARD });
      return new Response('ok');
    }

    // Raqamni tasdiqlash kutilayotganda boshqa har qanday matn ("+998 90 ...", "salom"): tugma yashirilmasin
    if (await waitingForContact(chatId)) {
      await say(ASK_AGAIN, { reply_markup: ASK_CONTACT });
      return new Response('ok');
    }

    // Ulangan ota-ona to'lov eslatmasiga javob yozsa ("to'ladim") — bot javob o'qimasligini aytamiz,
    // aks holda unga "havolani bosing" deb qayta ulanish taklif qilinardi
    const mine = await namesOn(chatId);
    if (mine.length) {
      await say(
        `ℹ️ Bu bot faqat xabar yuboradi, javoblarni o'qimaydi.\n\n` +
        `Hozir ulangan: ${esc(mine.join(', '))}\n\n` +
        `Savol yoki to'lov bo'yicha o'qituvchiga yoki markaz ma'muriyatiga murojaat qiling.`,
        { reply_markup: HIDE_KEYBOARD }
      );
      return new Response('ok');
    }

    await greet();
  } catch (_e) {
    // Telegram qayta yubormasligi uchun baribir 200
  }

  return new Response('ok');
});
