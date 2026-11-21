/**
 * mobileUploadService.ts
 * ─────────────────────────────────────────────────────────────────
 * Telegram / WhatsApp-style upload engine for ProLink mobile.
 *
 * Core Principles:
 *  1. INSTANT preview  – show the image/doc name in <16ms via ObjectURL or base64
 *  2. Memory-first     – snapshot the file into RAM immediately so Android
 *                        scoped-storage URI permissions never expire
 *  3. Background upload– upload happens silently after the UI update
 *  4. Dual transport   – try Supabase Storage → if blocked, compact Base64 DB column
 *  5. Progress events  – emit progress so UI can show Telegram-style progress bar
 *
 * Architecture
 *  pickAndUpload(type, opts) → { preview, uploadPromise }
 *    ├─ Pick file (native Capacitor Camera / web <input>)
 *    ├─ Snapshot into memory immediately (prevents Android URI expiry)
 *    ├─ Emit instant ObjectURL preview (0ms)
 *    ├─ [background] compress (images) / validate (docs)
 *    ├─ [background] upload with retry + presigned URL fallback
 *    └─ [background] compact Base64 fallback for small files
 */

import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';
import { snapshotFile, resolveMimeType } from './imageService';
import { cvService } from './cvService';

// ── Types ────────────────────────────────────────────────────────────────────

export type UploadType = 'avatar' | 'cover' | 'cv' | 'post-image' | 'post-video';

export interface UploadProgressEvent {
  type: UploadType;
  phase: 'picking' | 'reading' | 'compressing' | 'uploading' | 'done' | 'error';
  /** 0-100, -1 means indeterminate */
  percent: number;
  preview?: string;   // instant ObjectURL or base64 thumbnail
  url?: string;       // final persistent URL (Storage or base64)
  error?: string;
}

export type ProgressCallback = (ev: UploadProgressEvent) => void;

export interface PickAndUploadResult {
  /** Instant local preview URL (revoke when done) */
  preview: string | null;
  /** Resolves with the final persistent URL or rejects */
  uploadPromise: Promise<string>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const IMAGE_MAX_DIM = 1000;   // px
const IMAGE_QUALITY = 0.82;
const THUMB_MAX_DIM = 400;    // px – compact Base64 thumbnail (crisp on mobile retina)
const THUMB_QUALITY = 0.75;
const UPLOAD_TIMEOUT = 12_000;  // ⚡ 12s max per bucket attempt — كافٍ لرفع الصور حتى على الشبكات البطيئة

const IMAGE_BUCKETS: Record<string, string[]> = {
  avatar: ['profiles', 'images'],
  cover: ['profiles', 'images'],
  'post-image': ['profiles', 'images'],
  'post-video': ['profiles', 'images'],
};

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Convert HEIC/HEIF to JPEG if needed (iOS Safari / Camera) */
async function convertHeicIfNeeded(file: File): Promise<File> {
  const isHeic = (file.type && (file.type.includes('heic') || file.type.includes('heif'))) ||
    (file.name && /\.(heic|heif)$/i.test(file.name));
  if (!isHeic) return file;
  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default || heic2anyModule;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const newName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg');
    const out = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
    (out as any).__isSnapshot = true;
    return out;
  } catch (err) {
    console.warn('[mobileUpload] HEIC conversion warning:', err);
    return file;
  }
}

/** Downscale an in-memory image File to ≤ maxDim px using hardware GPU bitmap */
async function compressImageFile(
  file: File,
  maxDim = IMAGE_MAX_DIM,
  quality = IMAGE_QUALITY
): Promise<File> {
  if ((file as any).__isCompressed && file.size <= 400 * 1024) return file;

  // Convert HEIC before any canvas or bitmap operation
  file = await convertHeicIfNeeded(file);

  // Fast path: createImageBitmap with hardware downscale (ultra-fast sub-second decode)
  if (typeof createImageBitmap === 'function') {
    try {
      let bmp: ImageBitmap | null = null;
      try {
        // Hardware subsampling decode (fast 800ms race)
        bmp = await Promise.race([
          (createImageBitmap as any)(file, { resizeWidth: maxDim, resizeQuality: 'medium' }),
          new Promise<null>(res => setTimeout(() => res(null), 800)),
        ]);
      } catch {
        bmp = await Promise.race([
          createImageBitmap(file),
          new Promise<null>(res => setTimeout(() => res(null), 800)),
        ]);
      }

      if (bmp && bmp.width > 0) {
        let w = bmp.width, h = bmp.height;
        if (w >= h && w > maxDim) { h = Math.max(1, Math.round(h * maxDim / w)); w = maxDim; }
        else if (h > maxDim) { w = Math.max(1, Math.round(w * maxDim / h)); h = maxDim; }

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();

        let blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
        // Strict cloud payload cap: if > 600KB, re-compress to ensure lightweight payload
        if (blob && blob.size > 600 * 1024) {
          blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.65));
        }
        if (blob && blob.size > 0) {
          const out = new File([blob], (file.name || 'photo.jpg').replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg', lastModified: Date.now(),
          });
          (out as any).__isSnapshot = true;
          (out as any).__isCompressed = true;
          return out;
        }
      }
    } catch {/* fall through */ }
  }

  // Fast Canvas fallback (1200ms max)
  return new Promise<File>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); resolve(file); }, 1200);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w >= h && w > maxDim) { h = Math.max(1, Math.round(h * maxDim / w)); w = maxDim; }
      else if (h > maxDim) { w = Math.max(1, Math.round(w * maxDim / h)); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(async (blob) => {
        if (blob && blob.size > 600 * 1024) {
          blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.65));
        }
        if (blob && blob.size > 0) {
          const out = new File([blob], (file.name || 'photo.jpg').replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg', lastModified: Date.now(),
          });
          (out as any).__isSnapshot = true;
          (out as any).__isCompressed = true;
          resolve(out);
        } else {
          resolve(file);
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/** Compact to base64 JPEG for DB storage fallback (single-pass, reuse compressed file) */
async function toCompactBase64(file: File, type: UploadType = 'avatar'): Promise<string | null> {
  try {
    let targetFile = file;
    if (!(file as any).__isCompressed && file.size > 250 * 1024) {
      const maxDim = (type === 'cover' || type === 'post-image') ? 800 : THUMB_MAX_DIM;
      const quality = (type === 'cover' || type === 'post-image') ? 0.75 : THUMB_QUALITY;
      targetFile = await compressImageFile(file, maxDim, quality);
    }
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(targetFile);
    });
  } catch {
    return null;
  }
}

/** Upload a file to Supabase Storage with multi-bucket retry */
async function uploadToStorage(
  file: File,
  userId: string,
  buckets: string[],
  contentType: string
): Promise<string | null> {
  const uuid = generateUUID();
  let ext = file.name ? file.name.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
  // If ext has no dot or is invalid (e.g. Android URI "image:12345" or "blob")
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext)) {
    ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  }
  const fileName = `${userId}/${uuid}.${ext}`;

  // Quick check auth session
  try {
    await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1000)),
    ]);
  } catch { }

  // Fast bucket upload (3s max per bucket) with immediate Base64 fallback on failure
  const targetBuckets = buckets.slice(0, 2);
  for (const bucket of targetBuckets) {
    try {
      const uploadPromise = supabase.storage
        .from(bucket)
        .upload(fileName, file, { contentType, upsert: true, cacheControl: '3600' });

      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error(`Storage timeout – bucket: ${bucket}`)), UPLOAD_TIMEOUT)
      );

      const { error } = await Promise.race([uploadPromise, timeoutPromise]);

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        if (data?.publicUrl) {
          const sep = data.publicUrl.includes('?') ? '&' : '?';
          return `${data.publicUrl}${sep}t=${uuid}`;
        }
      } else {
        console.warn(`[mobileUpload] bucket '${bucket}' failed:`, error.message);
      }
    } catch (err: any) {
      console.warn(`[mobileUpload] bucket '${bucket}' exception:`, err?.message || err);
    }
  }
  return null;
}

// ── Native / Web file picker ─────────────────────────────────────────────────

/**
 * Detect if we are running inside a WebView (Android Chrome Custom Tab / iOS WKWebView).
 * On these hosts the `window.focus` event fires BEFORE the picker closes,
 * which caused a false "cancelled" detection after only 800ms.
 */
function isWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Android WebView signature
  if (/wv\b/i.test(ua) || /; ?wv\)/i.test(ua)) return true;
  // iOS WKWebView / UIWebView (no "Safari" in UA)
  if (/iphone|ipad|ipod/i.test(ua) && !/safari/i.test(ua)) return true;
  // Capacitor bridge present but not fully native
  if (typeof (window as any)?.Capacitor !== 'undefined') return true;
  return false;
}

async function pickFile(type: UploadType): Promise<File | null> {
  const isImage = type !== 'cv';
  // Accept all common image formats including HEIC/HEIF from iPhone
  const imageAccept = 'image/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
  const docAccept = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const accept = isImage ? imageAccept : docAccept;

  // ── 1. Native Capacitor Camera / Gallery (تطبيق هجين) ─────────────────────
  if (isImage && typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      // CameraSource.Prompt → يعطي المستخدم خيار الكاميرا أو المعرض كما في تلكرام
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,  // قراءة فورية في الذاكرة — يتفادى انتهاء صلاحية URI أندرويد
        source: CameraSource.Prompt,
      });
      if (!photo?.base64String) return null; // ألغى المستخدم

      // تحويل Base64 → Blob في الذاكرة فوراً
      const byteCharacters = atob(photo.base64String);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const ext = (photo.format || 'jpg').replace('jpeg', 'jpg');
      const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const blob = new Blob([byteNumbers], { type: mime });
      const f = new File([blob], `photo_${Date.now()}.${ext}`, {
        type: mime,
        lastModified: Date.now(),
      });
      (f as any).__isSnapshot = true;  // علّم الملف: تم حفظه في الذاكرة بالفعل
      return f;
    } catch (e: any) {
      // "User cancelled" ليس خطأً حقيقياً
      const msg = e?.message?.toLowerCase() ?? '';
      if (msg.includes('cancel') || msg.includes('dismissed') || msg.includes('no image')) return null;
      console.warn('[mobileUpload] Native picker failed, falling back to web <input>:', e);
      // تابع إلى مسار الويب كبديل
    }
  }

  // ── 2. Web <input type="file"> — أندرويد 11+ يفتح منتقي الصور الأصلي ─────
  return new Promise<File | null>(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // لا نضع capture="" لأن أندرويد يعرض المعرض كخيار افتراضي
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(input);

    let handled = false;
    const finish = (f: File | null) => {
      if (handled) return;
      handled = true;
      window.removeEventListener('focus', onWindowFocus);
      try { document.body.removeChild(input); } catch { }
      resolve(f);
    };

    // onChange: المستخدم اختار ملفاً — النجاح الحقيقي الوحيد
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      finish(file);
    };

    // ── كاشف الإلغاء الذكي ───────────────────────────────────────────────────
    // المشكلة: في أندرويد WebView يصل حدث focus قبل أن يُغلق الـ picker بثوانٍ،
    // لذا نستخدم تأخيراً طويلاً (1500ms) فقط خارج WebView؛ وداخل WebView نعتمد
    // فقط على onChange لأن focus لا يُعبّر عن الإلغاء بشكل موثوق.
    const CANCEL_DELAY = isWebView() ? 60_000 : 1500; // WebView → لا نستخدم focus كمؤشر إلغاء

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const onWindowFocus = () => {
      if (handled) return;
      // ننتظر قبل الحكم بالإلغاء — منتقي المعرض قد يستغرق ثوانٍ قبل إغلاقه
      focusTimer = setTimeout(() => {
        if (!handled && (!input.files || input.files.length === 0)) {
          finish(null); // المستخدم أغلق المنتقي فعلاً دون اختيار
        }
      }, CANCEL_DELAY);
    };

    // لا نسجّل مستمع focus داخل WebView — onChange وحده كافٍ هناك
    if (!isWebView()) {
      window.addEventListener('focus', onWindowFocus);
    }

    // مهلة أمان نهائية: 3 دقائق — إذا لم يحدث شيء نعامله كإلغاء
    setTimeout(() => finish(null), 180_000);

    input.click();
  });
}

// ── Main API ─────────────────────────────────────────────────────────────────

export const mobileUploadService = {
  /**
   * Pick and prepare a file from Camera or Gallery/Files without initiating network upload.
   * Useful when the file should be previewed first and uploaded only on form submit.
   */
  async pickFile(type: UploadType): Promise<File | null> {
    const rawFile = await pickFile(type);
    if (!rawFile) return null;
    try {
      return await snapshotFile(rawFile);
    } catch {
      return rawFile;
    }
  },

  /**
   * Telegram-style pick + instant preview + background upload.
   *
   * Usage:
   *   const { preview, uploadPromise } = await mobileUploadService.pickAndUpload('avatar', { userId });
   *   setAvatarPreview(preview);          // instant – shown immediately
   *   const url = await uploadPromise;    // background – final persistent URL
   *   saveToDatabase(url);
   */
  async pickAndUpload(
    type: UploadType,
    opts: {
      userId: string;
      onProgress?: ProgressCallback;
      userContext?: { name?: string; email?: string };
    }
  ): Promise<PickAndUploadResult> {
    const { userId, onProgress, userContext } = opts;
    const emit = (ev: UploadProgressEvent) => onProgress?.(ev);

    emit({ type, phase: 'picking', percent: 0 });

    // 1. Pick file
    const rawFile = await pickFile(type);
    if (!rawFile) {
      // User cancelled
      return {
        preview: null,
        uploadPromise: Promise.reject(new Error('cancelled')),
      };
    }

    emit({ type, phase: 'reading', percent: 5 });

    // 2. Snapshot into memory IMMEDIATELY (prevents Android URI permission expiry)
    let workingFile: File;
    try {
      workingFile = await snapshotFile(rawFile);
    } catch {
      workingFile = rawFile;
    }

    // 3. Create instant ObjectURL preview for immediate UI feedback (Telegram UX)
    let preview: string | null = null;
    if (type !== 'cv') {
      try { preview = URL.createObjectURL(workingFile); } catch { }
    }
    emit({ type, phase: 'compressing', percent: 20, preview: preview ?? undefined });

    // 4. Background upload promise
    const uploadPromise = (async (): Promise<string> => {
      try {
        // 4a. CV documents → delegate to cvService (has its own multi-bucket logic)
        if (type === 'cv') {
          emit({ type, phase: 'uploading', percent: 40 });
          const { data: url, error } = await cvService.uploadCV(userId, workingFile, userContext);
          if (error || !url) throw error || new Error('CV upload failed');
          emit({ type, phase: 'done', percent: 100, url });
          return url;
        }

        // 4b. Images (avatar / cover / post-image)
        const isImageType = type !== 'post-video';
        const targetDim = type === 'avatar' ? 400 : (type === 'cover' ? 1200 : IMAGE_MAX_DIM);
        const targetQuality = type === 'avatar' ? 0.85 : (type === 'cover' ? 0.82 : IMAGE_QUALITY);

        // Compress and normalize to JPEG
        let uploadFile = workingFile;
        if (isImageType) {
          const isHeic = (workingFile.type && (workingFile.type.includes('heic') || workingFile.type.includes('heif'))) ||
                         (workingFile.name && /\.(heic|heif)$/i.test(workingFile.name));
          if (!(workingFile as any).__isCompressed || isHeic || type === 'avatar' || type === 'cover' || workingFile.size > 300 * 1024) {
            emit({ type, phase: 'compressing', percent: 30 });
            uploadFile = await compressImageFile(workingFile, targetDim, targetQuality);
          }
        }
        const contentType = uploadFile.type || resolveMimeType(uploadFile) || 'image/jpeg';

        emit({ type, phase: 'uploading', percent: 50 });

        // Strategy 1: Supabase Storage (multi-bucket)
        const buckets = IMAGE_BUCKETS[type] ?? ['profiles'];
        const storageUrl = await uploadToStorage(uploadFile, userId, buckets, contentType);

        if (storageUrl) {
          // Revoke the temporary ObjectURL now that we have a permanent URL
          if (preview) { try { URL.revokeObjectURL(preview); } catch { } }
          emit({ type, phase: 'done', percent: 100, url: storageUrl });
          return storageUrl;
        }

        // Strategy 2: Compact Base64 thumbnail in DB (WhatsApp compressed preview fallback)
        console.warn('[mobileUpload] Storage failed → compact Base64 fallback');
        emit({ type, phase: 'uploading', percent: 75 });
        const b64 = await toCompactBase64(uploadFile, type);
        if (b64) {
          if (preview) { try { URL.revokeObjectURL(preview); } catch { } }
          emit({ type, phase: 'done', percent: 100, url: b64 });
          return b64;
        }

        throw new Error('All upload strategies failed');
      } catch (err: any) {
        if (preview) { try { URL.revokeObjectURL(preview); } catch { } }
        emit({ type, phase: 'error', percent: 0, error: err?.message });
        throw err;
      }
    })();

    return { preview, uploadPromise };
  },

  /**
   * Convenience: upload an already-picked File directly (no picker dialog).
   * Useful for <input> onChange handlers where the file is already available.
   */
  async uploadFile(
    file: File,
    type: UploadType,
    userId: string,
    opts?: {
      onProgress?: ProgressCallback;
      userContext?: { name?: string; email?: string };
    }
  ): Promise<{ preview: string | null; uploadPromise: Promise<string> }> {
    const { onProgress, userContext } = opts ?? {};
    const emit = (ev: UploadProgressEvent) => onProgress?.(ev);

    emit({ type, phase: 'reading', percent: 5 });

    // Snapshot immediately
    let workingFile: File;
    try { workingFile = await snapshotFile(file); }
    catch { workingFile = file; }

    // Instant preview
    let preview: string | null = null;
    if (type !== 'cv') {
      try { preview = URL.createObjectURL(workingFile); } catch { }
    }

    emit({ type, phase: 'compressing', percent: 20, preview: preview ?? undefined });

    const uploadPromise = (async (): Promise<string> => {
      try {
        if (type === 'cv') {
          emit({ type, phase: 'uploading', percent: 40 });
          const { data: url, error } = await cvService.uploadCV(userId, workingFile, userContext);
          if (error || !url) throw error || new Error('CV upload failed');
          emit({ type, phase: 'done', percent: 100, url });
          return url;
        }

        const isImageType = type !== 'post-video';
        const targetDim = type === 'avatar' ? 400 : (type === 'cover' ? 1200 : IMAGE_MAX_DIM);
        const targetQuality = type === 'avatar' ? 0.85 : (type === 'cover' ? 0.82 : IMAGE_QUALITY);

        let uploadFile = workingFile;
        if (isImageType) {
          const isHeic = (workingFile.type && (workingFile.type.includes('heic') || workingFile.type.includes('heif'))) ||
                         (workingFile.name && /\.(heic|heif)$/i.test(workingFile.name));
          if (!(workingFile as any).__isCompressed || isHeic || type === 'avatar' || type === 'cover' || workingFile.size > 300 * 1024) {
            emit({ type, phase: 'compressing', percent: 30 });
            uploadFile = await compressImageFile(workingFile, targetDim, targetQuality);
          }
        }
        const contentType = uploadFile.type || resolveMimeType(uploadFile) || 'image/jpeg';

        emit({ type, phase: 'uploading', percent: 50 });
        const buckets = IMAGE_BUCKETS[type] ?? ['profiles'];
        const storageUrl = await uploadToStorage(uploadFile, userId, buckets, contentType);

        if (storageUrl) {
          if (preview) { setTimeout(() => { try { URL.revokeObjectURL(preview); } catch { } }, 10000); }
          emit({ type, phase: 'done', percent: 100, url: storageUrl });
          return storageUrl;
        }

        emit({ type, phase: 'uploading', percent: 75 });
        const b64 = await toCompactBase64(uploadFile, type);
        if (b64) {
          if (preview) { setTimeout(() => { try { URL.revokeObjectURL(preview); } catch { } }, 10000); }
          emit({ type, phase: 'done', percent: 100, url: b64 });
          return b64;
        }

        throw new Error('All upload strategies exhausted');
      } catch (err: any) {
        if (preview) { try { URL.revokeObjectURL(preview); } catch { } }
        emit({ type, phase: 'error', percent: 0, error: err?.message });
        throw err;
      }
    })();

    return { preview, uploadPromise };
  },
};