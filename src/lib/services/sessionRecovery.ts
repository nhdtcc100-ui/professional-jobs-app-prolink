import { supabase } from '../supabase';
import { concurrencyMutex } from './concurrencyMutex';
import { idempotencyEngine } from './idempotencyEngine';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PROLINK LIFECYCLE & SESSION RESILIENCE ENGINE                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Ensures that whenever a user leaves the app/browser tab and returns:
 * 1. Stale in-memory concurrency locks & idempotency queues are reset immediately.
 * 2. Supabase auth session is checked and proactively refreshed before tokens expire.
 * 3. Database operations (posting jobs, applying, accepting, creating posts)
 *    transparently recover from expired tokens or connection drops without
 *    ever requiring the user to refresh the page.
 */

let isRefreshingSession = false;
let lastRefreshTime = 0;

/**
 * Validates the current Supabase session and proactively refreshes
 * it if it is expired or expiring within 120 seconds.
 */
export async function ensureFreshSession(): Promise<boolean> {
  const now = Date.now();
  // Don't hammer refreshSession within 5 seconds
  if (isRefreshingSession || (now - lastRefreshTime < 5000)) {
    return true;
  }

  isRefreshingSession = true;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[SessionRecovery] getSession error:', error.message);
    }

    if (!session) {
      // User might be a guest or logged out; try to refresh once
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed.session) {
        lastRefreshTime = Date.now();
        return true;
      }
      return false;
    }

    const expiresAt = (session.expires_at || 0) * 1000;
    const isExpiredOrStale = expiresAt > 0 && (expiresAt - now < 120_000);

    if (isExpiredOrStale) {
      console.log('[SessionRecovery] Session near expiry or stale. Refreshing token...');
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.warn('[SessionRecovery] Token refresh failed:', refreshErr.message);
        return false;
      }
      if (refreshed.session) {
        lastRefreshTime = Date.now();
        console.log('[SessionRecovery] Session refreshed successfully.');
      }
    }

    return true;
  } catch (err) {
    console.warn('[SessionRecovery] Unexpected session validation error:', err);
    return false;
  } finally {
    isRefreshingSession = false;
  }
}

/**
 * Resets all background blockers whenever the app wakes up or reconnects.
 */
export function resetStuckLocksAndQueues() {
  try {
    concurrencyMutex.clearAll();
    idempotencyEngine.clearInFlight();
  } catch (e) {
    console.warn('[SessionRecovery] Error resetting stuck locks:', e);
  }
}

/**
 * Checks whether an error is caused by an expired token, authentication issue, or connection drop.
 */
export function isSessionOrAuthError(error: any): boolean {
  if (!error) return false;
  const msg = (error?.message || error?.details || error?.error_description || String(error)).toLowerCase();
  const code = String(error?.code || error?.status || '');

  // 🛡️ استبعاد أخطاء مفاتيح الربط وأعمدة المؤلف: author_id أو posts_author_id_fkey ليست أخطاء جلسة أو مصادقة
  if (
    code === '23503' || 
    code === '22P02' ||
    msg.includes('foreign key') ||
    msg.includes('author_id') ||
    msg.includes('posts_author_id_fkey')
  ) {
    return false;
  }

  return (
    code === '401' ||
    code === '403' ||
    code === 'PGRST301' ||
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('expired') ||
    msg.includes('unauthorized') ||
    msg.includes('session') ||
    /\bauth\b/i.test(msg) ||
    msg.includes('authentication') ||
    msg.includes('not authenticated') ||
    msg.includes('permission denied') ||
    msg.includes('connection') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
}

/**
 * Wraps any database mutation (job post, job apply, post create, update, etc.)
 * with automatic session refresh and seamless single-retry if the token had expired.
 */
export async function withSessionRecovery<T>(operation: () => Promise<T>): Promise<T> {
  // 1. Proactively ensure fresh session & clear stuck locks before starting
  resetStuckLocksAndQueues();
  await ensureFreshSession().catch(() => {});

  try {
    const result: any = await operation();

    // If result is a Supabase response containing an auth/session error
    if (result && result.error && isSessionOrAuthError(result.error)) {
      console.warn('[SessionRecovery] Operation returned session/auth error. Refreshing and retrying once...', result.error);
      resetStuckLocksAndQueues();
      try {
        await supabase.auth.refreshSession();
      } catch (_) {}
      // Retry the operation with the fresh token
      return await operation();
    }

    return result;
  } catch (err: any) {
    if (isSessionOrAuthError(err)) {
      console.warn('[SessionRecovery] Operation threw session/auth error. Refreshing and retrying once...', err);
      resetStuckLocksAndQueues();
      try {
        await supabase.auth.refreshSession();
      } catch (_) {}
      return await operation();
    }
    throw err;
  }
}

// ── Global Wakeup & Return-to-App Listeners ─────────────────────────────────
if (typeof window !== 'undefined') {
  const onWakeup = async () => {
    resetStuckLocksAndQueues();
    if (document.visibilityState === 'visible') {
      await ensureFreshSession();
    }
  };

  document.addEventListener('visibilitychange', onWakeup);
  window.addEventListener('focus', onWakeup);
  window.addEventListener('online', onWakeup);

  // Capacitor App lifecycle (native iOS / Android)
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    (new Function('m', 'return import(m)'))('@capacitor/app')
      .then((mod: any) => {
        if (mod?.App) {
          mod.App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
            if (isActive) {
              onWakeup();
            }
          });
        }
      })
      .catch(() => {});
  } catch (_) {}
}
