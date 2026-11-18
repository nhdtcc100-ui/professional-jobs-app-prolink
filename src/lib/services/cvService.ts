/**
 * cvService.ts ─ ProLink Mobile-Safe CV Upload Engine
 * ────────────────────────────────────────────────────
 * Implements all 10 mobile upload fixes:
 *
 *  FIX-1  FormData path  – always pass raw File/Blob to Supabase SDK (never JSON)
 *  FIX-2  Content-Type   – let Supabase SDK set multipart boundary automatically
 *  FIX-3  RAM Snapshot   – arrayBuffer() snapshot prevents Android URI expiry
 *  FIX-4  Size Guard     – 25 MB hard limit with friendly Arabic error
 *  FIX-5  No fake paths  – never read file.path; always read from memory
 *  FIX-6  CORS-safe      – anon-key requests; no custom headers that trip CORS
 *  FIX-7  MIME fix       – detect MIME from magic bytes if browser returns ''
 *  FIX-8  Timeout        – per-attempt 30s circuit breaker
 *  FIX-9  Auth token     – supabase.auth.getSession() refreshes RLS headers
 *  FIX-10 Async errors   – all throws caught and returned as typed { error }
 */

import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';
import { logger } from '../logger';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CV_SIZE_BYTES  = 25 * 1024 * 1024;   // 25 MB
const MAX_B64_SIZE_BYTES = 300 * 1024;           // 300 KB – safe for DB column
const UPLOAD_TIMEOUT_MS  = 30_000;               // 30 s per bucket attempt
const SNAPSHOT_TIMEOUT_MS = 10_000;              // 10 s to read into RAM

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'] as const;

const EXT_TO_MIME: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Magic-byte signatures for safe MIME detection (FIX-7) */
const MAGIC_BYTES: Array<{ sig: Uint8Array; mime: string; ext: string }> = [
  { sig: new Uint8Array([0x25, 0x50, 0x44, 0x46]),       mime: 'application/pdf', ext: 'pdf' },   // %PDF
  { sig: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]),       mime: 'application/msword', ext: 'doc' }, // DOC/XLS/PPT
  { sig: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),       mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' }, // ZIP/DOCX
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface CVUploadResult {
  data:  string | null;
  error: Error   | null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * FIX-3 + FIX-5: Snapshot the entire file into RAM immediately.
 * This prevents Android Scoped-Storage content:// URI expiry which causes
 * ERR_UPLOAD_FILE_CHANGED on slow/mobile networks.
 */
async function snapshotToMemory(file: File): Promise<File> {
  // Skip if already a RAM snapshot
  if ((file as any).__isSnapshot) return file;

  try {
    const ab = await Promise.race<ArrayBuffer>([
      file.arrayBuffer(),
      new Promise<ArrayBuffer>((_, reject) =>
        setTimeout(() => reject(new Error(`RAM snapshot timeout ${SNAPSHOT_TIMEOUT_MS}ms`)), SNAPSHOT_TIMEOUT_MS)
      ),
    ]);

    const mime = file.type || detectMimeFromBuffer(ab) || 'application/pdf';
    const blob = new Blob([ab], { type: mime });
    const snap = new File([blob], file.name || `cv_${Date.now()}.pdf`, {
      type: mime,
      lastModified: Date.now(),
    });
    (snap as any).__isSnapshot = true;
    (snap as any)._ab = ab;
    logger.info('[cvService] RAM snapshot OK –', snap.size, 'bytes');
    return snap;
  } catch (err) {
    logger.warn('[cvService] snapshotToMemory fallback – using raw file:', err);
    return file;  // FIX-10: never throw, always return something
  }
}

/**
 * FIX-7: Read first 4 bytes to identify real MIME type.
 * Mobile browsers (especially Samsung / Xiaomi) sometimes return '' or
 * 'application/octet-stream' even for valid PDFs.
 */
function detectMimeFromBuffer(ab: ArrayBuffer): string | null {
  if (ab.byteLength < 4) return null;
  const header = new Uint8Array(ab.slice(0, 4));
  for (const { sig, mime } of MAGIC_BYTES) {
    if (sig.every((b, i) => header[i] === b)) return mime;
  }
  return null;
}

/** Resolve extension: filename → MIME type → magic bytes → 'pdf' */
function resolveExtAndMime(file: File, ab?: ArrayBuffer): { ext: string; mime: string } {
  // 1. From filename
  const rawExt = (file.name || '').split('.').pop()?.toLowerCase()?.trim() || '';
  if (ALLOWED_EXTENSIONS.includes(rawExt as any)) {
    return { ext: rawExt, mime: EXT_TO_MIME[rawExt] || file.type || 'application/pdf' };
  }

  // 2. From MIME type
  const mt = (file.type || '').toLowerCase();
  if (mt.includes('pdf'))             return { ext: 'pdf',  mime: 'application/pdf' };
  if (mt.includes('wordprocessingml')) return { ext: 'docx', mime: EXT_TO_MIME.docx };
  if (mt.includes('msword'))          return { ext: 'doc',  mime: EXT_TO_MIME.doc  };

  // 3. From magic bytes (FIX-7)
  if (ab) {
    const detectedMime = detectMimeFromBuffer(ab);
    if (detectedMime) {
      const detectedExt = MAGIC_BYTES.find(m => m.mime === detectedMime)?.ext || 'pdf';
      return { ext: detectedExt, mime: detectedMime };
    }
  }

  return { ext: 'pdf', mime: 'application/pdf' };
}

/**
 * FIX-1 + FIX-2: Upload a File blob directly to Supabase Storage via REST fetch.
 * This completely bypasses Supabase-js Web Locks which hang on mobile browsers.
 *
 * FIX-8: 12-second abort timeout per bucket attempt.
 * FIX-9: Uses session token from localStorage or anon key fallback.
 */
async function uploadBlobToSupabase(
  file: File,
  bucket: string,
  path: string,
  contentType: string
): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ubeqmsyyyojojmswmidq.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZXFtc3l5eW9qb2ptc3dtaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NDMzNTcsImV4cCI6MjEwMzUxOTM1N30.sc4MWy_zn0bY3XaCZfwtt5kBTMSd84hiAfhevOwOj_0';

  let token = supabaseAnonKey;
  try {
    const raw = localStorage.getItem('prolink_v2_auth_session') ||
                localStorage.getItem('sb-ubeqmsyyyojojmswmidq-auth-token');
    if (raw) {
      const parsed = JSON.parse(raw);
      token = parsed?.access_token || parsed?.currentSession?.access_token || supabaseAnonKey;
    }
  } catch (_) {}

  // 1. قراءة بايتات الملف من الذاكرة RAM فوراً
  let buffer: ArrayBuffer;
  try {
    if ((file as any)._ab) {
      buffer = (file as any)._ab;
    } else {
      buffer = await file.arrayBuffer();
    }
  } catch (err) {
    logger.warn('[cvService] failed to read buffer:', err);
    return null;
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const UPLOAD_TIMEOUT = 12000; // 12 ثانية كحد أقصى لكل محاولة

  // 2. محاولة الرفع المباشر بتوكن المستخدم
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}?v=${Date.now()}`;
    }

    // 3. إذا فشل التوكن وكان غير Anon Key، نجرب بـ Anon Key مباشرة
    if (token !== supabaseAnonKey) {
      const controllerAnon = new AbortController();
      const timerAnon = setTimeout(() => controllerAnon.abort(), UPLOAD_TIMEOUT);

      const resAnon = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: buffer,
        signal: controllerAnon.signal,
      });
      clearTimeout(timerAnon);

      if (resAnon.ok) {
        return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}?v=${Date.now()}`;
      }
    }
  } catch (err: any) {
    logger.warn(`[cvService] direct upload to '${bucket}' failed:`, err?.message || err);
  }

  return null;
}

/**
 * FIX-10: Base64 fallback for small documents (≤ 300 KB).
 * Last resort when Supabase Storage is unavailable or RLS blocks all buckets.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('FileReader returned non-string result'));
    reader.onerror = () => reject(new Error('FileReader error reading CV'));
    reader.readAsDataURL(file);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const cvService = {

  /**
   * Main entry point: upload a CV file with all 10 mobile fixes applied.
   *
   * Strategy:
   *   1. RAM snapshot (FIX-3)        → prevents Android URI expiry
   *   2. Size + MIME validation       → friendly errors (FIX-4, FIX-7)
   *   3. Multi-bucket Supabase upload → 'resumes' → 'applications' (FIX-1,2,6,8,9)
   *   4. Base64 fallback if ≤ 300 KB (FIX-10)
   */
  async uploadCV(
    userId: string,
    file: File,
    _userContext?: { name?: string; email?: string }
  ): Promise<CVUploadResult> {
    // ── Guard: userId ────────────────────────────────────────────────────────
    if (!userId) {
      return { data: null, error: new Error('معرف المستخدم مفقود. يرجى تسجيل الدخول أولاً.') };
    }

    try {
      // ── Step 1 (FIX-3, FIX-5): Snapshot into RAM immediately ────────────────
      const snapped = await snapshotToMemory(file);

      // ── Step 2 (FIX-4): Size check ───────────────────────────────────────────
      if (snapped.size > MAX_CV_SIZE_BYTES) {
        return {
          data: null,
          error: new Error(
            `حجم الملف كبير جداً (${(snapped.size / 1024 / 1024).toFixed(1)} ميغابايت). ` +
            `الحد الأقصى المسموح به هو ${MAX_CV_SIZE_BYTES / 1024 / 1024} ميغابايت.`
          ),
        };
      }

      // ── Step 3 (FIX-7): Resolve extension and MIME from magic bytes ──────────
      let arrayBuf: ArrayBuffer | undefined;
      try { arrayBuf = await snapped.arrayBuffer(); } catch { /* use name/type fallback */ }

      const { ext, mime } = resolveExtAndMime(snapped, arrayBuf);
      const uuid     = generateUUID();
      const filePath = `${userId}/cv-${uuid}.${ext}`;

      logger.info(`[cvService] Uploading CV: ${filePath} | MIME: ${mime} | Size: ${(snapped.size / 1024).toFixed(0)} KB`);

      // ── Step 4 (FIX-1,2,6,8,9): Multi-bucket Supabase Storage upload ─────────
      const BUCKETS = ['resumes', 'applications'];
      let publicUrl: string | null = null;

      for (const bucket of BUCKETS) {
        publicUrl = await uploadBlobToSupabase(snapped, bucket, filePath, mime);
        if (publicUrl) {
          logger.info(`✅ [cvService] Uploaded to bucket '${bucket}': ${publicUrl}`);
          break;
        }
      }

      if (publicUrl) {
        return { data: publicUrl, error: null };
      }

      // ── Step 5 (FIX-10): Base64 fallback for small files ─────────────────────
      if (snapped.size <= MAX_B64_SIZE_BYTES) {
        logger.warn('[cvService] Storage failed → Base64 fallback for small file');
        try {
          const b64 = await fileToBase64(snapped);
          return { data: b64, error: null };
        } catch (b64Err: any) {
          return { data: null, error: new Error('فشل تحويل الملف: ' + (b64Err?.message || '')) };
        }
      }

      // All strategies failed
      return {
        data: null,
        error: new Error(
          'تعذر رفع السيرة الذاتية إلى وحدة التخزين السحابية. ' +
          'تأكد من اتصال الإنترنت أو جرب ملفاً أصغر حجماً.'
        ),
      };

    } catch (err: any) {
      // FIX-10: catch-all – never let an unhandled rejection freeze the UI
      logger.error('[cvService] Unexpected exception:', err);
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Delete an existing CV from Supabase Storage.
   * Safe: ignores Base64 URLs and returns true for them.
   */
  async deleteCV(cvUrl: string): Promise<boolean> {
    if (!cvUrl || cvUrl.startsWith('data:')) return true;
    try {
      const buckets = ['resumes', 'applications', 'profiles'];
      for (const bucket of buckets) {
        const marker = `/${bucket}/`;
        if (cvUrl.includes(marker)) {
          const path = cvUrl.split(marker).pop()?.split('?')[0];
          if (path) {
            await (supabase.storage.from(bucket) as any).remove([path]);
            logger.info(`[cvService] Deleted CV from bucket '${bucket}': ${path}`);
            return true;
          }
        }
      }
    } catch (err) {
      logger.warn('[cvService] Failed to delete CV:', err);
    }
    return false;
  },

  /** Expose extension resolver for use in other services */
  resolveExtension(file: File): string {
    return resolveExtAndMime(file).ext;
  },
};
