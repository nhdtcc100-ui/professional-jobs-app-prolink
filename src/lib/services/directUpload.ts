import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_STORAGE_KEY, LEGACY_AUTH_STORAGE_KEY } from '../supabase';
import { withTimeout } from '../utils/withTimeout';

const SESSION_EXPIRED = 'جلسة الدخول غير متاحة أو منتهية. أعد تسجيل الدخول ثم حاول مجدداً.';

function readStoredSession(): { access_token?: string; expires_at?: number } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.currentSession || parsed;
  } catch {
    return null;
  }
}

// Auto-refresh pauses while the tab is hidden, so the stored token is often
// expired on return; getSession refreshes it instead of failing the upload.
async function getAccessToken(): Promise<string> {
  const stored = readStoredSession();
  if (stored?.access_token && (!stored.expires_at || stored.expires_at * 1000 > Date.now() + 30_000)) {
    return stored.access_token;
  }
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), 15_000, 'تجديد الجلسة');
    if (data.session?.access_token) return data.session.access_token;
  } catch {}
  throw new Error(SESSION_EXPIRED);
}

export async function uploadRequest<T>(path: string, init: RequestInit, timeoutMs = 25000): Promise<T> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(res.status === 401
        ? 'انتهت جلسة الدخول. أعد تسجيل الدخول ثم حاول مجدداً.'
        : `تعذر حفظ الملف (${res.status}). تحقق من الاتصال وأعد المحاولة.`);
    }
    return await res.json();
  } catch (err) {
    if (controller.signal.aborted) throw new Error('انتهت مهلة الرفع، تحقق من الاتصال وأعد المحاولة.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function readUploadFile(file: File, timeoutMs = 10000): Promise<File> {
  if (!file.size) return Promise.reject(new Error('الملف فارغ أو غير قابل للقراءة.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => reader.abort(), timeoutMs);
    reader.onload = () => {
      clearTimeout(timer);
      if (!(reader.result instanceof ArrayBuffer) || !reader.result.byteLength) {
        reject(new Error('تعذرت قراءة الملف من الجهاز.'));
        return;
      }
      const snapshot = new File([reader.result], file.name, { type: file.type, lastModified: file.lastModified });
      resolve(snapshot);
    };
    reader.onerror = () => { clearTimeout(timer); reject(new Error('تعذرت قراءة الملف من الجهاز.')); };
    reader.onabort = () => { clearTimeout(timer); reject(new Error('انتهت مهلة قراءة الملف من الجهاز. اختره مجدداً.')); };
    try {
      reader.readAsArrayBuffer(file);
    } catch {
      clearTimeout(timer);
      reject(new Error('تعذرت قراءة الملف من الجهاز. اختره مجدداً.'));
    }
  });
}

export interface DirectUploadOptions {
  bucket: string;
  path: string;
  contentType: string;
  timeoutMs?: number;
}

export async function uploadToStorageDirect(
  body: ArrayBuffer | Blob,
  { bucket, path, contentType, timeoutMs = 25000 }: DirectUploadOptions
): Promise<string> {
  const objectPath = `${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  await uploadRequest(`/storage/v1/object/${objectPath}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'false', 'cache-control': 'max-age=3600' },
    body,
  }, timeoutMs);
  // CV readers resolve this stable reference to a signed URL for private buckets.
  return `${SUPABASE_URL}/storage/v1/object/public/${objectPath}`;
}
