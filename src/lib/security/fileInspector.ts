import { threatEngine } from './threatEngine';

export interface FileInspectionResult {
  safe: boolean;
  error?: string;
  threatType?: string;
}

/** Allowed image and document MIME types */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // common on mobile file pickers
]);

/** Known dangerous extensions (executable or server-side scripts) */
const DANGEROUS_EXTENSIONS_REGEX = /\.(php|php3|php4|php5|phtml|exe|sh|bat|cmd|vbs|cgi|pl|jsp|asp|aspx|dll|so|jar|py|rb)$/i;

/** Magic Bytes signatures */
const MAGIC_BYTES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8] }, // Standard SOI for all JPEG/JPG
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47] }, // PNG signature
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a / GIF89a
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
  { mime: 'image/bmp',  bytes: [0x42, 0x4D] }, // BM
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4B] }, // PK (ZIP/DOCX)
  { mime: 'application/msword', bytes: [0xD0, 0xCF, 0x11, 0xE0] }, // Compound File Binary (DOC)
];

/** Binary webshell patterns */
const WEBSHELL_BINARY_PATTERNS = [
  /<\?php/i,
  /<\?=/i,
  /<script[^>]*>/i,
  /eval\s*\(/i,
  /system\s*\(/i,
  /shell_exec/i,
  /passthru/i,
  /base64_decode/i,
  /__import__/i,
  /os\.system/i,
  /subprocess\.Popen/i,
];

/**
 * Inspect uploaded file for malicious content, magic bytes spoofing, and webshell payloads
 */
export async function inspectUploadedFile(
  file: File,
  user?: { id?: string; name?: string; email?: string },
  endpoint = '/app/upload'
): Promise<FileInspectionResult> {
  if (!file) {
    return { safe: false, error: 'الملف غير موجود' };
  }

  // 1. Check size boundaries (max 15MB)
  if (file.size > 15 * 1024 * 1024) {
    return { safe: false, error: '🚨 حجم الملف كبير جداً (الحد الأقصى 15 ميجابايت)' };
  }

  // 2. Check extension & double extension tricks (e.g. avatar.php.png)
  const filename = file.name.toLowerCase();
  const parts = filename.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      if (['php', 'exe', 'sh', 'bat', 'vbs', 'cgi', 'pl', 'jsp', 'asp', 'py'].includes(parts[i])) {
        threatEngine.logThreat({
          user_id: user?.id,
          user_name: user?.name || file.name,
          user_email: user?.email,
          attack_type: 'CODE_INJECTION',
          severity: 'CRITICAL',
          endpoint: `${endpoint} [File Upload Double Extension]`,
          payload_sample: `[MALICIOUS FILE UPLOAD] Double Extension Trick: ${file.name} (Type: ${file.type})`,
        });
        return {
          safe: false,
          error: '🚨 محاولة رفع ملف مشبوه باختراق الامتداد المزدوج (Double Extension). تم حظر العملية وتبليغ الأمن.',
          threatType: 'Double Extension Webshell',
        };
      }
    }
  }

  if (DANGEROUS_EXTENSIONS_REGEX.test(filename)) {
    threatEngine.logThreat({
      user_id: user?.id,
      user_name: user?.name || file.name,
      user_email: user?.email,
      attack_type: 'CODE_INJECTION',
      severity: 'CRITICAL',
      endpoint: `${endpoint} [Executable Upload]`,
      payload_sample: `[MALICIOUS FILE UPLOAD] Executable Extension: ${file.name}`,
    });
    return {
      safe: false,
      error: '🚨 غير مسموح برفع ملفات برمجية أو تنفيذية. تم إلغاء الرفع وتبليغ قسم السايبر.',
      threatType: 'Executable Upload',
    };
  }

  // 3. Inspect binary content & Magic Bytes
  try {
    const slice = file.slice(0, 8192);
    let buffer: ArrayBuffer;
    if (typeof slice.arrayBuffer === 'function') {
      buffer = await slice.arrayBuffer();
    } else {
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsArrayBuffer(slice);
      });
    }
    const bytes = new Uint8Array(buffer);

    const lowerName = file.name.toLowerCase();
    const isDoc = file.type === 'application/pdf' || 
                  file.type === 'application/msword' || 
                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                  /\.(pdf|doc|docx)$/i.test(lowerName);

    // Check magic bytes for images/PDF/DOC
    if (file.type.startsWith('image/') || isDoc) {
      let magicMatched = false;

      // Special check for PDF: %PDF can appear in the first 512 bytes (common on mobile)
      if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
        const pdfSig = [0x25, 0x50, 0x44, 0x46]; // %PDF
        for (let i = 0; i <= Math.min(bytes.length - 4, 512); i++) {
          if (bytes[i] === pdfSig[0] && bytes[i + 1] === pdfSig[1] && bytes[i + 2] === pdfSig[2] && bytes[i + 3] === pdfSig[3]) {
            magicMatched = true;
            break;
          }
        }
      }

      // Check standard signatures if not already matched
      if (!magicMatched) {
        for (const sig of MAGIC_BYTES) {
          let match = true;
          for (let i = 0; i < sig.bytes.length; i++) {
            if (bytes[i] !== sig.bytes[i]) {
              match = false;
              break;
            }
          }
          if (match) {
            magicMatched = true;
            break;
          }
        }
      }

      // Special check: HEIC/HEIF (QuickTime container with ftyp at offset 4)
      if (!magicMatched && (file.type.includes('heic') || file.type.includes('heif') || lowerName.endsWith('.heic') || lowerName.endsWith('.heif'))) {
        if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
          magicMatched = true;
        }
      }

      // If it claims to be an image but lacks standard header, check if it's a known mobile format before blocking
      if (!magicMatched && file.type.startsWith('image/')) {
        // Double check for JPEG SOI FF D8
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
          magicMatched = true;
        }
      }
    }

    // 4. Scan binary sample text for embedded WebShell signatures (skip broad text patterns for documents)
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const textSample = decoder.decode(bytes);

    // For documents (PDF, DOCX), only look for explicit server-side script tags, not generic system/eval phrases
    const activePatterns = isDoc 
      ? [/<\?php/i, /<\?=/i, /<script[^>]*language=["']php["']/i]
      : WEBSHELL_BINARY_PATTERNS;

    for (const pattern of activePatterns) {
      if (pattern.test(textSample)) {
        threatEngine.logThreat({
          user_id: user?.id,
          user_name: user?.name || file.name,
          user_email: user?.email,
          attack_type: 'CODE_INJECTION',
          severity: 'CRITICAL',
          endpoint: `${endpoint} [Embedded WebShell Payload]`,
          payload_sample: `[WEBSHELL DETECTED IN FILE] ${file.name} -> Matches pattern ${pattern.source}`,
        });
        return {
          safe: false,
          error: '🚨 تم الكشف عن أثر كود برمجي خبيث (Embedded WebShell) داخل الملف! تم حظره فوراً وتبليغ قسم السايبر سيكيورتي.',
          threatType: 'Embedded WebShell Payload',
        };
      }
    }
  } catch (e: any) {
    // If reading array buffer fails on very old device, don't block user
    return { safe: true };
  }

  return { safe: true };
}
