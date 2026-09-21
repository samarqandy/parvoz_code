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

async function tg(token: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return await res.json();
}

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

type Actor = { email: string; role: string; full_name: string | null };

async function currentActor(req: Request): Promise<Actor | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  const email = data?.user?.email;
  if (error || !email) return null;
  const { data: t } = await admin.from('allowed_teachers')
    .select('email, role, full_name').ilike('email', email).maybeSingle();
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
      const { data: tc } = await admin.from('teacher_courses').select('course_id').ilike('email', actor.email);
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
      const { data: existing } = await admin.from('allowed_teachers').select('email').eq('email', email).maybeSingle();
      if (!existing) {
        if (password.length < 8) return json({ error: "Yangi hisob uchun kamida 8 belgili parol kerak" }, 400);
        const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error && !/already|exists|registered/i.test(error.message)) return json({ error: error.message }, 400);
      } else if (password) {
        if (password.length < 8) return json({ error: "Parol kamida 8 belgi bo'lishi kerak" }, 400);
        const { data: list } = await admin.auth.admin.listUsers();
        const u = list?.users?.find((x) => (x.email ?? '').toLowerCase() === email);
        if (u) await admin.auth.admin.updateUserById(u.id, { password });
      }
      const { error: uerr } = await admin.from('allowed_teachers').upsert({ email, full_name: fullName, role, added_by: actor.email });
      if (uerr) return json({ error: uerr.message }, 500);
      await admin.from('teacher_courses').delete().eq('email', email);
      if (role !== 'admin' && courseIds.length) {
        await admin.from('teacher_courses').insert(courseIds.map((cid) => ({ email, course_id: cid })));
      }
      return json({ ok: true });
    }

    if (action === 'remove_teacher') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!email) return json({ error: 'Email kerak' }, 400);
      if (email === actor.email.toLowerCase()) return json({ error: "O'zingizni o'chira olmaysiz" }, 400);
      await admin.from('teacher_courses').delete().eq('email', email);
      await admin.from('allowed_teachers').delete().eq('email', email);
      const { data: list } = await admin.auth.admin.listUsers();
      const u = list?.users?.find((x) => (x.email ?? '').toLowerCase() === email);
      if (u) await admin.auth.admin.deleteUser(u.id);
      return json({ ok: true });
    }

    if (action === 'save_course') {
      const id = body.id ? String(body.id) : null;
      const row: Record<string, unknown> = {
        name: String(body.name ?? '').trim(),
        icon: String(body.icon ?? '📘').trim() || '📘',
        color: String(body.color ?? 'sky'),
        active: body.active !== false,
      };
      if (!row.name) return json({ error: 'Kurs nomi kerak' }, 400);
      const q = id ? await admin.from('courses').update(row).eq('id', id) : await admin.from('courses').insert(row);
      if (q.error) return json({ error: q.error.message }, 400);
      return json({ ok: true });
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
    return json({ error: String(e) }, 500);
  }
});
