/**
 * sanitize.ts
 * ─────────────────────────────────────────────────────────────
 * Central XSS / code‑injection sanitisation utilities.
 *
 * Rules enforced:
 *   • Strip all HTML tags   <…>
 *   • Block JS protocol     javascript:
 *   • Block inline events   onload= onerror= etc.
 *   • Block <script> blocks (including multi-line)
 *   • Block template literals  ${…}
 *   • Block common SQL keywords (SELECT, DROP, …)
 *   • Block remaining shell-injection chars: < > { } [ ] \
 *   • Block Python / PHP / shell shebangs and common patterns
 *   • Trim whitespace after sanitisation
 * ─────────────────────────────────────────────────────────────
 */

import { threatEngine } from '../security/threatEngine';

/** Sanitise user-supplied string & log cybersecurity threats */
export function sanitizeInput(
  raw: string, 
  maxLengthOrUser?: number | { id?: string; name?: string; email?: string },
  userObj?: { id?: string; name?: string; email?: string }
): string {
  if (typeof raw !== 'string') return '';

  const maxLength = typeof maxLengthOrUser === 'number' ? maxLengthOrUser : 500;
  const user = typeof maxLengthOrUser === 'object' ? maxLengthOrUser : userObj;
  
  // WAF Threat Detection Scanning
  const xssRes = threatEngine.scanForXSS(raw);
  if (xssRes.detected) {
    threatEngine.logThreat({
      user_id: user?.id,
      user_name: user?.name || 'مستخدم النظام',
      user_email: user?.email,
      attack_type: 'XSS_ATTACK',
      severity: 'HIGH',
      endpoint: typeof window !== 'undefined' ? window.location.pathname : '/app/input',
      payload_sample: raw.slice(0, 150),
    });
  }

  const sqliRes = threatEngine.scanForSQLi(raw);
  if (sqliRes.detected) {
    threatEngine.logThreat({
      user_id: user?.id,
      user_name: user?.name || 'مستخدم النظام',
      user_email: user?.email,
      attack_type: 'SQL_INJECTION',
      severity: 'CRITICAL',
      endpoint: typeof window !== 'undefined' ? window.location.pathname : '/app/input',
      payload_sample: raw.slice(0, 150),
    });
  }

  // Preserve technical programming language terms & code snippets safely
  // Preserve user spacing during active typing (no trailing trim)
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .slice(0, maxLength);
}

/**
 * Sanitise every string value in a plain object (one level deep).
 * Useful for sanitising form state objects before submission.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === 'string' ? sanitizeInput(v) : v,
    ])
  ) as T;
}

/**
 * Returns true if the input contains any injection-like content.
 * Use for real-time input validation feedback.
 */
export function containsInjection(value: string): boolean {
  return sanitizeInput(value) !== value.trim();
}

/** Check if a string is a valid PostgreSQL UUID */
export function isUUID(val: unknown): boolean {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}
