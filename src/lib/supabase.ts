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

// Background tabs/WebViews silently drop sockets; without a deadline a hung token
// refresh blocks every later query (each request awaits the session first).
const REQUEST_TIMEOUT_MS = 30_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 120_000;

const fetchWithTimeout: typeof fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const isUpload = url.includes('/storage/v1/object/') && (method === 'POST' || method === 'PUT');
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('انتهت مهلة الاتصال، حاول مجدداً.', 'TimeoutError')),
    isUpload ? STORAGE_UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  );
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
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
