import { supabase } from '../supabase';

export interface PlatformPublicSettings {
  messagingEnabled: boolean;
  supportChatEnabled: boolean;
  groupsEnabled: boolean;
  networkEnabled: boolean;
  accountSwitchEnabled: boolean;
  khakiThemeEnabled: boolean;
  cvUploadEnabled: boolean;
  navStyle: string;
  supportWhatsapp: string;
  supportTelegram: string;
}

const KEY_MESSAGING = 'messaging_enabled';
const KEY_SUPPORT_CHAT = 'support_chat_enabled';
const KEY_GROUPS = 'groups_enabled';
const KEY_NETWORK = 'network_enabled';
const KEY_ACCOUNT_SWITCH = 'account_switch_enabled';
const KEY_KHAKI_THEME = 'khaki_theme_enabled';
const KEY_CV_UPLOAD = 'cv_upload_enabled';
const KEY_NAV_STYLE = 'nav_style';
const KEY_WHATSAPP = 'support_whatsapp_number';
const KEY_TELEGRAM = 'telegram_support_handle';
const KEYS = [KEY_MESSAGING, KEY_SUPPORT_CHAT, KEY_GROUPS, KEY_NETWORK, KEY_ACCOUNT_SWITCH, KEY_KHAKI_THEME, KEY_CV_UPLOAD, KEY_NAV_STYLE, KEY_WHATSAPP, KEY_TELEGRAM];
const CACHE_KEY = 'prolink_platform_public_settings';

export const DEFAULT_PUBLIC_SETTINGS: PlatformPublicSettings = {
  messagingEnabled: false,
  supportChatEnabled: false,
  groupsEnabled: false,
  networkEnabled: false,
  accountSwitchEnabled: false,
  khakiThemeEnabled: false,
  cvUploadEnabled: false,
  navStyle: 'dock',
  supportWhatsapp: '',
  supportTelegram: '',
};

const parseRows = (rows: { key: string; value: string }[]): PlatformPublicSettings => {
  const next = { ...DEFAULT_PUBLIC_SETTINGS };
  for (const row of rows || []) {
    const value = String(row.value ?? '').trim();
    if (row.key === KEY_MESSAGING) next.messagingEnabled = value === 'true';
    else if (row.key === KEY_SUPPORT_CHAT) next.supportChatEnabled = value === 'true';
    else if (row.key === KEY_GROUPS) next.groupsEnabled = value === 'true';
    else if (row.key === KEY_NETWORK) next.networkEnabled = value === 'true';
    else if (row.key === KEY_ACCOUNT_SWITCH) next.accountSwitchEnabled = value === 'true';
    else if (row.key === KEY_KHAKI_THEME) next.khakiThemeEnabled = value === 'true';
    else if (row.key === KEY_CV_UPLOAD) next.cvUploadEnabled = value === 'true';
    else if (row.key === KEY_NAV_STYLE) next.navStyle = value || 'dock';
    else if (row.key === KEY_WHATSAPP) next.supportWhatsapp = value;
    else if (row.key === KEY_TELEGRAM) next.supportTelegram = value;
  }
  return next;
};

const writeCache = (settings: PlatformPublicSettings) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(settings)); } catch {}
};

export const platformSettingsService = {
  getCached(): PlatformPublicSettings {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return { ...DEFAULT_PUBLIC_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_PUBLIC_SETTINGS };
  },

  async fetch(): Promise<PlatformPublicSettings> {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', KEYS);
      if (error || !data) return this.getCached();
      const settings = parseRows(data as any);
      writeCache(settings);
      return settings;
    } catch {
      return this.getCached();
    }
  },

  async save(patch: Partial<PlatformPublicSettings>): Promise<{ success: boolean; error?: string }> {
    const rows: { key: string; value: string; updated_at: string }[] = [];
    const now = new Date().toISOString();
    const boolKeys: [keyof PlatformPublicSettings, string][] = [
      ['messagingEnabled', KEY_MESSAGING],
      ['supportChatEnabled', KEY_SUPPORT_CHAT],
      ['groupsEnabled', KEY_GROUPS],
      ['networkEnabled', KEY_NETWORK],
      ['accountSwitchEnabled', KEY_ACCOUNT_SWITCH],
      ['khakiThemeEnabled', KEY_KHAKI_THEME],
      ['cvUploadEnabled', KEY_CV_UPLOAD],
    ];
    for (const [field, key] of boolKeys) {
      if (patch[field] !== undefined) rows.push({ key, value: String(patch[field]), updated_at: now });
    }
    if (patch.navStyle !== undefined) rows.push({ key: KEY_NAV_STYLE, value: patch.navStyle.trim() || 'dock', updated_at: now });
    if (patch.supportWhatsapp !== undefined) rows.push({ key: KEY_WHATSAPP, value: patch.supportWhatsapp.trim(), updated_at: now });
    if (patch.supportTelegram !== undefined) rows.push({ key: KEY_TELEGRAM, value: patch.supportTelegram.trim(), updated_at: now });
    if (rows.length === 0) return { success: true };

    const { error } = await supabase
      .from('platform_settings')
      .upsert(rows as any, { onConflict: 'key' });
    if (error) return { success: false, error: error.message };

    const merged = { ...this.getCached(), ...parseRows(rows) };
    writeCache(merged);
    window.dispatchEvent(new CustomEvent('prolink_platform_settings_changed', { detail: merged }));
    return { success: true };
  },

  // Checks the existing server gate and the CV setting added by the updated migration.
  async isGateMigrationApplied(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('prolink_messaging_open' as any);
      if (error) return false;
      const { data, error: settingsError } = await supabase
        .from('platform_settings')
        .select('key')
        .eq('key', KEY_CV_UPLOAD)
        .maybeSingle();
      return !settingsError && data?.key === KEY_CV_UPLOAD;
    } catch {
      return false;
    }
  },
};