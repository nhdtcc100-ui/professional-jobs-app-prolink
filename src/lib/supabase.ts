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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'prolink_v2_auth_session',
    
    // تعطيل نظام الأقفال المسبب للتعليق (No-Op Lock)
    async lock(_name, _acquireTimeout, fn) {
      return fn();
    }
  }
});
