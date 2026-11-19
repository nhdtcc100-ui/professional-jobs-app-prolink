import { supabase } from '../supabase';

const DEFAULT_HANDLE = '@prolink1357_support_bot';
const STORAGE_HANDLE_KEY = 'prolink_telegram_support_handle';

// Bot token / chat ID are server-side secrets now (telegram-support edge function).
// Purge any legacy copies cached by older app versions.
try {
  localStorage.removeItem('prolink_telegram_bot_token');
  localStorage.removeItem('prolink_telegram_chat_id');
} catch (_) {}

export interface TelegramConfig {
  handle: string;
  botToken: string;
  chatId: string;
}

async function invokeSupport(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('telegram-support', {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export const telegramSupportService = {
  async purgeIdleSupportMessages(): Promise<void> {
    try {
      await invokeSupport('purge');
    } catch (e) {
      console.warn('purgeIdleSupportMessages error:', e);
    }
  },

  getDefaultHandle(): string {
    return DEFAULT_HANDLE;
  },

  getCachedHandle(): string {
    try {
      const cached = localStorage.getItem(STORAGE_HANDLE_KEY);
      if (cached && cached.trim()) return cached.trim();
    } catch (_) {}
    return DEFAULT_HANDLE;
  },

  /** Admin-only: full config (incl. bot token) is served by the edge function. */
  async getConfig(): Promise<TelegramConfig> {
    const fallback: TelegramConfig = { handle: this.getCachedHandle(), botToken: '', chatId: '' };
    try {
      const res = await invokeSupport('get-config');
      if (res?.ok && res.config) {
        const config: TelegramConfig = {
          handle: res.config.handle || DEFAULT_HANDLE,
          botToken: res.config.botToken || '',
          chatId: res.config.chatId || '',
        };
        try { localStorage.setItem(STORAGE_HANDLE_KEY, config.handle); } catch (_) {}
        return config;
      }
    } catch (_) {}
    return fallback;
  },

  async getHandle(): Promise<string> {
    try {
      const res = await invokeSupport('get-handle');
      if (res?.ok && res.handle) {
        const handle = String(res.handle).trim();
        try { localStorage.setItem(STORAGE_HANDLE_KEY, handle); } catch (_) {}
        return handle;
      }
    } catch (_) {}
    return this.getCachedHandle();
  },

  getTelegramUrl(handle?: string): string {
    const raw = (handle || this.getCachedHandle()).trim();
    const clean = raw.replace(/^@+/, '').replace(/^https?:\/\/t\.me\//, '');
    return `https://t.me/${clean || 'prolink1357_support_bot'}`;
  },

  formatHandle(handle: string): string {
    const clean = handle.trim().replace(/^@+/, '').replace(/^https?:\/\/t\.me\//, '');
    return clean ? `@${clean}` : DEFAULT_HANDLE;
  },

  async saveConfig(params: { handle?: string; botToken?: string; chatId?: string }): Promise<{ success: boolean; config: TelegramConfig; error?: string }> {
    const newHandle = params.handle !== undefined ? this.formatHandle(params.handle) : undefined;
    try {
      const res = await invokeSupport('save-config', {
        handle: newHandle,
        // Empty values must not wipe the server-side secrets.
        botToken: params.botToken?.trim() || undefined,
        chatId: params.chatId?.trim() || undefined,
      });
      if (res?.ok) {
        const config: TelegramConfig = {
          handle: res.config?.handle || newHandle || this.getCachedHandle(),
          botToken: res.config?.botToken || '',
          chatId: res.config?.chatId || '',
        };
        try {
          localStorage.setItem(STORAGE_HANDLE_KEY, config.handle);
          window.dispatchEvent(new CustomEvent('prolink_telegram_handle_changed', { detail: config }));
        } catch (_) {}
        return { success: true, config };
      }
      return { success: false, config: { handle: newHandle || this.getCachedHandle(), botToken: '', chatId: '' }, error: res?.error || 'فشل الحفظ' };
    } catch (e: any) {
      return { success: false, config: { handle: newHandle || this.getCachedHandle(), botToken: '', chatId: '' }, error: e?.message };
    }
  },

  async saveHandle(newHandle: string): Promise<{ success: boolean; handle: string; error?: string }> {
    const res = await this.saveConfig({ handle: newHandle });
    return { success: res.success, handle: res.config.handle, error: res.error };
  },

  async detectLatestChatId(botToken?: string): Promise<{ ok: boolean; chatId?: string; sender?: string; error?: string }> {
    try {
      const res = await invokeSupport('detect', { botToken });
      return { ok: !!res?.ok, chatId: res?.chatId, sender: res?.sender, error: res?.error };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'خطأ في الاتصال بالإنترنت' };
    }
  },

  async testTelegramConnection(botToken: string, chatId: string): Promise<{ ok: boolean; description?: string; messageId?: number }> {
    try {
      const res = await invokeSupport('test', { botToken, chatId });
      return { ok: !!res?.ok, description: res?.description, messageId: res?.messageId };
    } catch (e: any) {
      return { ok: false, description: e?.message || 'خطأ في الشبكة أثناء الاتصال بتيليجرام' };
    }
  },

  async sendSupportNotification(params: {
    userName: string;
    userPhone: string;
    userRole: string;
    userId: string;
    content: string;
    messageId?: string;
  }): Promise<boolean> {
    try {
      const res = await invokeSupport('notify', params);
      return !!res?.ok;
    } catch (e) {
      console.warn('Telegram notification failed:', e);
      return false;
    }
  },

  async syncTelegramReplies(filterUserId?: string): Promise<{ synced: number; updates: any[] }> {
    try {
      const res = await invokeSupport('sync', { filterUserId });
      return { synced: res?.synced || 0, updates: [] };
    } catch (e) {
      console.warn('Telegram sync failed:', e);
      return { synced: 0, updates: [] };
    }
  }
};