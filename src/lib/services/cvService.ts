import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';
import { logger } from '../logger';
import { verifyFileMimeType } from '../security/mimeValidator';
import { inspectUploadedFile } from '../security/fileInspector';

const MAX_CV_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface CVUploadResult {
  data: string | null;
  error: Error | null;
}

export const cvService = {
  /**
   * Validate a CV file for size, allowed extension, MIME type, and binary security.
   */
  async validateCV(file: File, user?: { id?: string; name?: string; email?: string }): Promise<{ valid: boolean; error?: string }> {
    if (!file) {
      return { valid: false, error: 'لم يتم تحديد أي ملف' };
    }

    if (file.size > MAX_CV_SIZE_BYTES) {
      return {
        valid: false,
        error: `حجم ملف السيرة الذاتية كبير جداً. الحد الأقصى المسموح به هو ${(MAX_CV_SIZE_BYTES / 1024 / 1024).toFixed(0)} ميغابايت`,
      };
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: 'صيغة الملف غير مدعومة. الصيغ المسموح بها للسيرة الذاتية هي: PDF, DOC, DOCX',
      };
    }

    // 🛡️ Security Inspection (checks dangerous extensions, embedded webshells, etc.)
    try {
      const inspection = await inspectUploadedFile(file, user, '/cv/upload');
      if (!inspection.safe) {
        return { valid: false, error: inspection.error || 'تم رفض الملف لدواعي أمنية' };
      }
    } catch (e: any) {
      logger.warn('[cvService] File inspection skipped/failed:', e?.message);
    }

    // 🛡️ Magic Bytes Verification
    try {
      const expectedMime = EXT_TO_MIME[ext] || file.type || 'application/pdf';
      const magic = await verifyFileMimeType(file, expectedMime);
      if (!magic.valid) {
        return { valid: false, error: magic.error || 'فشل التحقق من بنية ملف السيرة الذاتية' };
      }
    } catch (e: any) {
      logger.warn('[cvService] Magic bytes verification warning:', e?.message);
    }

    return { valid: true };
  },

  /**
   * Convert a file to a Base64 data URL as a resilient offline/restricted fallback.
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('فشل قراءة الملف كـ Base64'));
        }
      };
      reader.onerror = () => reject(new Error('خطأ في قراءة ملف السيرة الذاتية'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Upload CV file to Supabase Storage with automated multi-bucket retry and fallback.
   */
  async uploadCV(
    userId: string, 
    file: File, 
    userContext?: { name?: string; email?: string }
  ): Promise<CVUploadResult> {
    try {
      // 1. Validation
      const validation = await this.validateCV(file, { id: userId, ...userContext });
      if (!validation.valid) {
        return { data: null, error: new Error(validation.error || 'الملف غير صالح') };
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : 'pdf';
      const uuid = generateUUID();
      const fileName = `${userId}/cv-${uuid}.${safeExt}`;
      const contentType = EXT_TO_MIME[safeExt] || file.type || 'application/pdf';

      // 2. Candidate Buckets in priority order
      const candidateBuckets = ['resumes', 'applications', 'profiles'];
      let uploadedUrl: string | null = null;
      let lastStorageError: any = null;

      for (const bucket of candidateBuckets) {
        try {
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
              contentType,
              upsert: true,
              cacheControl: '3600',
            });

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from(bucket)
              .getPublicUrl(fileName);

            if (publicData?.publicUrl) {
              uploadedUrl = publicData.publicUrl;
              logger.info(`✅ [cvService] Successfully uploaded CV to bucket '${bucket}': ${uploadedUrl}`);
              break;
            }
          } else {
            lastStorageError = uploadError;
            logger.warn(`⚠️ [cvService] Bucket '${bucket}' failed:`, uploadError.message || uploadError);
          }
        } catch (bErr) {
          lastStorageError = bErr;
          logger.warn(`⚠️ [cvService] Exception on bucket '${bucket}':`, bErr);
        }
      }

      // If storage succeeded in any bucket, return the public URL
      if (uploadedUrl) {
        return { data: uploadedUrl, error: null };
      }

      // 3. Fallback: Base64 data URL
      // If all buckets failed (e.g. storage disabled, RLS block, network partition),
      // we encode small/medium files as Base64 so the user does NOT get blocked from applying.
      if (file.size <= 8 * 1024 * 1024) {
        logger.warn('[cvService] Supabase storage unavailable; falling back to Base64 data URL.');
        try {
          const base64Url = await this.fileToBase64(file);
          return { data: base64Url, error: null };
        } catch (b64Err: any) {
          return { data: null, error: new Error('تعذر رفع الملف أو تحويله: ' + (b64Err.message || '')) };
        }
      }

      return {
        data: null,
        error: new Error(
          lastStorageError?.message || 
          'فشل رفع ملف السيرة الذاتية إلى الخادم. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.'
        ),
      };
    } catch (err: any) {
      logger.error('[cvService] Unexpected uploadCV exception:', err);
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Delete an existing CV from Supabase storage if it's hosted there.
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
            return true;
          }
        }
      }
    } catch (err) {
      logger.warn('[cvService] Failed to remove old CV:', err);
    }
    return false;
  }
};
