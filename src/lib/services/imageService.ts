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

  // If already an in-memory processed File, return immediately
  if ((rawFile as any).__isSnapshot) return rawFile;

  const isImage = (rawFile.type && rawFile.type.startsWith('image/')) ||
    /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/i.test(rawFile.name || '') ||
    !rawFile.type;

  const MAX_DIM = 1000;

  // 1. FAST-PATH: createImageBitmap downscaling directly on hardware decoder (Skia)
  if (isImage && typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      const bmp = await Promise.race([
        createImageBitmap(rawFile),
        new Promise<null>((res) => setTimeout(() => res(null), 8000)),
      ]);

      if (bmp && bmp.width > 0 && bmp.height > 0) {
        let w = bmp.width;
        let h = bmp.height;
        if (w >= h) {
          if (w > MAX_DIM) {
            h = Math.max(1, Math.round((h * MAX_DIM) / w));
            w = MAX_DIM;
          }
        } else {
          if (h > MAX_DIM) {
            w = Math.max(1, Math.round((w * MAX_DIM) / h));
            h = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, w, h);
          bmp.close();

          const cleanBlob = await new Promise<Blob | null>((res) => {
            canvas.toBlob(res, 'image/jpeg', 0.82);
          });

          if (cleanBlob && cleanBlob.size > 0) {
            const cleanName = (rawFile.name || 'photo.jpg').replace(/\.[^.]+$/, '.jpg');
            const cleanFile = new File([cleanBlob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            (cleanFile as any).__isSnapshot = true;
            (cleanFile as any).__isCompressed = true;
            console.log('[snapshotFile] Instant createImageBitmap materialization:', cleanFile.size, 'bytes');
            return cleanFile;
          }
        } else {
          bmp.close();
        }
      }
    } catch (bmpErr) {
      console.warn('[snapshotFile] createImageBitmap fallback to Image element:', bmpErr);
    }
  }

  // 2. Second path: Native Image + Canvas pipeline
  if (isImage && typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const materialized = await new Promise<File | null>((resolve) => {
        let objUrl = '';
        try {
          objUrl = URL.createObjectURL(rawFile);
        } catch {
          resolve(null);
          return;
        }

        const img = new Image();
        let settled = false;

        const cleanup = () => {
          if (!settled) {
            settled = true;
            if (objUrl) {
              try { URL.revokeObjectURL(objUrl); } catch {}
            }
          }
        };

        const timer = setTimeout(() => {
          cleanup();
          resolve(null);
        }, 12000);

        img.onload = () => {
          clearTimeout(timer);
          try {
            let w = img.naturalWidth || img.width || 800;
            let h = img.naturalHeight || img.height || 600;

            if (w >= h) {
              if (w > MAX_DIM) {
                h = Math.max(1, Math.round((h * MAX_DIM) / w));
                w = MAX_DIM;
              }
            } else {
              if (h > MAX_DIM) {
                w = Math.max(1, Math.round((w * MAX_DIM) / h));
                h = MAX_DIM;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              cleanup();
              resolve(null);
              return;
            }

            ctx.drawImage(img, 0, 0, w, h);
            cleanup();

            canvas.toBlob((blob) => {
              if (blob && blob.size > 0) {
                const cleanName = (rawFile.name || 'photo.jpg').replace(/\.[^.]+$/, '.jpg');
                const cleanFile = new File([blob], cleanName, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                (cleanFile as any).__isSnapshot = true;
                (cleanFile as any).__isCompressed = true;
                resolve(cleanFile);
              } else {
                resolve(null);
              }
            }, 'image/jpeg', 0.82);
          } catch {
            cleanup();
            resolve(null);
          }
        };

        img.onerror = () => {
          clearTimeout(timer);
          cleanup();
          resolve(null);
        };

        img.src = objUrl;
      });

      if (materialized) {
        console.log('[snapshotFile] Image materialization success:', materialized.size, 'bytes');
        return materialized;
      }
    } catch (e) {
      console.warn('[snapshotFile] Image materialization fallback:', e);
    }
  }

  // 3. Fallback for non-images (PDF / Word) or if Canvas materialization failed:
  let buffer: ArrayBuffer | null = null;
  try {
    if (typeof rawFile.arrayBuffer === 'function') {
      buffer = await Promise.race([
        rawFile.arrayBuffer(),
        new Promise<null>((res) => setTimeout(() => res(null), 10000))
      ]);
    }
    if (!buffer) {
      buffer = await new Promise<ArrayBuffer | null>((resolve) => {
        const reader = new FileReader();
        const t = setTimeout(() => resolve(null), 10000);
        reader.onload = () => {
          clearTimeout(t);
          resolve(reader.result instanceof ArrayBuffer ? reader.result : null);
        };
        reader.onerror = () => { clearTimeout(t); resolve(null); };
        reader.readAsArrayBuffer(rawFile);
      });
    }
  } catch (err) {
    console.warn('[snapshotFile] Error reading file stream:', err);
  }

  if (buffer && buffer.byteLength > 0) {
    const effectiveMime = resolveMimeType(rawFile);
    const snapFile = new File([buffer], rawFile.name || 'file', { type: effectiveMime, lastModified: Date.now() });
    (snapFile as any).__isSnapshot = true;
    return snapFile;
  }

  (rawFile as any).__isSnapshot = true;
  return rawFile;
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

  /**
   * Compresses an image to max 1000px and 0.80 quality.
   * Produces an in-memory JPEG File typically between 80KB - 200KB.
   */
  async compressImage(file: File): Promise<Blob | File> {
    if ((file as any).__isCompressed) return file;
    if (file.size <= 250 * 1024) return file;
    const doCompress = async (): Promise<Blob | File> => {
      const effectiveMime = file.type || resolveMimeType(file);
      if (!effectiveMime.startsWith('image/') || effectiveMime === 'image/svg+xml') {
        return file;
      }

      // Fast-path: already small compressed image (< 250KB)
      if (file.size <= 250 * 1024 && (effectiveMime === 'image/jpeg' || effectiveMime === 'image/webp')) {
        return file;
      }

      const MAX_DIM = 1000;

      // 1. Try modern createImageBitmap with native GPU/C++ downscaling
      if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
        try {
          const probe = await Promise.race([
            createImageBitmap(file),
            new Promise<null>((res) => setTimeout(() => res(null), 3500)),
          ]);

          if (probe && probe.width > 0 && probe.height > 0) {
            const origW = probe.width;
            const origH = probe.height;
            probe.close();

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

            const resizedBitmap = await Promise.race([
              createImageBitmap(file, {
                resizeWidth: targetW,
                resizeHeight: targetH,
                resizeQuality: 'medium',
              }),
              new Promise<null>((res) => setTimeout(() => res(null), 4000)),
            ]);

            if (resizedBitmap) {
              const canvas = document.createElement('canvas');
              canvas.width = targetW;
              canvas.height = targetH;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(resizedBitmap, 0, 0);
                resizedBitmap.close();

                const blob = await new Promise<Blob | null>((res) => {
                  canvas.toBlob(res, 'image/jpeg', 0.80);
                });

                if (blob && blob.size > 0) {
                  const compFile = new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  (compFile as any).__isSnapshot = true;
                  return compFile;
                }
              } else {
                resizedBitmap.close();
              }
            }
          }
        } catch (bitmapErr) {
          console.warn('[imageService] createImageBitmap fallback to Image element:', bitmapErr);
        }
      }

      // 2. Standard Image + Canvas fallback
      return new Promise<Blob | File>((resolve) => {
        try {
          let objectUrl = '';
          try {
            if (typeof URL !== 'undefined' && URL.createObjectURL) {
              objectUrl = URL.createObjectURL(file);
            }
          } catch {}

          const img = new Image();
          const cleanup = () => {
            if (objectUrl) {
              try { URL.revokeObjectURL(objectUrl); } catch {}
            }
          };

          const safetyTimer = setTimeout(() => {
            cleanup();
            resolve(file);
          }, 6000);

          img.onload = () => {
            clearTimeout(safetyTimer);
            try {
              cleanup();
              let width = img.naturalWidth || img.width || 800;
              let height = img.naturalHeight || img.height || 600;

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

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(file); return; }
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob((blob) => {
                if (blob && blob.size > 0) {
                  const compFile = new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  (compFile as any).__isSnapshot = true;
                  resolve(compFile);
                } else {
                  resolve(file);
                }
              }, 'image/jpeg', 0.80);
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
    };

    const timeoutPromise = new Promise<File>((resolve) =>
      setTimeout(() => resolve(file), 12000)
    );

    return Promise.race([doCompress(), timeoutPromise]);
  },

  /**
   * Generates a lightweight Base64 thumbnail (< 30KB) as emergency fallback.
   * Can be stored directly into PostgreSQL text columns without hitting payload limits.
   */
  async createCompactBase64Thumbnail(file: File | Blob, maxDim = 200, quality = 0.55): Promise<string> {
    return new Promise<string>((resolve) => {
      try {
        let objectUrl = '';
        try {
          if (typeof URL !== 'undefined' && URL.createObjectURL) {
            objectUrl = URL.createObjectURL(file);
          }
        } catch {}

        const img = new Image();
        const cleanup = () => {
          if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch {} }
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve('');
        }, 6000);

        img.onload = () => {
          clearTimeout(timeout);
          cleanup();
          try {
            let w = img.naturalWidth || img.width || maxDim;
            let h = img.naturalHeight || img.height || maxDim;
            if (w >= h && w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
            if (w < 1 || h < 1) { resolve(''); return; }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/jpeg', quality);
              console.log(`ℹ️ [imageService] Compact Base64 thumbnail created: ${dataUrl.length} chars (~${Math.round(dataUrl.length / 1024)}KB)`);
              resolve(dataUrl);
              return;
            }
          } catch {}
          resolve('');
        };

        img.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          resolve('');
        };

        if (objectUrl) {
          img.src = objectUrl;
        } else {
          const reader = new FileReader();
          reader.onload = () => { img.src = reader.result as string; };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        }
      } catch {
        resolve('');
      }
    });
  },

  /**
   * Uploads file to Supabase Storage with realistic 25s timeout and automatic fallback.
   */
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

      // Strategy 1: Direct SDK upload with realistic 25s timeout for mobile networks
      const candidateBuckets = [bucket, bucket !== 'profiles' ? 'profiles' : 'images']
        .filter((b, idx, arr) => arr.indexOf(b) === idx && Boolean(b));

      for (const b of candidateBuckets) {
        try {
          const uploadPromise = supabase.storage
            .from(b)
            .upload(fileName, file, { contentType, upsert: true, cacheControl: '3600' });

          const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error(`Storage upload timeout (25s) for bucket '${b}'`)), 25000)
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
        } catch (bErr: any) {
          console.warn(`⚠️ [imageService] Exception trying bucket '${b}':`, bErr?.message || bErr);
        }
      }

      // Strategy 2: Presigned URL fallback
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
              setTimeout(() => reject(new Error('Presigned upload timeout (15s)')), 15000)
            ),
          ]) as Response;

          if (uploadRes.ok) {
            const separator = presigned.publicUrl.includes('?') ? '&' : '?';
            const freshUrl = `${presigned.publicUrl}${separator}t=${uuid}`;
            console.log(`✅ [imageService] Presigned upload fallback success:`, freshUrl);
            return freshUrl;
          }
        }
      } catch (presignErr) {
        console.warn('[imageService] Presigned upload fallback failed:', presignErr);
      }
    } catch (e) {
      console.warn('[imageService] Storage upload error, falling back to compact Base64:', e);
    }

    // Strategy 3: Compact Base64 thumbnail fallback (ensures DB storage never breaks even if Storage RLS is misconfigured)
    console.warn('[imageService] All storage upload strategies failed. Generating compact Base64 thumbnail for DB...');
    const compactThumb = await this.createCompactBase64Thumbnail(file);
    if (compactThumb) return compactThumb;

    throw new Error('تعذر رفع الصورة أو إنشاء معاينة لها. يرجى التحقق من اتصال الإنترنت.');
  },

  /**
   * Main pipeline: Safely snapshots file from SAF, converts HEIC, validates, compresses, and uploads.
   */
  async processAndUpload(file: File, userId: string, bucket = 'profiles'): Promise<string> {
    // Step 0: Ensure file is an in-memory snapshot (isolates from SAF lazy streams)
    let workingFile = (file as any)?.__isSnapshot ? file : await snapshotFile(file);

    // Step 1: Convert HEIC/HEIF -> JPEG
    const isHeic = (workingFile.type && (workingFile.type.includes('heic') || workingFile.type.includes('heif'))) ||
                   (workingFile.name && /\.(heic|heif)$/i.test(workingFile.name));
    if (isHeic) {
      try {
        const convertPromise = (async () => {
          const heic2anyModule = await import('heic2any');
          const heic2any = heic2anyModule.default || heic2anyModule;
          return await heic2any({ blob: workingFile, toType: 'image/jpeg', quality: 0.85 });
        })();
        const converted = await Promise.race([
          convertPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        ]);
        if (converted) {
          const blob = Array.isArray(converted) ? converted[0] : converted;
          const newName = (workingFile.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg');
          workingFile = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
          (workingFile as any).__isSnapshot = true;
        }
      } catch (heicErr) {
        console.warn('[imageService] HEIC conversion warning:', heicErr);
      }
    }

    // Step 2: Validate
    const effectiveMime = resolveMimeType(workingFile);
    const fileType = effectiveMime.startsWith('image/') ? 'image' : 'document';
    const validation = validateFile(workingFile, fileType);
    if (!validation.valid) throw new Error(validation.error);

    // Step 3: Compress image to <= 1000px before uploading
    if (effectiveMime.startsWith('image/')) {
      // If already a compact in-memory snapshot (<= 300KB), upload immediately
      if ((workingFile as any).__isSnapshot && workingFile.size <= 300 * 1024) {
        return await this.uploadFile(workingFile, userId, bucket);
      }
      try {
        const compressed = await this.compressImage(workingFile);
        return await this.uploadFile(compressed, userId, bucket);
      } catch (compressError) {
        console.warn('[imageService] compressImage failed, uploading snapshot directly:', compressError);
        return await this.uploadFile(workingFile, userId, bucket);
      }
    } else {
      return this.uploadFile(workingFile, userId, bucket);
    }
  },

  /**
   * Compacts a base64 data URL to a small JPEG thumbnail for DB storage.
   */
  async compactBase64(dataUrl: string, maxDim = 200, quality = 0.55): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      try {
        if (!dataUrl.startsWith('data:')) { resolve(null); return; }
        const img = new Image();
        const timeout = setTimeout(() => resolve(null), 5000);
        img.onload = () => {
          clearTimeout(timeout);
          try {
            let w = img.naturalWidth || img.width || maxDim;
            let h = img.naturalHeight || img.height || maxDim;
            if (w >= h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
            if (w < 1 || h < 1) { resolve(null); return; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0, w, h);
            const compact = canvas.toDataURL('image/jpeg', quality);
            console.log(`ℹ️ [compactBase64] ${dataUrl.length} -> ${compact.length} chars (${Math.round(compact.length / 1024)}KB)`);
            resolve(compact);
          } catch { resolve(null); }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(null); };
        img.src = dataUrl;
      } catch { resolve(null); }
    });
  },

  async uploadVideo(file: File, userId: string): Promise<string> {
    return this.uploadFile(file, userId, 'posts');
  }
};

/**
 * Directly opens the device Photo Gallery & Albums.
 * On native Android / iOS (Capacitor), uses CameraSource.Photos which opens the native Gallery directly.
 * On mobile Web browsers, uses a targeted image file picker (JPEG, PNG, WEBP) that directs Android to Media Gallery.
 */
export async function pickImageFromGallery(): Promise<File | null> {
  // 1. Native Capacitor App (Android / iOS)
  if (typeof (window as any)?.Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });

      if (photo?.webPath) {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const ext = photo.format || 'jpg';
        const file = new File([blob], `photo_${Date.now()}.${ext}`, {
          type: blob.type || `image/${ext}`,
          lastModified: Date.now()
        });
        (file as any).__isSnapshot = true;
        (file as any).__isCompressed = true;
        return file;
      }
      return null;
    } catch (e: any) {
      if (e?.message?.includes('cancelled') || e?.message?.includes('User cancelled')) {
        return null;
      }
      console.warn('[pickImageFromGallery] Native picker error, fallback to web:', e);
    }
  }

  // 2. Web fallback:
  // accept='image/*' opens native Photo Picker on Android 11+ without opening file browser
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    let handled = false;
    const cleanup = () => {
      if (input.parentNode) document.body.removeChild(input);
    };

    input.onchange = () => {
      if (handled) return;
      handled = true;
      const f = input.files?.[0] ?? null;
      cleanup();
      resolve(f);
    };

    setTimeout(() => {
      if (!handled) { handled = true; cleanup(); resolve(null); }
    }, 120000);

    input.click();
  });
}
