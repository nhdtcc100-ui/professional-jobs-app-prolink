/**
 * 🛡️ Rate Limiter — Frontend Layer
 * Protects login from Brute Force attacks (localStorage-based)
 * Note: This is a client-side deterrent. Supabase Auth also has server-side protection.
 */

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 30 * 60 * 1000;  // 30-minute rolling window
const KEY_PREFIX = 'rl_v1_';

// Use btoa to avoid storing the identifier plaintext in localStorage
const makeKey = (identifier: string): string =>
  KEY_PREFIX + btoa(encodeURIComponent(identifier.toLowerCase().trim())).slice(0, 32);

const getRecord = (identifier: string): AttemptRecord => {
  try {
    const raw = localStorage.getItem(makeKey(identifier));
    return raw ? JSON.parse(raw) : { count: 0, firstAttempt: Date.now() };
  } catch {
    return { count: 0, firstAttempt: Date.now() };
  }
};

const saveRecord = (identifier: string, record: AttemptRecord): void => {
  try {
    localStorage.setItem(makeKey(identifier), JSON.stringify(record));
  } catch {
    // localStorage might be full or unavailable
  }
};

export const rateLimiter = {
  /**
   * Check if this identifier is allowed to attempt login.
   * Returns { allowed: true } or { allowed: false, remainingMinutes }.
   */
  check(identifier: string): { allowed: boolean; remainingMinutes?: number } {
    const record = getRecord(identifier);
    const now = Date.now();

    if (record.lockedUntil) {
      if (now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
        return { allowed: false, remainingMinutes };
      }
      // Lock expired — clean up
      this.reset(identifier);
    }

    return { allowed: true };
  },

  /**
   * Record a failed login attempt. Returns whether the account was just locked.
   */
  recordFailure(identifier: string): { locked: boolean; remainingAttempts: number } {
    const record = getRecord(identifier);
    const now = Date.now();

    // Reset window if expired
    if (now - record.firstAttempt > WINDOW_DURATION_MS) {
      const fresh: AttemptRecord = { count: 1, firstAttempt: now };
      saveRecord(identifier, fresh);
      return { locked: false, remainingAttempts: MAX_ATTEMPTS - 1 };
    }

    record.count++;

    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      saveRecord(identifier, record);
      return { locked: true, remainingAttempts: 0 };
    }

    saveRecord(identifier, record);
    return { locked: false, remainingAttempts: MAX_ATTEMPTS - record.count };
  },

  /**
   * Clear rate limit record after a successful login.
   */
  reset(identifier: string): void {
    try {
      localStorage.removeItem(makeKey(identifier));
    } catch {
      // ignore
    }
  },

  /**
   * Get how many attempts remain before lockout.
   */
  getRemainingAttempts(identifier: string): number {
    const record = getRecord(identifier);
    return Math.max(0, MAX_ATTEMPTS - record.count);
  },
};
