/**
 * sanitize.ts
 * ─────────────────────────────────────────────────────────────
 * Central XSS sanitisation utilities (defense-in-depth).
 * React already escapes rendered text; these helpers strip dangerous
 * tags/protocols from user input before storage and log XSS attempts.
 * SQL injection is not possible through parameterized Supabase queries,
 * so no SQL keyword blocking is performed here.
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

  // SQLi scanning removed: Supabase REST queries are parameterized, and the
  // regex WAF produced false CRITICAL alerts on ordinary text.

  // Preserve user spacing during active typing (no trailing trim).
  // React escapes rendered text; this strip is defense-in-depth for dangerous tags/protocols.
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(iframe|object|embed|svg|math|link|meta|base|form|style)[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
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
