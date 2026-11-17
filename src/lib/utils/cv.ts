import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const CV_BUCKETS = ['resumes', 'applications'];

export function extractCvStorageRef(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  for (const bucket of CV_BUCKETS) {
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
      `/${bucket}/`,
    ];
    for (const marker of markers) {
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
        if (path) return { bucket, path };
      }
    }
  }
  return null;
}

// Returns a URL the browser can actually open: signed for private storage,
// unchanged for blob:/data:/external links. Throws when signing fails so the
// caller can surface a real error instead of opening a broken public URL.
export async function resolveCvUrl(url: string): Promise<string> {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const ref = extractCvStorageRef(url);
  if (ref) {
    const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 600);
    if (error || !data?.signedUrl) {
      throw new Error('تعذر تجهيز رابط السيرة الذاتية (قد تكون الصلاحيات غير كافية)');
    }
    return data.signedUrl;
  }
  return url;
}

export function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const meta = dataUrl.slice(0, comma);
    const b64 = dataUrl.slice(comma + 1);
    const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/pdf';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Fetch the CV into a Blob without ever exposing the storage URL to the user.
export async function fetchCvBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const blobUrl = dataUrlToBlobUrl(url);
    if (!blobUrl) throw new Error('ملف السيرة الذاتية غير صالح');
    const res = await fetch(blobUrl);
    URL.revokeObjectURL(blobUrl);
    return res.blob();
  }
  const resolved = url.startsWith('blob:') ? url : await resolveCvUrl(url);
  const res = await fetch(resolved);
  if (!res.ok) throw new Error('تعذر تحميل ملف السيرة الذاتية');
  return res.blob();
}

// Popup-blocker resistant on web; uses the system browser on native.
export async function openCv(url: string): Promise<boolean> {
  if (!url) return false;

  if (Capacitor.isNativePlatform()) {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      const blob = await fetchCvBlob(url);
      const base64 = await blobToBase64(blob);
      const path = `cv_${Date.now()}.pdf`;
      await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({ url: uri, dialogTitle: 'السيرة الذاتية' });
      return true;
    }
    const signed = await resolveCvUrl(url);
    await Browser.open({ url: signed, windowName: '_blank' });
    return true;
  }

  const w = window.open('about:blank', '_blank');
  let finalUrl = url;
  if (url.startsWith('data:')) {
    finalUrl = dataUrlToBlobUrl(url) || url;
  } else if (!url.startsWith('blob:')) {
    finalUrl = await resolveCvUrl(url);
  }
  if (w && !w.closed) {
    try { w.location.replace(finalUrl); } catch { w.location.href = finalUrl; }
  } else {
    const a = document.createElement('a');
    a.href = finalUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  if (finalUrl.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(finalUrl), 60000);
  return true;
}

export async function downloadCv(url: string, name = 'applicant'): Promise<void> {
  if (!url) return;
  const blob = await fetchCvBlob(url);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `CV_${name}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

// Share the CV as an actual FILE (never as a link). The Supabase URL stays
// client-side only; the recipient receives the document itself.
export async function shareCvFile(url: string, name = 'applicant'): Promise<boolean> {
  if (!url) return false;
  const blob = await fetchCvBlob(url);
  const fileName = `CV_${name}.pdf`;
  const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    const path = fileName;
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ url: uri, dialogTitle: 'إرسال السيرة الذاتية' });
    return true;
  }

  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: fileName, text: `السيرة الذاتية — ${name}` });
    return true;
  }

  // Fallback: download the file so the user can attach it manually.
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return true;
}