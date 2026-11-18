import { generateUUID } from '../security/distributedId';
import { cvService } from './cvService';
import { readUploadFile, uploadToStorageDirect } from './directUpload';
import { withTimeout } from '../utils/withTimeout';

export type UploadType = 'avatar' | 'cover' | 'cv' | 'post-image' | 'post-video';

export interface UploadProgressEvent {
  type: UploadType;
  phase: 'picking' | 'reading' | 'compressing' | 'uploading' | 'done' | 'error';
  percent: number;
  preview?: string;
  url?: string;
  error?: string;
}

export type ProgressCallback = (ev: UploadProgressEvent) => void;

export interface PickAndUploadResult {
  // The caller owns this URL and must revoke it after its last render, including on failure.
  preview: string | null;
  uploadPromise: Promise<string>;
}

const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;
const READ_TIMEOUT_MS = 10_000;
const COMPRESSION_TIMEOUT_MS = 15_000;
const PICKER_TIMEOUT_MS = 120_000;
const IMAGE_MAX_DIM = 1000;

const MEDIA_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
  '3gp': 'video/3gpp', '3g2': 'video/3gpp2', avi: 'video/x-msvideo',
  ogv: 'video/ogg', mpg: 'video/mpeg', mpeg: 'video/mpeg',
};

function mediaFormat(file: File, type: UploadType): { contentType: string; extension: string } {
  const nameExtension = /\.([^.]+)$/.exec(file.name || '')?.[1].toLowerCase() || '';
  let contentType = file.type.toLowerCase().split(';')[0].trim();
  if (!contentType || contentType === 'application/octet-stream') {
    contentType = Object.hasOwn(MEDIA_MIME, nameExtension) ? MEDIA_MIME[nameExtension] : '';
  }
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  const extension = Object.keys(MEDIA_MIME).find(ext => MEDIA_MIME[ext] === contentType);
  const prefix = type === 'post-video' ? 'video/' : 'image/';
  if (!extension || !contentType.startsWith(prefix)) {
    throw new Error(type === 'post-video' ? 'اختر ملف فيديو مدعوماً.' : 'اختر ملف صورة مدعوماً.');
  }
  return { contentType, extension };
}

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

async function compressImageFile(file: File): Promise<File> {
  const resources: { image?: HTMLImageElement; canvas?: HTMLCanvasElement; objectUrl?: string } = {};
  let finished = false;
  const errorMessage = 'تعذرت معالجة الصورة. جرّب صورة أخرى أو حوّلها إلى JPEG.';
  const processing = (async () => {
    if (isHeic(file)) {
      const { default: heic2any } = await import('heic2any');
      if (finished) throw new Error(errorMessage);
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      if (!blob?.size) throw new Error(errorMessage);
      file = new File([blob], 'photo.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
    }
    if (finished) throw new Error(errorMessage);
    const image = resources.image = new Image();
    const objectUrl = resources.objectUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(errorMessage));
      image.src = objectUrl;
    });
    if (finished || !image.naturalWidth || !image.naturalHeight) throw new Error(errorMessage);
    const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = resources.canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error(errorMessage);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    let blob = await encode(0.82);
    if (finished) throw new Error(errorMessage);
    if (blob && blob.size > 800 * 1024) blob = await encode(0.65);
    if (finished || !blob?.size) throw new Error(errorMessage);
    return new File([blob], 'photo.jpg', { type: blob.type, lastModified: file.lastModified });
  })();
  try {
    return await withTimeout(processing, COMPRESSION_TIMEOUT_MS, errorMessage);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('TIMEOUT:')) throw error;
    throw new Error(errorMessage);
  } finally {
    finished = true;
    const { image, canvas, objectUrl } = resources;
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.src = '';
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

async function pickFile(type: UploadType): Promise<File | null> {
  const isImage = type !== 'cv' && type !== 'post-video';
  const capacitor = (window as any).Capacitor;
  if (isImage && capacitor?.isNativePlatform?.()) {
    let finished = false;
    try {
      return await withTimeout((async () => {
        const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
        if (finished) return null;
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Prompt,
        });
        if (finished || !photo?.base64String) return null;
        if (photo.base64String.length > Math.ceil(MAX_MEDIA_SIZE_BYTES / 3) * 4) {
          throw new Error('حجم الملف يجب ألا يتجاوز 50 ميغابايت.');
        }
        const characters = atob(photo.base64String);
        const bytes = new Uint8Array(characters.length);
        for (let index = 0; index < characters.length; index++) bytes[index] = characters.charCodeAt(index);
        const extension = (photo.format || 'jpeg').toLowerCase();
        return new File([bytes], `photo.${extension}`, {
          type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
          lastModified: Date.now(),
        });
      })(), PICKER_TIMEOUT_MS, 'انتهت مهلة اختيار الصورة. حاول مجدداً.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String((error as any)?.message || error);
      if (/cancel|dismiss|aborted/i.test(`${(error as any)?.code || ''} ${message}`)) return null;
      throw error;
    } finally {
      finished = true;
    }
  }

  return new Promise<File | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'post-video' ? 'video/*' : isImage ? 'image/*'
      : '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:0;left:0;width:1px;height:1px;';
    document.body.appendChild(input);

    let handled = false;
    let pickerTimer: ReturnType<typeof setTimeout> | undefined;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (file: File | null, error?: unknown) => {
      if (handled) return;
      handled = true;
      clearTimeout(pickerTimer);
      clearTimeout(focusTimer);
      window.removeEventListener('focus', onFocus);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove();
      if (error) reject(error);
      else resolve(file);
    };
    const onChange = () => finish(input.files?.[0] ?? null);
    const onCancel = () => finish(null);
    const onFocus = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => finish(input.files?.[0] ?? null), 800);
    };
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onFocus, { once: true });
    pickerTimer = setTimeout(() => finish(null, new Error('انتهت مهلة اختيار الملف. حاول مجدداً.')), PICKER_TIMEOUT_MS);
    try { input.click(); } catch (error) { finish(null, error); }
  });
}

export const mobileUploadService = {
  async pickAndUpload(
    type: UploadType,
    opts: {
      userId: string;
      onProgress?: ProgressCallback;
      userContext?: { name?: string; email?: string };
    }
  ): Promise<PickAndUploadResult> {
    opts.onProgress?.({ type, phase: 'picking', percent: 0 });
    let file: File | null;
    try {
      file = await pickFile(type);
      if (!file) throw new Error('cancelled');
    } catch (error) {
      opts.onProgress?.({ type, phase: 'error', percent: 0, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    return mobileUploadService.uploadFile(file, type, opts.userId, opts);
  },

  async uploadFile(
    file: File,
    type: UploadType,
    userId: string,
    opts?: {
      onProgress?: ProgressCallback;
      userContext?: { name?: string; email?: string };
    }
  ): Promise<{ preview: string | null; uploadPromise: Promise<string> }> {
    const emit = (event: UploadProgressEvent) => opts?.onProgress?.(event);
    let workingFile = file;
    let preview: string | null = null;
    try {
      if (!userId?.trim()) throw new Error('يرجى تسجيل الدخول أولاً.');
      if (!file?.size) throw new Error('الملف فارغ أو غير قابل للقراءة.');
      const maxSize = type === 'cv' ? 25 * 1024 * 1024 : MAX_MEDIA_SIZE_BYTES;
      if (file.size > maxSize) throw new Error(`حجم الملف يجب ألا يتجاوز ${maxSize / 1024 / 1024} ميغابايت.`);
      emit({ type, phase: 'reading', percent: 5 });
      if (type !== 'cv') {
        mediaFormat(file, type);
        workingFile = await readUploadFile(file, READ_TIMEOUT_MS);
        preview = URL.createObjectURL(workingFile);
      }
    } catch (error) {
      emit({ type, phase: 'error', percent: 0, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }

    const uploadPromise = (async (): Promise<string> => {
      try {
        let url: string;
        if (type === 'cv') {
          emit({ type, phase: 'uploading', percent: 40 });
          const result = await cvService.uploadCV(userId, file, opts?.userContext);
          if (result.error || !result.data) throw result.error || new Error('تعذر رفع السيرة الذاتية.');
          url = result.data;
        } else {
          if (type !== 'post-video' && (workingFile.size > 300 * 1024 || isHeic(workingFile))) {
            emit({ type, phase: 'compressing', percent: 30, preview: preview ?? undefined });
            workingFile = await compressImageFile(workingFile);
          }
          const { contentType, extension } = mediaFormat(workingFile, type);
          emit({ type, phase: 'uploading', percent: 50, preview: preview ?? undefined });
          url = await uploadToStorageDirect(workingFile, {
            bucket: type === 'avatar' || type === 'cover' ? 'profiles' : 'posts',
            path: `${userId}/${generateUUID()}.${extension}`,
            contentType,
          });
        }
        emit({ type, phase: 'done', percent: 100, url });
        return url;
      } catch (error) {
        emit({ type, phase: 'error', percent: 0, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    })();
    // Observe early failures before the caller receives the nested promise, without changing its result.
    void uploadPromise.catch(() => {});
    return { preview, uploadPromise };
  },
};
