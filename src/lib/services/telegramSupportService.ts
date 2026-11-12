import { supabase } from '../supabase';

const DEFAULT_HANDLE = '@prolink1357_support_bot';
const DEFAULT_BOT_TOKEN = '9259272344:AAGkb7hGss2Hy9gdUPamHEg5mwLvOAe8Vw0';
const DEFAULT_CHAT_ID = '207207781';

const STORAGE_HANDLE_KEY = 'prolink_telegram_support_handle';
const STORAGE_BOT_TOKEN_KEY = 'prolink_telegram_bot_token';
const STORAGE_CHAT_ID_KEY = 'prolink_telegram_chat_id';

const SETTING_HANDLE_KEY = 'telegram_support_handle';
const SETTING_BOT_TOKEN_KEY = 'telegram_bot_token';
const SETTING_CHAT_ID_KEY = 'telegram_chat_id';

export interface TelegramConfig {
  handle: string;
  botToken: string;
  chatId: string;
}

export const telegramSupportService = {
  getDefaultHandle(): string {
    return DEFAULT_HANDLE;
  },

  getDefaultBotToken(): string {
    return DEFAULT_BOT_TOKEN;
  },

  getDefaultChatId(): string {
    return DEFAULT_CHAT_ID;
  },

  /**
   * Get cached handle synchronously for instantaneous UI rendering
   */
  getCachedHandle(): string {
    try {
      const cached = localStorage.getItem(STORAGE_HANDLE_KEY);
      if (cached && cached.trim()) {
        return cached.trim();
      }
    } catch (_) {}
    return DEFAULT_HANDLE;
  },

  getCachedBotToken(): string {
    try {
      const cached = localStorage.getItem(STORAGE_BOT_TOKEN_KEY);
      if (cached && cached.trim()) {
        return cached.trim();
      }
    } catch (_) {}
    return DEFAULT_BOT_TOKEN;
  },

  getCachedChatId(): string {
    try {
      const cached = localStorage.getItem(STORAGE_CHAT_ID_KEY);
      if (cached && cached.trim()) {
        return cached.trim();
      }
    } catch (_) {}
    return DEFAULT_CHAT_ID;
  },

  /**
   * Fetch full Telegram configuration
   */
  async getConfig(): Promise<TelegramConfig> {
    const config: TelegramConfig = {
      handle: this.getCachedHandle(),
      botToken: this.getCachedBotToken(),
      chatId: this.getCachedChatId(),
    };

    try {
      const { data, error } = await (supabase as any)
        .from('platform_settings')
        .select('key, value')
        .in('key', [SETTING_HANDLE_KEY, SETTING_BOT_TOKEN_KEY, SETTING_CHAT_ID_KEY]);

      if (!error && Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row.key === SETTING_HANDLE_KEY && row.value) {
            config.handle = String(row.value).trim();
            try { localStorage.setItem(STORAGE_HANDLE_KEY, config.handle); } catch (_) {}
          } else if (row.key === SETTING_BOT_TOKEN_KEY && row.value) {
            config.botToken = String(row.value).trim();
            try { localStorage.setItem(STORAGE_BOT_TOKEN_KEY, config.botToken); } catch (_) {}
          } else if (row.key === SETTING_CHAT_ID_KEY && row.value) {
            config.chatId = String(row.value).trim();
            try { localStorage.setItem(STORAGE_CHAT_ID_KEY, config.chatId); } catch (_) {}
          }
        });
      }
    } catch (_) {}

    return config;
  },

  /**
   * Fetch current telegram handle from Supabase platform_settings or fallback to cached
   */
  async getHandle(): Promise<string> {
    const conf = await this.getConfig();
    return conf.handle || DEFAULT_HANDLE;
  },

  /**
   * Format handle into a clean t.me URL
   */
  getTelegramUrl(handle?: string): string {
    const raw = (handle || this.getCachedHandle()).trim();
    const clean = raw.replace(/^@+/, '').replace(/^https?:\/\/t\.me\//, '');
    return `https://t.me/${clean || 'prolink1357_support_bot'}`;
  },

  /**
   * Normalize handle to include @ prefix
   */
  formatHandle(handle: string): string {
    const clean = handle.trim().replace(/^@+/, '').replace(/^https?:\/\/t\.me\//, '');
    return clean ? `@${clean}` : DEFAULT_HANDLE;
  },

  /**
   * Save full Telegram configuration
   */
  async saveConfig(params: { handle?: string; botToken?: string; chatId?: string }): Promise<{ success: boolean; config: TelegramConfig; error?: string }> {
    const current = await this.getConfig();
    const newHandle = params.handle !== undefined ? this.formatHandle(params.handle) : current.handle;
    const newBotToken = params.botToken !== undefined ? params.botToken.trim() : current.botToken;
    const newChatId = params.chatId !== undefined ? params.chatId.trim() : current.chatId;

    const updatedConfig: TelegramConfig = {
      handle: newHandle,
      botToken: newBotToken,
      chatId: newChatId,
    };

    // 1. Immediate local cache update
    try {
      localStorage.setItem(STORAGE_HANDLE_KEY, newHandle);
      localStorage.setItem(STORAGE_BOT_TOKEN_KEY, newBotToken);
      localStorage.setItem(STORAGE_CHAT_ID_KEY, newChatId);
      window.dispatchEvent(new CustomEvent('prolink_telegram_handle_changed', { detail: updatedConfig }));
    } catch (_) {}

    // 2. Persist to Supabase platform_settings
    try {
      const rows = [
        { key: SETTING_HANDLE_KEY, value: newHandle, updated_at: new Date().toISOString() },
        { key: SETTING_BOT_TOKEN_KEY, value: newBotToken, updated_at: new Date().toISOString() },
        { key: SETTING_CHAT_ID_KEY, value: newChatId, updated_at: new Date().toISOString() },
      ];

      const { error } = await (supabase as any)
        .from('platform_settings')
        .upsert(rows, { onConflict: 'key' });

      if (error) {
        console.warn('Could not persist telegram config to platform_settings table:', error.message);
        return { success: true, config: updatedConfig, error: error.message };
      }

      return { success: true, config: updatedConfig };
    } catch (e: any) {
      return { success: true, config: updatedConfig, error: e?.message };
    }
  },

  /**
   * Save telegram handle only
   */
  async saveHandle(newHandle: string): Promise<{ success: boolean; handle: string; error?: string }> {
    const res = await this.saveConfig({ handle: newHandle });
    return { success: res.success, handle: res.config.handle, error: res.error };
  },

  /**
   * Automatically detect the latest chat ID by querying getUpdates from the bot
   */
  async detectLatestChatId(botToken?: string): Promise<{ ok: boolean; chatId?: string; sender?: string; error?: string }> {
    const token = (botToken || this.getCachedBotToken() || DEFAULT_BOT_TOKEN).trim();
    if (!token) return { ok: false, error: 'رمز توكن البوت غير متوفر' };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-10`);
      const data = await res.json();
      if (!data.ok) {
        return { ok: false, error: data.description || 'فشل الاتصال بتيليجرام' };
      }

      const updates = data.result;
      if (!Array.isArray(updates) || updates.length === 0) {
        return {
          ok: false,
          error: 'لم يتم العثور على أي رسائل بعد. يرجى فتح البوت في تيليجرام والضغط على Start أولاً.'
        };
      }

      // Iterate backwards to find latest chat
      for (let i = updates.length - 1; i >= 0; i--) {
        const u = updates[i];
        const msg = u.message || u.edited_message || u.channel_post || u.my_chat_member;
        const chat = msg?.chat;
        if (chat && chat.id) {
          const sender = chat.title || chat.username || chat.first_name || 'مستخدم تيليجرام';
          return { ok: true, chatId: String(chat.id), sender };
        }
      }

      return { ok: false, error: 'لم يتم العثور على محادثة صالحة' };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'خطأ في الاتصال بالإنترنت' };
    }
  },

  /**
   * Test Telegram connection by sending a verification message to the bot/chat
   */
  async testTelegramConnection(botToken: string, chatId: string): Promise<{ ok: boolean; description?: string; messageId?: number }> {
    const token = botToken.trim() || DEFAULT_BOT_TOKEN;
    const chat = chatId.trim() || DEFAULT_CHAT_ID;

    if (!token || !chat) {
      return { ok: false, description: 'يرجى إدخال معرف المحادثة (Chat ID) أولاً' };
    }

    try {
      const text = `🧪 *اختبار اتصال ناجح مع منصة ProLink!*
━━━━━━━━━━━━━━━━━━
✅ بوت الدعم الفني متصل بنجاح وجاهز لاستقبال واستقبال رسائل المستخدمين.
🤖 اسم البوت: @prolink1357_support_bot
⏰ التوقيت: ${new Date().toLocaleString('ar-IQ')}
━━━━━━━━━━━━━━━━━━
_منصة ProLink للتوظيف والخدمات المهنية_`;

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat,
          text,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json();
      if (data.ok) {
        return { ok: true, messageId: data.result?.message_id };
      } else {
        return { ok: false, description: data.description || 'فشل الاتصال بتيليجرام' };
      }
    } catch (e: any) {
      return { ok: false, description: e?.message || 'خطأ في الشبكة أثناء الاتصال بتيليجرام' };
    }
  },

  /**
   * Send a support message notification directly to Telegram
   */
  async sendSupportNotification(params: {
    userName: string;
    userPhone: string;
    userRole: string;
    userId: string;
    content: string;
    messageId?: string;
  }): Promise<boolean> {
    const config = await this.getConfig();
    const botToken = config.botToken || DEFAULT_BOT_TOKEN;
    const chatId = config.chatId || DEFAULT_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn('Telegram notification skipped: botToken or chatId missing');
      return false;
    }

    try {
      const text = `🎧 *رسالة دعم فني جديدة عبر ProLink*
━━━━━━━━━━━━━━━━━━
👤 *المرسل:* ${params.userName || 'مستخدم المنصة'} (${params.userRole || 'مستخدم'})
📞 *الهاتف:* \`${params.userPhone || 'غير متوفر'}\`
🆔 *معرف المستخدم:* \`${params.userId}\`
🕒 *التوقيت:* ${new Date().toLocaleString('ar-IQ')}

💬 *نص الاستفسار:*
${params.content}
━━━━━━━━━━━━━━━━━━
💡 _يمكنك متابعة الرد من لوحة تحكم ProLink أو مباشرة من تيليجرام._`;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id && params.messageId) {
        try {
          await (supabase as any)
            .from('support_messages')
            .update({
              telegram_message_id: data.result.message_id,
              telegram_chat_id: data.result.chat?.id,
            })
            .eq('id', params.messageId);
        } catch (_) {}
      }
      return data.ok;
    } catch (e) {
      console.warn('Direct telegram notification failed:', e);
      return false;
    }
  }
};
