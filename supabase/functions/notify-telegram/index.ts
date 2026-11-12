import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_SUPPORT_CHAT_ID = Deno.env.get('TELEGRAM_SUPPORT_CHAT_ID') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_SUPPORT_CHAT_ID) {
      console.warn('Telegram BOT_TOKEN or SUPPORT_CHAT_ID not configured in Supabase secrets');
      return new Response(JSON.stringify({ error: 'Telegram secrets missing' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const record = payload.record || payload.new;

    if (!record || !record.content || !record.sender_id) {
      return new Response('Invalid payload', { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user details
    const { data: sender } = await supabase
      .from('profiles')
      .select('name, phone, role, is_admin')
      .eq('id', record.sender_id)
      .maybeSingle();

    // Do not notify if the message is sent by an admin (it's already a reply)
    if (sender?.is_admin || sender?.role === 'admin' || sender?.role === 'superadmin') {
      return new Response(JSON.stringify({ skipped: 'Admin message' }), { status: 200 });
    }

    const userName = sender?.name || 'مستخدم غير معروف';
    const userPhone = sender?.phone || 'بدون هاتف';
    const userRole = sender?.role === 'employer' ? 'صاحب عمل 💼' : 'باحث عن عمل 👤';

    const text = `🎧 *رسالة دعم فني جديدة عبر ProLink*
━━━━━━━━━━━━━━━━━━
👤 *المرسل:* ${userName} (${userRole})
📞 *الهاتف:* \`${userPhone}\`
🆔 *معرف المستخدم:* \`${record.sender_id}\`
🕒 *التوقيت:* ${new Date(record.created_at || Date.now()).toLocaleString('ar-IQ')}

💬 *نص الاستفسار:*
${record.content}
━━━━━━━━━━━━━━━━━━
💡 _للرد على المستخدم: قم بالرد (Reply) مباشرة على هذه الرسالة من تيليجرام._`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_SUPPORT_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();

    if (tgData.ok && tgData.result?.message_id && record.id) {
      // Save telegram message id back to support_messages
      await supabase
        .from('support_messages')
        .update({
          telegram_message_id: tgData.result.message_id,
          telegram_chat_id: tgData.result.chat.id,
        })
        .eq('id', record.id);
    }

    return new Response(JSON.stringify({ success: true, tg: tgData }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Notify Telegram Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

