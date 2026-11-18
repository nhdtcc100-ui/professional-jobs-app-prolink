import { supabase } from '../supabase';
import { generateUUID } from '../security/distributedId';
import { readUploadFile, uploadToStorageDirect } from './directUpload';
import { withTimeout } from '../utils/withTimeout';

const MAX_CV_SIZE_BYTES = 25 * 1024 * 1024;
const READ_TIMEOUT_MS = 10_000;

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface CVUploadResult {
  data: string | null;
  error: Error | null;
}

function resolveExtension(file: File): string {
  const extension = /\.([^.]+)$/.exec(file.name || '')?.[1].toLowerCase();
  if (extension) return Object.hasOwn(EXT_TO_MIME, extension) ? extension : '';
  return Object.keys(EXT_TO_MIME).find(ext => EXT_TO_MIME[ext] === file.type.toLowerCase()) || '';
}

function isDocx(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let hasContentTypes = false;
  let hasDocument = false;
  // ZIP alone also describes XLSX and arbitrary archives; require Word entries.
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(offset + 28, true);
    const entryLength = 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (offset + entryLength > bytes.length) return false;
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    hasContentTypes ||= name === '[Content_Types].xml';
    hasDocument ||= name === 'word/document.xml';
    if (hasContentTypes && hasDocument) return true;
    offset += entryLength - 1;
  }
  return false;
}

function validateSignature(buffer: ArrayBuffer, extension: string): void {
  const bytes = new Uint8Array(buffer);
  const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const valid = extension === 'pdf'
    ? startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])
    : extension === 'doc'
      ? startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
      : extension === 'docx' && startsWith([0x50, 0x4b, 0x03, 0x04]) && isDocx(bytes);
  if (!valid) {
    throw new Error('محتوى الملف لا يطابق امتداده. اختر ملف PDF أو DOC أو DOCX صالحاً.');
  }
}

export const cvService = {
  MAX_CV_SIZE_BYTES,
  async uploadCV(
    userId: string,
    file: File,
    _userContext?: { name?: string; email?: string }
  ): Promise<CVUploadResult> {
    try {
      if (!userId?.trim()) {
        throw new Error('معرف المستخدم مفقود. يرجى تسجيل الدخول أولاً.');
      }
      if (!file?.size) throw new Error('الملف فارغ أو غير قابل للقراءة.');
      if (file.size > MAX_CV_SIZE_BYTES) {
        throw new Error('حجم السيرة الذاتية يجب ألا يتجاوز 25 ميغابايت.');
      }
      const extension = resolveExtension(file);
      if (!extension) throw new Error('اختر ملف PDF أو DOC أو DOCX فقط.');

      const snapshot = await readUploadFile(file, READ_TIMEOUT_MS);
      const buffer = await withTimeout(
        snapshot.arrayBuffer(), READ_TIMEOUT_MS, 'تعذرت قراءة محتوى السيرة الذاتية. اختر الملف مجدداً.'
      );
      validateSignature(buffer, extension);
      const data = await uploadToStorageDirect(buffer, {
        bucket: 'resumes',
        path: `${userId}/cv-${generateUUID()}.${extension}`,
        contentType: EXT_TO_MIME[extension],
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  async deleteCV(cvUrl: string): Promise<boolean> {
    if (!cvUrl || cvUrl.startsWith('data:')) return true;
    try {
      for (const bucket of ['resumes', 'applications', 'profiles']) {
        const marker = `/${bucket}/`;
        if (!cvUrl.includes(marker)) continue;
        const path = cvUrl.split(marker).pop()?.split('?')[0];
        if (path) {
          const { error } = await withTimeout(supabase.storage.from(bucket).remove([path]), 25_000, 'حذف السيرة الذاتية');
          return !error;
        }
      }
    } catch {
      return false;
    }
    return false;
  },

  resolveExtension(file: File): string {
    return resolveExtension(file);
  },
};
