import { supabase } from '../supabase';

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
// unchanged for blob:/data:/external links.
export async function resolveCvUrl(url: string): Promise<string> {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const ref = extractCvStorageRef(url);
  if (ref) {
    try {
      const { data } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 600);
      if (data?.signedUrl) return data.signedUrl;
    } catch {}
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

// Popup-blocker resistant: opens a blank window synchronously inside the user
// gesture, then navigates it once the real (possibly signed) URL is ready.
export async function openCv(url: string): Promise<boolean> {
  if (!url) return false;
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
  const resolved = url.startsWith('data:') || url.startsWith('blob:') ? url : await resolveCvUrl(url);
  const a = document.createElement('a');
  a.href = resolved;
  a.download = `CV_${name}.pdf`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}