import { supabase } from '../supabase';

const DEFAULT_HANDLE = '@keko4444';
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
      return localStorage.getItem(STORAGE_BOT_TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  },

  getCachedChatId(): string {
    try {
      return localStorage.getItem(STORAGE_CHAT_ID_KEY) || '';
    } catch (_) {
      return '';
    }
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
    return `https://t.me/${clean || 'keko4444'}`;
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
   * Test Telegram connection by sending a verification message to the bot/chat
   */
  async testTelegramConnection(botToken: string, chatId: string): Promise<{ ok: boolean; description?: string; messageId?: number }> {
    const token = botToken.trim();
    const chat = chatId.trim();

    if (!token || !chat) {
      return { ok: false, description: 'يرجى إدخال توكن البوت ومعرف المحادثة أولاً' };
    }

    try {
      const text = `🧪 *اختبار اتصال ناجح مع منصة ProLink!*
━━━━━━━━━━━━━━━━━━
✅ بوت الدعم الفني متصل بنجاح وجاهز لاستقبال واستقبال رسائل المستخدمين.
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
    if (!config.botToken || !config.chatId) {
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
💡 _للرد على المستخدم: قم بالرد (Reply) مباشرة على هذه الرسالة أو من لوحة تحكم ProLink._`;

      const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id && params.messageId) {
        // Save telegram_message_id to database if possible
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
