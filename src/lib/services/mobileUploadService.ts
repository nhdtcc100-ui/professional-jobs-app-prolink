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

const IMAGE_MAX_DIM  = 1000;   // px
const IMAGE_QUALITY  = 0.82;
const THUMB_MAX_DIM  = 200;    // px – compact Base64 thumbnail
const THUMB_QUALITY  = 0.55;
const UPLOAD_TIMEOUT = 30_000; // 30 s per bucket attempt

const IMAGE_BUCKETS: Record<string, string[]> = {
  avatar:       ['profiles'],
  cover:        ['profiles'],
  'post-image': ['posts', 'images'],
  'post-video': ['posts'],
};

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Downscale an in-memory image File to ≤ maxDim px using hardware GPU bitmap */
async function compressImageFile(
  file: File,
  maxDim = IMAGE_MAX_DIM,
  quality = IMAGE_QUALITY
): Promise<File> {
  // Fast path: createImageBitmap (hardware-accelerated on Android Chrome / WebView)
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await Promise.race([
        createImageBitmap(file),
        new Promise<null>(res => setTimeout(() => res(null), 8000)),
      ]);
      if (bmp && bmp.width > 0) {
        let w = bmp.width, h = bmp.height;
        if (w >= h && w > maxDim) { h = Math.max(1, Math.round(h * maxDim / w)); w = maxDim; }
        else if (h > maxDim)      { w = Math.max(1, Math.round(w * maxDim / h)); h = maxDim; }

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();

        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
        if (blob && blob.size > 0) {
          const out = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg', lastModified: Date.now(),
          });
          (out as any).__isSnapshot = true;
          return out;
        }
      }
    } catch {/* fall through */}
  }

  // Slow path: Image + Canvas
  return new Promise<File>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); resolve(file); }, 12000);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w >= h && w > maxDim) { h = Math.max(1, Math.round(h * maxDim / w)); w = maxDim; }
      else if (h > maxDim)      { w = Math.max(1, Math.round(w * maxDim / h)); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob && blob.size > 0) {
          const out = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg', lastModified: Date.now(),
          });
          (out as any).__isSnapshot = true;
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

/** Compact to a tiny base64 JPEG thumbnail for DB storage (≈ 8-15 KB) */
async function toCompactBase64(file: File): Promise<string | null> {
  try {
    const compressed = await compressImageFile(file, THUMB_MAX_DIM, THUMB_QUALITY);
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(compressed);
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
  const uuid     = generateUUID();
  const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}/${uuid}.${ext}`;

  // Ensure auth session headers are fresh (required for Storage RLS)
  try { await supabase.auth.getSession(); } catch {}

  for (const bucket of buckets) {
    try {
      const uploadPromise = supabase.storage
        .from(bucket)
        .upload(fileName, file, { contentType, upsert: true, cacheControl: '3600' });

      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error(`Storage timeout (${UPLOAD_TIMEOUT / 1000}s) – bucket: ${bucket}`)), UPLOAD_TIMEOUT)
      );

      const { error } = await Promise.race([uploadPromise, timeoutPromise]);

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        if (data?.publicUrl) {
          // Cache-bust so fresh image always loads
          const sep = data.publicUrl.includes('?') ? '&' : '?';
          return `${data.publicUrl}${sep}t=${uuid}`;
        }
      } else {
        console.warn(`[mobileUpload] bucket '${bucket}' failed:`, error.message);
      }
    } catch (err) {
      console.warn(`[mobileUpload] bucket '${bucket}' exception:`, err);
    }
  }
  return null;
}

// ── Native / Web file picker ─────────────────────────────────────────────────

async function pickFile(type: UploadType): Promise<File | null> {
  const isImage = type !== 'cv';
  const accept  = isImage ? 'image/*' : '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // 1. Native Capacitor Camera / Gallery for images
  if (isImage && typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });
      if (photo?.webPath) {
        const res  = await fetch(photo.webPath);
        const blob = await res.blob();
        const ext  = photo.format || 'jpg';
        const f    = new File([blob], `photo_${Date.now()}.${ext}`, {
          type: blob.type || `image/${ext}`, lastModified: Date.now(),
        });
        (f as any).__isSnapshot = true;
        return f;
      }
      return null;
    } catch (e: any) {
      if (e?.message?.includes('cancel') || e?.message?.includes('User cancel')) return null;
      console.warn('[mobileUpload] Native picker error, fallback to web:', e);
    }
  }

  // 2. Web <input type="file"> – opens native photo picker on Android 11+
  return new Promise<File | null>(resolve => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = accept;
    // capture="" removed intentionally so Android shows Gallery, not Camera
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:0;left:0;width:1px;height:1px;';
    document.body.appendChild(input);

    let handled = false;
    const finish = (f: File | null) => {
      if (handled) return;
      handled = true;
      try { document.body.removeChild(input); } catch {}
      resolve(f);
    };

    input.onchange = () => finish(input.files?.[0] ?? null);
    // User cancelled (focus returns without selection)
    const onFocus = () => {
      setTimeout(() => {
        if (!handled && (!input.files || input.files.length === 0)) finish(null);
      }, 800);
      window.removeEventListener('focus', onFocus);
    };
    window.addEventListener('focus', onFocus);

    setTimeout(() => finish(null), 120_000);
    input.click();
  });
}

// ── Main API ─────────────────────────────────────────────────────────────────

export const mobileUploadService = {
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
      try { preview = URL.createObjectURL(workingFile); } catch {}
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
        const contentType = resolveMimeType(workingFile);

        // Compress if needed (skip if already small snapshot ≤ 300 KB)
        let uploadFile = workingFile;
        if (isImageType && !(workingFile as any).__isCompressed && workingFile.size > 300 * 1024) {
          emit({ type, phase: 'compressing', percent: 30 });
          uploadFile = await compressImageFile(workingFile);
        }

        emit({ type, phase: 'uploading', percent: 50 });

        // Strategy 1: Supabase Storage (multi-bucket)
        const buckets = IMAGE_BUCKETS[type] ?? ['profiles'];
        const storageUrl = await uploadToStorage(uploadFile, userId, buckets, contentType);

        if (storageUrl) {
          // Revoke the temporary ObjectURL now that we have a permanent URL
          if (preview) { try { URL.revokeObjectURL(preview); } catch {} }
          emit({ type, phase: 'done', percent: 100, url: storageUrl });
          return storageUrl;
        }

        // Strategy 2: Compact Base64 thumbnail in DB (WhatsApp compressed preview fallback)
        console.warn('[mobileUpload] Storage failed → compact Base64 fallback');
        emit({ type, phase: 'uploading', percent: 75 });
        const b64 = await toCompactBase64(uploadFile);
        if (b64) {
          if (preview) { try { URL.revokeObjectURL(preview); } catch {} }
          emit({ type, phase: 'done', percent: 100, url: b64 });
          return b64;
        }

        throw new Error('All upload strategies failed');
      } catch (err: any) {
        if (preview) { try { URL.revokeObjectURL(preview); } catch {} }
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
      try { preview = URL.createObjectURL(workingFile); } catch {}
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

        const contentType = resolveMimeType(workingFile);
        let uploadFile = workingFile;
        if (!(workingFile as any).__isCompressed && workingFile.size > 300 * 1024) {
          emit({ type, phase: 'compressing', percent: 30 });
          uploadFile = await compressImageFile(workingFile);
        }

        emit({ type, phase: 'uploading', percent: 50 });
        const buckets = IMAGE_BUCKETS[type] ?? ['profiles'];
        const storageUrl = await uploadToStorage(uploadFile, userId, buckets, contentType);

        if (storageUrl) {
          if (preview) { try { URL.revokeObjectURL(preview); } catch {} }
          emit({ type, phase: 'done', percent: 100, url: storageUrl });
          return storageUrl;
        }

        emit({ type, phase: 'uploading', percent: 75 });
        const b64 = await toCompactBase64(uploadFile);
        if (b64) {
          if (preview) { try { URL.revokeObjectURL(preview); } catch {} }
          emit({ type, phase: 'done', percent: 100, url: b64 });
          return b64;
        }

        throw new Error('All upload strategies exhausted');
      } catch (err: any) {
        if (preview) { try { URL.revokeObjectURL(preview); } catch {} }
        emit({ type, phase: 'error', percent: 0, error: err?.message });
        throw err;
      }
    })();

    return { preview, uploadPromise };
  },
};