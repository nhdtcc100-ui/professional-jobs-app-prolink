import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const DEFAULT_HANDLE = '@prolink1357_support_bot';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getSettings(): Promise<{ handle: string; botToken: string; chatId: string }> {
  const { data } = await admin
    .from('platform_settings')
    .select('key, value')
    .in('key', ['telegram_support_handle', 'telegram_bot_token', 'telegram_chat_id']);

  const map: Record<string, string> = {};
  for (const row of data || []) map[row.key] = String(row.value ?? '').trim();

  return {
    handle: map['telegram_support_handle'] || DEFAULT_HANDLE,
    botToken: map['telegram_bot_token'] || Deno.env.get('TELEGRAM_BOT_TOKEN') || '',
    chatId: map['telegram_chat_id'] || Deno.env.get('TELEGRAM_SUPPORT_CHAT_ID') || '',
  };
}

async function tgCall(token: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { action, ...params } = await req.json();

    // Public action: the support handle is not a secret.
    if (action === 'get-handle') {
      const settings = await getSettings();
      return json({ ok: true, handle: settings.handle });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, role, name, phone')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin = profile?.is_admin === true || profile?.role === 'admin' || profile?.role === 'superadmin';

    const settings = await getSettings();

    switch (action) {
      case 'notify': {
        if (!settings.botToken || !settings.chatId) return json({ ok: false, error: 'Telegram not configured' });
        const content = String(params.content || '').slice(0, 4000);
        if (!content) return json({ ok: false, error: 'Empty content' }, 400);

        const text = `🎧 *رسالة دعم فني جديدة عبر ProLink*
━━━━━━━━━━━━━━━━━━
👤 *المرسل:* ${params.userName || profile?.name || 'مستخدم المنصة'} (${params.userRole || profile?.role || 'مستخدم'})
📞 *الهاتف:* \`${params.userPhone || profile?.phone || 'غير متوفر'}\`
🆔 *معرف المستخدم:* \`${user.id}\`
🕒 *التوقيت:* ${new Date().toLocaleString('ar-IQ')}

💬 *نص الاستفسار:*
${content}
━━━━━━━━━━━━━━━━━━
💡 _يمكنك متابعة الرد من لوحة تحكم ProLink أو مباشرة من تيليجرام._`;

        const data = await tgCall(settings.botToken, 'sendMessage', {
          chat_id: settings.chatId,
          text,
          parse_mode: 'Markdown',
        });

        if (data.ok && data.result?.message_id && params.messageId) {
          await admin
            .from('support_messages')
            .update({
              telegram_message_id: data.result.message_id,
              telegram_chat_id: data.result.chat?.id,
            })
            .eq('id', params.messageId)
            .eq('sender_id', user.id);
        }
        return json({ ok: !!data.ok, description: data.description });
      }

      case 'sync': {
        if (!settings.botToken) return json({ ok: true, synced: 0 });
        // Non-admins may only sync replies addressed to themselves.
        const filterUserId = isAdmin ? (params.filterUserId || null) : user.id;

        const data = await tgCall(settings.botToken, 'getUpdates', {});
        if (!data.ok || !Array.isArray(data.result)) return json({ ok: true, synced: 0 });

        let maxUpdateId = 0;
        const validReplies: { updateId: number; text: string; targetUserId: string; telegramFrom: string; telegramMessageId: number }[] = [];

        for (const u of data.result) {
          if (u.update_id > maxUpdateId) maxUpdateId = u.update_id;
          const msg = u.message;
          if (!msg || !msg.text || !msg.reply_to_message) continue;
          const replyToText = msg.reply_to_message.text || '';
          const userMatch = replyToText.match(/معرف المستخدم:[\s*`]*([a-f0-9\-]{36})/i);
          const targetUserId = userMatch ? userMatch[1].trim() : null;
          if (targetUserId && (!filterUserId || filterUserId === targetUserId)) {
            validReplies.push({
              updateId: u.update_id,
              text: msg.text.trim(),
              targetUserId,
              telegramFrom: msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || 'الدعم الفني'),
              telegramMessageId: msg.message_id,
            });
          }
        }

        if (validReplies.length === 0) return json({ ok: true, synced: 0 });

        const { data: adminProfiles } = await admin
          .from('profiles')
          .select('id')
          .or('is_admin.eq.true,role.eq.admin,role.eq.superadmin')
          .limit(1);
        const adminSenderId = adminProfiles?.[0]?.id;
        if (!adminSenderId) return json({ ok: true, synced: 0 });

        let synced = 0;
        for (const item of validReplies) {
          const { error } = await admin.from('support_messages').insert({
            sender_id: adminSenderId,
            receiver_id: item.targetUserId,
            content: item.text,
            message_type: 'text',
            metadata: {
              source: 'telegram',
              telegram_from: item.telegramFrom,
              telegram_message_id: item.telegramMessageId,
              telegram_update_id: item.updateId,
            },
          });
          if (!error) synced++;
        }

        if (maxUpdateId > 0 && synced > 0) {
          await tgCall(settings.botToken, 'getUpdates', { offset: maxUpdateId + 1 });
        }
        return json({ ok: true, synced });
      }

      case 'detect': {
        if (!isAdmin) return json({ error: 'Forbidden' }, 403);
        const token = String(params.botToken || '').trim() || settings.botToken;
        if (!token) return json({ ok: false, error: 'رمز توكن البوت غير متوفر' });

        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-10`);
        const data = await res.json();
        if (!data.ok) return json({ ok: false, error: data.description || 'فشل الاتصال بتيليجرام' });

        const updates = data.result;
        if (!Array.isArray(updates) || updates.length === 0) {
          return json({ ok: false, error: 'لم يتم العثور على أي رسائل بعد. يرجى فتح البوت في تيليجرام والضغط على Start أولاً.' });
        }
        for (let i = updates.length - 1; i >= 0; i--) {
          const u = updates[i];
          const msg = u.message || u.edited_message || u.channel_post || u.my_chat_member;
          const chat = msg?.chat;
          if (chat && chat.id) {
            const sender = chat.title || chat.username || chat.first_name || 'مستخدم تيليجرام';
            return json({ ok: true, chatId: String(chat.id), sender });
          }
        }
        return json({ ok: false, error: 'لم يتم العثور على محادثة صالحة' });
      }

      case 'test': {
        if (!isAdmin) return json({ error: 'Forbidden' }, 403);
        const token = String(params.botToken || '').trim() || settings.botToken;
        const chat = String(params.chatId || '').trim() || settings.chatId;
        if (!token || !chat) return json({ ok: false, description: 'يرجى إدخال معرف المحادثة (Chat ID) أولاً' });

        const text = `🧪 *اختبار اتصال ناجح مع منصة ProLink!*
━━━━━━━━━━━━━━━━━━
✅ بوت الدعم الفني متصل بنجاح وجاهز لاستقبال رسائل المستخدمين.
⏰ التوقيت: ${new Date().toLocaleString('ar-IQ')}
━━━━━━━━━━━━━━━━━━
_منصة ProLink للتوظيف والخدمات المهنية_`;

        const data = await tgCall(token, 'sendMessage', { chat_id: chat, text, parse_mode: 'Markdown' });
        return json({ ok: !!data.ok, description: data.description, messageId: data.result?.message_id });
      }

      case 'get-config': {
        if (!isAdmin) return json({ error: 'Forbidden' }, 403);
        return json({ ok: true, config: settings });
      }

      case 'save-config': {
        if (!isAdmin) return json({ error: 'Forbidden' }, 403);
        const rows: { key: string; value: string; updated_at: string }[] = [];
        const now = new Date().toISOString();
        if (params.handle !== undefined) rows.push({ key: 'telegram_support_handle', value: String(params.handle).trim(), updated_at: now });
        if (params.botToken !== undefined) rows.push({ key: 'telegram_bot_token', value: String(params.botToken).trim(), updated_at: now });
        if (params.chatId !== undefined) rows.push({ key: 'telegram_chat_id', value: String(params.chatId).trim(), updated_at: now });
        if (rows.length === 0) return json({ ok: false, error: 'Nothing to save' }, 400);

        const { error } = await admin.from('platform_settings').upsert(rows, { onConflict: 'key' });
        if (error) return json({ ok: false, error: error.message });
        return json({ ok: true, config: await getSettings() });
      }

      case 'purge': {
        if (!isAdmin) return json({ error: 'Forbidden' }, 403);
        const twoDaysAgoISO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await admin.from('support_messages').delete().lt('created_at', twoDaysAgoISO);
        return json({ ok: !error, error: error?.message });
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    console.error('telegram-support error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});