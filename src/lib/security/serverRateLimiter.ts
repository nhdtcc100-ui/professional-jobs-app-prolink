import { supabase } from '../supabase';

/**
 * 🛡️ Server-Backed Rate Limiter — Database Layer
 * Protects login/auth routes against Brute Force attacks using PostgreSQL table `login_attempts`.
 * Cannot be bypassed by clearing browser localStorage.
 */
export const serverRateLimiter = {
  /**
   * Checks if an identifier (email or phone) is locked out.
   * Returns { allowed: boolean, remainingMinutes?: number }
   */
  async check(identifier: string): Promise<{ allowed: boolean; remainingMinutes?: number }> {
    const cleanId = identifier.trim().toLowerCase();
    const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins rolling window

    try {
      const { count, error } = await supabase
        .from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('identifier', cleanId)
        .eq('success', false)
        .gte('attempted_at', windowStart);

      if (error) {
        console.warn('[serverRateLimiter] Database check failed, falling back to allow:', error.message);
        return { allowed: true };
      }

      const failedCount = count ?? 0;

      if (failedCount >= 5) {
        // Fetch most recent attempt to calculate lockout remaining time
        const { data: lastAttempt } = await supabase
          .from('login_attempts')
          .select('attempted_at')
          .eq('identifier', cleanId)
          .order('attempted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastAttempt?.attempted_at) {
          const lockTimeMs = new Date(lastAttempt.attempted_at).getTime() + 15 * 60 * 1000; // 15 mins lock
          const remainingMinutes = Math.ceil((lockTimeMs - Date.now()) / 60000);

          if (remainingMinutes > 0) {
            return { allowed: false, remainingMinutes };
          }
        }
      }

      return { allowed: true };
    } catch (err) {
      console.warn('[serverRateLimiter] Exception during check:', err);
      return { allowed: true };
    }
  },

  /**
   * Records a login attempt (success or failure) in Supabase DB.
   */
  async record(identifier: string, success: boolean, ipAddress?: string): Promise<void> {
    const cleanId = identifier.trim().toLowerCase();

    try {
      await supabase.from('login_attempts').insert([
        {
          identifier: cleanId,
          success,
          ip_address: ipAddress || null,
          attempted_at: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.warn('[serverRateLimiter] Failed to record attempt:', err);
    }
  }
};
