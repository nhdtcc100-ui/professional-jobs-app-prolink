import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/heic', 'image/heif', 'image/bmp'];
const ALLOWED_DOC_TYPES   = ['application/pdf'];
const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (compressed automatically before upload)
const MAX_DOC_SIZE_BYTES   = 20 * 1024 * 1024; // 20 MB

/** Resolve effective MIME type — handles mobile album photos where type is empty */
const resolveMimeType = (file: File): string => {
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

        img.onload = () => {
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

            // Guard against invalid dimensions (can happen on some Android browsers)
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
              // toBlob can return null on restricted Android WebViews
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
          cleanup();
          // If decoding fails (e.g. HEIC / RAW from album), use original file
          resolve(file);
        };

        if (objectUrl) {
          img.src = objectUrl;
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            img.src = e.target?.result as string;
          };
          reader.onerror = () => resolve(file);
          reader.readAsDataURL(file);
        }
      } catch {
        resolve(file);
      }
    });
  },


  async uploadFile(file: File | Blob, userId: string, bucket = 'profiles'): Promise<string> {
    try {
      // Always use a fresh UUID so upsert never hits a stale cached path
      const uuid = generateUUID();
      // Resolve MIME first — mobile album photos often have empty type
      const effectiveMime = file instanceof File ? resolveMimeType(file) : (file.type || 'image/jpeg');
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
        'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp',
        'image/heic': 'heic', 'image/heif': 'heif',
        'application/pdf': 'pdf',
      };
      // Try extension from name first, then from MIME type
      const rawExt = file instanceof File ? (file.name || '').split('.').pop()?.toLowerCase() : '';
      const fileExt = (rawExt && /^(jpg|jpeg|png|webp|gif|heic|heif|bmp|pdf|doc|docx)$/.test(rawExt))
        ? rawExt
        : (mimeToExt[effectiveMime] || 'jpg');
      const safeExt = /^(jpg|jpeg|png|webp|gif|heic|heif|bmp|pdf|doc|docx)$/.test(fileExt) ? fileExt : 'jpg';
      const fileName    = `${userId}/${uuid}.${safeExt}`;
      const contentType = effectiveMime;

      // Verify user session is active before attempting upload
      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData?.session?.access_token;
      console.log(`[imageService] Upload attempt | bucket: ${bucket} | hasSession: ${hasSession} | file size: ${file.size} bytes`);

      if (!hasSession) {
        console.warn('[imageService] No active Supabase session — storage upload will fail RLS policy. Falling back to base64.');
        throw new Error('No active session');
      }

      // Actual existing buckets in Supabase (in priority order)
      const candidateBuckets = [bucket, 'profiles', 'applications', 'posts', 'job-images']
        .filter((b, idx, arr) => arr.indexOf(b) === idx);

      for (const b of candidateBuckets) {
        try {
          const { error: uploadError } = await supabase.storage
            .from(b)
            .upload(fileName, file, {
              contentType,
              upsert: true,
              // '1' = 1 second cache — effectively no-cache while being a valid value
              cacheControl: '1',
            });

          if (!uploadError) {
            const { data: publicData } = supabase.storage.from(b).getPublicUrl(fileName);
            if (publicData?.publicUrl) {
              // Append cache-buster so browser always fetches fresh image
              const separator = publicData.publicUrl.includes('?') ? '&' : '?';
              const freshUrl = `${publicData.publicUrl}${separator}t=${uuid}`;
              console.log(`✅ [imageService] Successfully uploaded file to bucket '${b}':`, freshUrl);
              return freshUrl;
            }
          } else {
            console.warn(`⚠️ [imageService] Bucket '${b}' upload failed:`, uploadError.message || JSON.stringify(uploadError));
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
            // If image: downscale via canvas before storing to keep DB payload small
            if (file.type?.startsWith('image/') && reader.result.startsWith('data:image/')) {
              try {
                const img = new Image();
                img.onload = () => {
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
                  resolve(reader.result as string);
                };
                img.onerror = () => resolve(reader.result as string);
                img.src = reader.result as string;
              } catch {
                resolve(reader.result as string);
              }
            } else {
              resolve(reader.result);
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
