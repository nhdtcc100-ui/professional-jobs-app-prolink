import { supabase } from '../supabase';

/**
 * Server-backed brute-force protection via the `check_login_lockout` /
 * `record_login_attempt` RPCs (see supabase/SECURITY_HARDENING_MIGRATION.sql).
 * Fail-closed: if the server check cannot be performed, login is denied.
 */
export const serverRateLimiter = {
  async check(identifier: string): Promise<{ allowed: boolean; remainingMinutes?: number }> {
    const cleanId = identifier.trim().toLowerCase();
    try {
      const { data, error } = await supabase.rpc('check_login_lockout', {
        p_identifier: cleanId,
      });
      if (error) {
        console.error('[serverRateLimiter] Lockout check failed, denying login:', error.message);
        return { allowed: false, remainingMinutes: 1 };
      }
      const result = (data || {}) as { allowed?: boolean; remainingMinutes?: number };
      return { allowed: result.allowed !== false, remainingMinutes: result.remainingMinutes };
    } catch (err) {
      console.error('[serverRateLimiter] Exception during check, denying login:', err);
      return { allowed: false, remainingMinutes: 1 };
    }
  },

  async record(identifier: string, success: boolean, ipAddress?: string): Promise<void> {
    const cleanId = identifier.trim().toLowerCase();
    try {
      const { error } = await supabase.rpc('record_login_attempt', {
        p_identifier: cleanId,
        p_success: success,
        p_ip: ipAddress || null,
      });
      if (error) console.error('[serverRateLimiter] Failed to record attempt:', error.message);
    } catch (err) {
      console.error('[serverRateLimiter] Failed to record attempt:', err);
    }
  }
};