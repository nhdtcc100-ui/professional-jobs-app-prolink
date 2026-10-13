import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';
import { logger } from '../logger';
import { verifyFileMimeType } from '../security/mimeValidator';
import { inspectUploadedFile } from '../security/fileInspector';

const MAX_CV_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

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
   * Helper: Resolve effective extension from filename, MIME type, or content
   */
  resolveExtension(file: File): string {
    const rawName = file.name || '';
    if (rawName.includes('.')) {
      const ext = rawName.split('.').pop()?.toLowerCase()?.trim() || '';
      if (ALLOWED_EXTENSIONS.includes(ext)) return ext;
    }

    // Mobile fallback: deduce from MIME type
    const mime = (file.type || '').toLowerCase();
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('wordprocessingml') || mime.includes('vnd.openxmlformats')) return 'docx';
    if (mime.includes('msword')) return 'doc';

    // Default to pdf
    return 'pdf';
  },

  /**
   * Validate a CV file for size, allowed extension, MIME type, and binary security.
   */
  async validateCV(file: File, user?: { id?: string; name?: string; email?: string }): Promise<{ valid: boolean; error?: string; ext: string }> {
    if (!file) {
      return { valid: false, error: 'لم يتم تحديد أي ملف', ext: 'pdf' };
    }

    if (file.size > MAX_CV_SIZE_BYTES) {
      return {
        valid: false,
        error: `حجم ملف السيرة الذاتية كبير جداً (${(file.size / 1024 / 1024).toFixed(1)} ميغابايت). الحد الأقصى المسموح به هو ${(MAX_CV_SIZE_BYTES / 1024 / 1024).toFixed(0)} ميغابايت`,
        ext: 'pdf',
      };
    }

    const resolvedExt = this.resolveExtension(file);

    // 🛡️ Security Inspection (checks dangerous extensions, embedded webshells, etc.)
    try {
      const inspection = await inspectUploadedFile(file, user, '/cv/upload');
      if (!inspection.safe) {
        return { valid: false, error: inspection.error || 'تم رفض الملف لدواعي أمنية', ext: resolvedExt };
      }
    } catch (e: any) {
      logger.warn('[cvService] File inspection skipped/failed:', e?.message);
    }

    // 🛡️ Magic Bytes Verification (flexible check to avoid false rejections)
    try {
      const expectedMime = EXT_TO_MIME[resolvedExt] || file.type || 'application/pdf';
      const magic = await verifyFileMimeType(file, expectedMime);
      if (!magic.valid) {
        logger.warn('[cvService] Magic bytes warning (permissive fallback allowed):', magic.error);
      }
    } catch (e: any) {
      logger.warn('[cvService] Magic bytes verification warning:', e?.message);
    }

    return { valid: true, ext: resolvedExt };
  },

  /**
   * Convert a file to a Base64 data URL as a fallback for small documents.
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('فشل قراءة الملف'));
        }
      };
      reader.onerror = () => reject(new Error('خطأ في قراءة ملف السيرة الذاتية من ذاكرة الهاتف'));
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
      if (!userId) {
        return { data: null, error: new Error('معرف المستخدم مفقود. يرجى تسجيل الدخول أولاً.') };
      }

      // 1. Validation & Extension Resolution
      const validation = await this.validateCV(file, { id: userId, ...userContext });
      if (!validation.valid) {
        return { data: null, error: new Error(validation.error || 'الملف غير صالح') };
      }

      const safeExt = validation.ext;
      const uuid = generateUUID();
      const fileName = `${userId}/cv-${uuid}.${safeExt}`;
      const contentType = EXT_TO_MIME[safeExt] || file.type || 'application/pdf';

      // 2. Ensure Supabase Auth Session is refreshed for Storage RLS headers
      try {
        await supabase.auth.getSession();
      } catch (_) {}

      // 3. Candidate Buckets in priority order
      const candidateBuckets = ['resumes', 'applications', 'profiles', 'job-images'];
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
            logger.warn(`⚠️ [cvService] Bucket '${bucket}' upload failed:`, uploadError.message || uploadError);
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

      // 4. Fallback for smaller files (< 1MB) to prevent PostgREST body overflow
      const MAX_BASE64_BYTES = 1024 * 1024; // 1 MB
      if (file.size <= MAX_BASE64_BYTES) {
        logger.warn('[cvService] Supabase storage failed; using compact Base64 fallback for small file.');
        try {
          const base64Url = await this.fileToBase64(file);
          return { data: base64Url, error: null };
        } catch (b64Err: any) {
          return { data: null, error: new Error('تعذر معالجة الملف: ' + (b64Err.message || '')) };
        }
      }

      // If file is > 1MB and storage failed due to RLS, return a clear actionable message
      const isRlsError = lastStorageError?.message?.includes('row-level security') ||
                         lastStorageError?.message?.includes('security policy');

      const userErrorMessage = isRlsError
        ? 'تم رفض الرفع بواسطة سياسة الأمان (Supabase Storage RLS). يرجى التأكد من تشغيل صلاحيات التخزين في لوحة تحكم Supabase.'
        : (lastStorageError?.message || 'فشل رفع السيرة الذاتية إلى وحدة التخزين السحابية. يرجى التحقق من اتصال الإنترنت.');

      return {
        data: null,
        error: new Error(userErrorMessage),
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
      const buckets = ['resumes', 'applications', 'profiles', 'job-images'];
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
