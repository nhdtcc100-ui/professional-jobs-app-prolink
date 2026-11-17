import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// ✅ Secret Management: Keys are loaded from environment variables ONLY.
// Never hardcode API keys or credentials in source code.
// Set these in your .env file: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '🔒 Security Error: Missing Supabase environment variables.\n' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const AUTH_STORAGE_KEY = 'prolink_v2_auth_session';
export const LEGACY_AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

// Safe storage that works on Mobile Safari Private Mode, Android WebView, and standard browsers
const mobileSafeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {}
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (_) {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
  }
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: mobileSafeStorage,
    storageKey: AUTH_STORAGE_KEY,
    
    // تعطيل نظام الأقفال المسبب للتعليق (No-Op Lock)
    lock: async (_name, _acquireTimeout, fn) => await fn()
  }
});
