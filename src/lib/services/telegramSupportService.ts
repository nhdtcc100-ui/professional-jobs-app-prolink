import { supabase } from '../supabase';

const DEFAULT_HANDLE = '@keko4444';
const STORAGE_KEY = 'prolink_telegram_support_handle';
const SETTING_KEY = 'telegram_support_handle';

export const telegramSupportService = {
  getDefaultHandle(): string {
    return DEFAULT_HANDLE;
  },

  /**
   * Get cached handle synchronously for instantaneous UI rendering
   */
  getCachedHandle(): string {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached && cached.trim()) {
        return cached.trim();
      }
    } catch (_) {}
    return DEFAULT_HANDLE;
  },

  /**
   * Fetch current telegram handle from Supabase platform_settings or fallback to cached
   */
  async getHandle(): Promise<string> {
    const cached = this.getCachedHandle();
    try {
      const { data, error } = await (supabase as any)
        .from('platform_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (!error && data?.value) {
        const val = String(data.value).trim();
        if (val) {
          try {
            localStorage.setItem(STORAGE_KEY, val);
          } catch (_) {}
          return val;
        }
      }
    } catch (e) {
      // Graceful fallback to cached or default
    }
    return cached;
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
   * Save telegram handle to platform_settings in Supabase and sync local storage
   */
  async saveHandle(newHandle: string): Promise<{ success: boolean; handle: string; error?: string }> {
    const formatted = this.formatHandle(newHandle);

    // 1. Immediate local cache update
    try {
      localStorage.setItem(STORAGE_KEY, formatted);
      window.dispatchEvent(new CustomEvent('prolink_telegram_handle_changed', { detail: { handle: formatted } }));
    } catch (_) {}

    // 2. Persist to Supabase platform_settings
    try {
      const { error } = await (supabase as any)
        .from('platform_settings')
        .upsert(
          {
            key: SETTING_KEY,
            value: formatted,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.warn('Could not persist telegram handle to platform_settings table:', error.message);
        // If table does not exist yet, we still succeed locally
        return { success: true, handle: formatted, error: error.message };
      }

      return { success: true, handle: formatted };
    } catch (e: any) {
      return { success: true, handle: formatted, error: e?.message };
    }
  }
};
