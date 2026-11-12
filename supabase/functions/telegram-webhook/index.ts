import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
const TELEGRAM_SUPPORT_CHAT_ID = Deno.env.get('TELEGRAM_SUPPORT_CHAT_ID') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Security Check: Verify Telegram Secret Token
    if (TELEGRAM_WEBHOOK_SECRET) {
      const headerSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (headerSecret !== TELEGRAM_WEBHOOK_SECRET) {
        return new Response('Unauthorized token', { status: 401 });
      }
    }

    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return new Response('No message content', { status: 200 });
    }

    // Security Check: Verify chat ID matches authorized support group
    if (TELEGRAM_SUPPORT_CHAT_ID && String(message.chat.id) !== String(TELEGRAM_SUPPORT_CHAT_ID)) {
      console.warn('Unauthorized chat ID attempted response:', message.chat.id);
      return new Response('Chat ignored', { status: 200 });
    }

    // Must be a reply to a previous bot message
    const replyTo = message.reply_to_message;
    if (!replyTo || !replyTo.message_id) {
      return new Response('Not a reply to support message', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up original message in support_messages
    const { data: originalMessage } = await supabase
      .from('support_messages')
      .select('id, sender_id, receiver_id')
      .eq('telegram_message_id', replyTo.message_id)
      .maybeSingle();

    if (!originalMessage || !originalMessage.sender_id) {
      console.warn('Original support message not found for telegram_message_id:', replyTo.message_id);
      return new Response('Original thread not found', { status: 200 });
    }

    // Resolve an admin ID to act as sender
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .or('is_admin.eq.true,role.eq.admin,role.eq.superadmin')
      .limit(1)
      .maybeSingle();

    const adminSenderId = adminProfile?.id || originalMessage.receiver_id;
    const targetUserId = originalMessage.sender_id;

    // Insert admin reply into support_messages (triggers Supabase Realtime in client)
    const { error: insertErr } = await supabase.from('support_messages').insert({
      sender_id: adminSenderId,
      receiver_id: targetUserId,
      content: message.text.trim(),
      message_type: 'text',
      metadata: {
        source: 'telegram',
        telegram_from: message.from?.username || message.from?.first_name || 'Support Agent',
        reply_to_telegram_id: replyTo.message_id,
      },
    });

    if (insertErr) {
      console.error('Error inserting support reply from Telegram:', insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, recipient: targetUserId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Telegram Webhook Exception:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

