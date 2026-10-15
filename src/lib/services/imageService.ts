import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/heic', 'image/heif', 'image/bmp'];
const ALLOWED_DOC_TYPES   = ['application/pdf'];
const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (auto-compressed before upload)
const MAX_DOC_SIZE_BYTES   = 20 * 1024 * 1024; // 20 MB

/** Resolve effective MIME type — handles mobile album photos where type is empty */
export const resolveMimeType = (file: File): string => {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const extMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    heic: 'image/heic', heif: 'image/heif',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return extMap[ext] || 'image/jpeg'; // default to jpeg for camera/album photos
};

/**
 * Safely snapshots any File selected from mobile Android / iOS or Desktop.
 * Immediately reads the file into an in-memory ArrayBuffer.
 * This completely isolates the file from the OS/browser temporary stream (Android Scoped Storage
 * / Samsung Gallery content:// URIs), preventing ERR_UPLOAD_FILE_CHANGED and NotReadableError.
 */
export async function snapshotFile(rawFile: File): Promise<File> {
  if (!rawFile) throw new Error('الملف غير متوفر');

  let buffer: ArrayBuffer;
  try {
    if (typeof rawFile.arrayBuffer === 'function') {
      buffer = await rawFile.arrayBuffer();
    } else {
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('تعذر قراءة ملف الذاكرة'));
        reader.readAsArrayBuffer(rawFile);
      });
    }
  } catch (err: any) {
    console.warn('[snapshotFile] Error reading file stream:', err);
    throw new Error('تعذر قراءة الملف من ذاكرة الجهاز. يرجى إعادة اختيار الملف.');
  }

  // Detect real MIME type from Magic Bytes
  const bytes = new Uint8Array(buffer.slice(0, 32));
  let detectedMime = '';

  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    detectedMime = 'image/jpeg';
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    detectedMime = 'image/png';
  } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    detectedMime = 'image/gif';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    detectedMime = 'image/webp';
  } else if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    detectedMime = 'image/bmp';
  } else if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    detectedMime = 'application/pdf';
  } else if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    detectedMime = 'image/heic';
  } else if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
    detectedMime = 'application/msword';
  }

  const effectiveMime = detectedMime || resolveMimeType(rawFile);
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
  };

  const rawName = (rawFile.name || 'uploaded_file').replace(/[^\w.-]/g, '_');
  const safeExt = mimeToExt[effectiveMime] || 'jpg';
  const cleanName = rawName.includes('.') ? rawName : `${rawName}.${safeExt}`;

  const safeBlob = new Blob([buffer], { type: effectiveMime });
  return new File([safeBlob], cleanName, { type: effectiveMime, lastModified: Date.now() });
}

export const validateFile = (
  file: File,
  type: 'image' | 'document'
): { valid: boolean; error?: string } => {
  const isImg = type === 'image' || resolveMimeType(file).startsWith('image/');
  const maxSize = isImg ? MAX_IMAGE_SIZE_BYTES : MAX_DOC_SIZE_BYTES;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `حجم الملف كبير جداً. الحد الأقصى: ${(maxSize / 1024 / 1024).toFixed(0)} ميغابايت`,
    };
  }
  return { valid: true };
};

export const imageService = {
  async createPresignedUploadUrl(
    userId: string,
    fileType: string,
    bucket = 'profiles'
  ): Promise<{ signedUrl: string; path: string; publicUrl: string } | null> {
    try {
      const fileExt = fileType.split('/')[1] || 'bin';
      const path = `${userId}/${generateUUID()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);

      if (error || !data) {
        console.error("[imageService] Error generating presigned upload URL:", error);
        return null;
      }

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

      return {
        signedUrl: data.signedUrl,
        path: data.path,
        publicUrl: publicData.publicUrl
      };
    } catch (err) {
      console.error("[imageService] Exception in createPresignedUploadUrl:", err);
      return null;
    }
  },

  async compressImage(file: File): Promise<Blob | File> {
    const effectiveMime = file.type || resolveMimeType(file);
    if (!effectiveMime.startsWith('image/') || effectiveMime === 'image/svg+xml') {
      return file;
    }

    // Helper: createImageBitmap with safety timeout (prevents hang on low-memory mobile)
    const safeBitmap = (src: ImageBitmapSource, opts?: ImageBitmapOptions): Promise<ImageBitmap | null> =>
      Promise.race([
        opts ? createImageBitmap(src, opts) : createImageBitmap(src),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]).catch(() => null);

    // 1. Try modern createImageBitmap with native GPU/C++ downscaling
    if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
      try {
        const probe = await safeBitmap(file);
        if (!probe) throw new Error('createImageBitmap probe timeout');

        const origW = probe.width;
        const origH = probe.height;
        probe.close();

        if (origW > 0 && origH > 0) {
          const MAX_DIM = 1200;
          let targetW = origW;
          let targetH = origH;

          if (origW >= origH) {
            if (origW > MAX_DIM) {
              targetH = Math.max(1, Math.round((origH * MAX_DIM) / origW));
              targetW = MAX_DIM;
            }
          } else {
            if (origH > MAX_DIM) {
              targetW = Math.max(1, Math.round((origW * MAX_DIM) / origH));
              targetH = MAX_DIM;
            }
          }

          const resizedBitmap = await safeBitmap(file, {
            resizeWidth: targetW,
            resizeHeight: targetH,
            resizeQuality: 'medium'
          });

          if (!resizedBitmap) throw new Error('createImageBitmap resize timeout');

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(resizedBitmap, 0, 0);
            resizedBitmap.close(); // free GPU resources immediately

            const blob = await new Promise<Blob | null>((res) => {
              canvas.toBlob(res, 'image/jpeg', 0.82);
            });

            if (blob && blob.size > 0) {
              return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
            }
          } else {
            resizedBitmap.close();
          }
        }
      } catch (bitmapErr) {
        console.warn('[imageService] createImageBitmap fallback to Image element:', bitmapErr);
      }
    }

    // 2. Standard Image + Canvas fallback with safety timeout
    return new Promise((resolve) => {
      try {
        let objectUrl = '';
        try {
          if (typeof URL !== 'undefined' && URL.createObjectURL) {
            objectUrl = URL.createObjectURL(file);
          }
        } catch {
          // fallback to FileReader if createObjectURL fails on mobile
        }

        const img = new Image();
        const cleanup = () => {
          if (objectUrl) {
            try { URL.revokeObjectURL(objectUrl); } catch {}
          }
        };

        // Safety timeout: if image decoding hangs on mobile, fallback to original file
        const safetyTimer = setTimeout(() => {
          cleanup();
          resolve(file);
        }, 3500);

        img.onload = () => {
          clearTimeout(safetyTimer);
          try {
            cleanup();
            const canvas = document.createElement('canvas');
            let width = img.naturalWidth  || img.width  || 800;
            let height = img.naturalHeight || img.height || 600;

            const MAX_DIM = 1200;

            if (width >= height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            if (!width || !height || width < 1 || height < 1) {
              resolve(file);
              return;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(file); return; }
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob && blob.size > 0) {
                resolve(blob);
              } else {
                console.warn('[imageService] canvas.toBlob returned null/empty on mobile — using original file');
                resolve(file);
              }
            }, 'image/jpeg', 0.82);
          } catch {
            resolve(file);
          }
        };

        img.onerror = () => {
          clearTimeout(safetyTimer);
          cleanup();
          resolve(file);
        };

        if (objectUrl) {
          img.src = objectUrl;
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            img.src = e.target?.result as string;
          };
          reader.onerror = () => {
            clearTimeout(safetyTimer);
            resolve(file);
          };
          reader.readAsDataURL(file);
        }
      } catch {
        resolve(file);
      }
    });
  },


  async uploadFile(file: File | Blob, userId: string, bucket = 'profiles'): Promise<string> {
    try {
      const uuid = generateUUID();
      const effectiveMime = file instanceof File ? resolveMimeType(file) : (file.type || 'image/jpeg');
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
        'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp',
        'image/heic': 'heic', 'image/heif': 'heif',
        'application/pdf': 'pdf',
      };
      const rawExt = file instanceof File ? (file.name || '').split('.').pop()?.toLowerCase() : '';
      const fileExt = (rawExt && /^(jpg|jpeg|png|webp|gif|heic|heif|bmp|pdf|doc|docx)$/.test(rawExt))
        ? rawExt
        : (mimeToExt[effectiveMime] || 'jpg');
      const safeExt = /^(jpg|jpeg|png|webp|gif|heic|heif|bmp|pdf|doc|docx)$/.test(fileExt) ? fileExt : 'jpg';
      const fileName    = `${userId}/${uuid}.${safeExt}`;
      const contentType = effectiveMime;

      // Refresh session before upload
      try { await supabase.auth.getSession(); } catch (_) {}
      console.log(`[imageService] Upload attempt | bucket: ${bucket} | size: ${file.size} bytes | type: ${contentType}`);

      // ── Strategy 1: Presigned URL (bypasses CORS & WebView auth issues on mobile) ──
      try {
        const presigned = await this.createPresignedUploadUrl(userId, contentType, bucket);
        if (presigned?.signedUrl) {
          const uploadRes = await Promise.race([
            fetch(presigned.signedUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Presigned upload timeout (10s)')), 10000)
            ),
          ]) as Response;

          if (uploadRes.ok) {
            const separator = presigned.publicUrl.includes('?') ? '&' : '?';
            const freshUrl = `${presigned.publicUrl}${separator}t=${uuid}`;
            console.log(`✅ [imageService] Presigned upload success:`, freshUrl);
            return freshUrl;
          }
          console.warn(`⚠️ [imageService] Presigned upload HTTP ${(uploadRes as Response).status}`);
        }
      } catch (presignErr) {
        console.warn('[imageService] Presigned upload failed, trying direct SDK:', presignErr);
      }

      // ── Strategy 2: Direct SDK upload (works on desktop) ──
      const candidateBuckets = [bucket, bucket !== 'profiles' ? 'profiles' : 'images']
        .filter((b, idx, arr) => arr.indexOf(b) === idx && Boolean(b));

      for (const b of candidateBuckets) {
        try {
          const uploadPromise = supabase.storage
            .from(b)
            .upload(fileName, file, { contentType, upsert: true, cacheControl: '1' });

          const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('Storage upload timeout (7s)')), 7000)
          );

          const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

          if (!uploadError) {
            const { data: publicData } = supabase.storage.from(b).getPublicUrl(fileName);
            if (publicData?.publicUrl) {
              const separator = publicData.publicUrl.includes('?') ? '&' : '?';
              const freshUrl = `${publicData.publicUrl}${separator}t=${uuid}`;
              console.log(`✅ [imageService] Direct SDK upload success in bucket '${b}':`, freshUrl);
              return freshUrl;
            }
          } else {
            console.warn(`⚠️ [imageService] Bucket '${b}' SDK upload failed:`, uploadError.message || JSON.stringify(uploadError));
          }
        } catch (bErr) {
          console.warn(`⚠️ [imageService] Exception trying bucket '${b}':`, bErr);
        }
      }
    } catch (e) {
      console.warn('[imageService] Storage upload error, falling back to base64:', e);
    }


    // Fallback: convert to compact base64 data URL using FileReader
    // (avoids URL.createObjectURL which fails on restricted Android WebViews)
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const resultStr = reader.result;
            // If image or binary from mobile: downscale via canvas before storing to keep DB payload tiny (< 50KB)
            if (resultStr.startsWith('data:image/') || resultStr.startsWith('data:application/octet-stream') || resultStr.startsWith('data:;')) {
              try {
                const img = new Image();
                const timeout = setTimeout(() => resolve(resultStr), 3000);
                img.onload = () => {
                  clearTimeout(timeout);
                  try {
                    const maxDim = 400;
                    let w = img.naturalWidth || img.width || maxDim;
                    let h = img.naturalHeight || img.height || maxDim;
                    if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
                    else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(img, 0, 0, w, h);
                      const compact = canvas.toDataURL('image/jpeg', 0.65);
                      console.log(`ℹ️ [imageService] Compact base64 fallback: ${compact.length} chars`);
                      resolve(compact);
                      return;
                    }
                  } catch { /* fall through to raw */ }
                  resolve(resultStr);
                };
                img.onerror = () => {
                  clearTimeout(timeout);
                  resolve(resultStr);
                };
                img.src = resultStr;
                return;
              } catch {
                resolve(resultStr);
                return;
              }
            } else {
              resolve(resultStr);
            }
          } else {
            reject(new Error('Failed to encode file'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  },

  async processAndUpload(file: File, userId: string, bucket = 'profiles'): Promise<string> {
    // 0. Ensure file stream is isolated in memory
    try {
      file = await snapshotFile(file);
    } catch (snapErr) {
      console.warn('[imageService] snapshotFile warning:', snapErr);
    }

    // 1. Convert HEIC/HEIF (common on Galaxy S21 / iPhone) to standard JPEG
    const isHeic = (file.type && (file.type.includes('heic') || file.type.includes('heif'))) ||
                   (file.name && /\.(heic|heif)$/i.test(file.name));
    if (isHeic) {
      try {
        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default || heic2anyModule;
        const convertPromise = heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.85
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('HEIC conversion timeout (4s)')), 4000)
        );
        const converted = await Promise.race([convertPromise, timeoutPromise]);
        const blob = Array.isArray(converted) ? converted[0] : converted;
        const newName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg');
        file = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
      } catch (heicErr) {
        console.warn('[imageService] HEIC conversion warning (proceeding with original):', heicErr);
      }
    }

    // Use resolveMimeType so album photos with empty file.type are treated as images
    const effectiveMime = resolveMimeType(file);
    const fileType = effectiveMime.startsWith('image/') ? 'image' : 'document';
    const validation = validateFile(file, fileType);
    if (!validation.valid) throw new Error(validation.error);

    if (effectiveMime.startsWith('image/')) {
      try {
        // Compress first, then upload
        const compressed = await this.compressImage(file);
        // On mobile, compressImage may silently return the original File
        // when canvas is unavailable — that is fine, we still upload it
        return await this.uploadFile(compressed, userId, bucket);
      } catch (compressError) {
        // Canvas compression failed (common on Android WebView) — upload raw file directly
        console.warn('[imageService] Canvas compression failed on mobile, uploading raw file:', compressError);
        return await this.uploadFile(file, userId, bucket);
      }
    } else {
      // PDF / DOC — upload directly without processing
      return this.uploadFile(file, userId, bucket);
    }
  },

  async uploadVideo(file: File, userId: string): Promise<string> {
    return this.uploadFile(file, userId, 'posts');
  }
};
