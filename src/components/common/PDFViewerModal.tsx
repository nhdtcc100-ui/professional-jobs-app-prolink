/**
 * PDFViewerModal — Zero-freeze CV Viewer
 * ───────────────────────────────────────
 * Strategy (in order):
 *  1. Resolve a short-lived signed URL from Supabase storage (non-blocking, 4s timeout).
 *  2. Render via Google Docs Viewer inside an <iframe>  → 0 pdfjs, 0 canvas, 0 main-thread work.
 *  3. If Google Viewer fails (network / CORS), fall back to native <object> tag.
 *  4. Always show a direct "فتح خارجي" link as escape hatch.
 *
 * Why this eliminates the freeze:
 *  • No arrayBuffer() call on the main thread.
 *  • No pdfjs worker initialisation blocking the event loop.
 *  • Google renders the PDF on their CDN — the browser just shows an iframe.
 *  • Signed-URL generation has a strict 4s timeout; on failure we fall back to
 *    the original URL (may show 403 inside the iframe, which is recoverable with
 *    the external-link button — still no app freeze).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X, FileText, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, ExternalLink, Monitor,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Storage public URL, signed URL, blob URL, or data URL */
  pdfSource: string | ArrayBuffer | null;
  title?: string;
  userName?: string;
  userAvatar?: string;
}

type ViewerMode = 'resolving' | 'google' | 'object' | 'error';

// ─── Constants ───────────────────────────────────────────────────────────────
const SIGNED_URL_TIMEOUT_MS = 4_000;
const GOOGLE_VIEWER_BASE = 'https://docs.google.com/viewer?embedded=true&url=';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract bucket + path from any Supabase storage URL and return a fresh
 * short-lived signed URL.  Falls back to the original URL on any error.
 * This runs async and NEVER blocks the main thread.
 */
async function getSignedUrl(source: string): Promise<string> {
  if (!source) return source;
  if (source.startsWith('blob:') || source.startsWith('data:')) return source;

  let bucket = '';
  let path = '';

  const MARKERS: Array<{ marker: string; bkt: string }> = [
    { marker: '/storage/v1/object/public/resumes/', bkt: 'resumes' },
    { marker: '/storage/v1/object/public/applications/', bkt: 'applications' },
    { marker: '/storage/v1/object/sign/resumes/', bkt: 'resumes' },
    { marker: '/storage/v1/object/sign/applications/', bkt: 'applications' },
    { marker: '/resumes/', bkt: 'resumes' },
    { marker: '/applications/', bkt: 'applications' },
  ];

  for (const { marker, bkt } of MARKERS) {
    if (source.includes(marker)) {
      bucket = bkt;
      path = decodeURIComponent(source.split(marker)[1]?.split('?')[0] || '');
      break;
    }
  }

  if (!bucket || !path) return source;

  try {
    const race = new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), SIGNED_URL_TIMEOUT_MS);
      supabase.storage
        .from(bucket)
        .createSignedUrl(path, 600)
        .then(({ data, error }) => {
          clearTimeout(t);
          if (!error && data?.signedUrl) resolve(data.signedUrl);
          else reject(error || new Error('no-signed-url'));
        })
        .catch((e) => { clearTimeout(t); reject(e); });
    });
    return await race;
  } catch (e) {
    console.warn('[PDFViewerModal] signed-url failed, using original:', e);
    return source;
  }
}

/** Build a Google Docs Viewer URL from a resolved direct URL */
function buildGoogleViewerUrl(resolvedUrl: string): string {
  return GOOGLE_VIEWER_BASE + encodeURIComponent(resolvedUrl);
}

// ─── Component ───────────────────────────────────────────────────────────────
export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  pdfSource,
  title = 'معاينة السيرة الذاتية (CV)',
  userName,
  userAvatar,
}) => {
  const [mode, setMode] = useState<ViewerMode>('resolving');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [googleViewerUrl, setGoogleViewerUrl] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveAbortRef = useRef(false);

  // ─── Body scroll safety: never leave body overflow stuck ──────────────────
  useEffect(() => {
    return () => {
      try {
        document.body.style.overflow = '';
      } catch (_) {}
    };
  }, [isOpen]);

  // ─── ESC key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ─── Main: resolve URL & prepare viewers ──────────────────────────────────
  const resolveAndOpen = useCallback(async () => {
    if (!pdfSource) {
      setMode('error');
      return;
    }
    setMode('resolving');
    setIframeLoaded(false);
    setIframeError(false);
    resolveAbortRef.current = false;

    let raw: string;
    if (typeof pdfSource === 'string') {
      raw = pdfSource;
    } else {
      // ArrayBuffer → blob URL (happens from profile page pending file)
      const blob = new Blob([pdfSource], { type: 'application/pdf' });
      raw = URL.createObjectURL(blob);
    }

    // Check Word document
    if (raw.toLowerCase().includes('.doc') && !raw.toLowerCase().includes('.pdf')) {
      setResolvedUrl(raw);
      setGoogleViewerUrl(buildGoogleViewerUrl(raw));
      setMode('google'); // Google Docs Viewer supports Word files too
      return;
    }

    // Resolve signed URL in background — does NOT block anything
    const signed = await getSignedUrl(raw);
    if (resolveAbortRef.current) return; // modal was closed during resolution

    setResolvedUrl(signed);

    if (signed.startsWith('data:') || signed.startsWith('blob:')) {
      // Data/Blob URLs can't go through Google Viewer — use <object> directly
      setMode('object');
    } else {
      setGoogleViewerUrl(buildGoogleViewerUrl(signed));
      setMode('google');
    }
  }, [pdfSource]);

  useEffect(() => {
    if (!isOpen) {
      resolveAbortRef.current = true;
      setMode('resolving');
      setResolvedUrl(null);
      setGoogleViewerUrl(null);
      setIframeLoaded(false);
      setIframeError(false);
      if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
      return;
    }
    resolveAndOpen();
  }, [isOpen, reloadKey, resolveAndOpen]);

  // ─── Iframe load / error handling ─────────────────────────────────────────
  // Google Viewer may load silently with an error page inside the iframe.
  // We can't detect cross-origin errors, so we give it 20s before showing fallback.
  useEffect(() => {
    if (mode !== 'google') {
      if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
      return;
    }
    setIframeLoaded(false);
    setIframeError(false);
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    iframeTimerRef.current = setTimeout(() => {
      if (!iframeLoaded) {
        setIframeError(true); // Google viewer timed out → switch to object
      }
    }, 20_000);
    return () => { if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current); };
  }, [mode, googleViewerUrl]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
  }, []);

  // Auto-fallback when Google Viewer times out
  useEffect(() => {
    if (iframeError && mode === 'google') {
      setMode('object');
    }
  }, [iframeError, mode]);

  if (typeof document === 'undefined' || !isOpen) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  const modalContent = (
    <motion.div
      key="cv-backdrop"
      className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        key="cv-modal"
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full h-full max-w-4xl max-h-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {userAvatar ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                <img src={userAvatar} alt={userName || ''} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-300 flex items-center justify-center shadow-sm shrink-0">
                <FileText size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-black text-slate-800 dark:text-white text-sm sm:text-base leading-tight truncate max-w-[180px] sm:max-w-xs">
                {userName || title}
              </h3>
              <p className="text-[10px] text-[#0a66c2] dark:text-blue-400 font-bold flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={10} />
                معاينة آمنة داخل التطبيق
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* External open button — always available */}
            {resolvedUrl && (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all border border-emerald-200 dark:border-emerald-800/60 text-xs font-black shadow-sm"
                title="فتح في تطبيق خارجي / تنزيل"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">فتح خارجي</span>
              </a>
            )}

            {/* Fallback: switch viewer */}
            {mode === 'google' && iframeLoaded && (
              <button
                onClick={() => setMode('object')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 text-xs font-black shadow-sm"
                title="تبديل طريقة العرض"
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">تبديل</span>
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all border border-red-200 dark:border-red-800/60 shadow-sm flex items-center justify-center cursor-pointer"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 relative overflow-hidden bg-slate-100 dark:bg-slate-950">

          {/* RESOLVING STATE */}
          {mode === 'resolving' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-400 flex items-center justify-center shadow-md">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white">
                  جاري تحضير السيرة الذاتية...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  يتم إنشاء رابط آمن للمعاينة
                </p>
              </div>
              <div className="w-48 space-y-2 mt-1">
                <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse w-full" />
                <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse w-3/4 mx-auto" />
                <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse w-1/2 mx-auto" />
              </div>
            </div>
          )}

          {/* GOOGLE DOCS VIEWER (primary) */}
          {mode === 'google' && googleViewerUrl && (
            <>
              {/* Loading overlay until iframe fires onLoad */}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-950 z-10 pointer-events-none">
                  <Loader2 size={32} className="animate-spin text-[#0a66c2] dark:text-blue-400" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    جاري تحميل الملف...
                  </p>
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={`google-${reloadKey}-${googleViewerUrl}`}
                src={googleViewerUrl}
                className="w-full h-full border-0"
                title={userName || title}
                onLoad={handleIframeLoad}
                onError={() => setIframeError(true)}
                allow="fullscreen"
              />
            </>
          )}

          {/* NATIVE OBJECT TAG (fallback) */}
          {mode === 'object' && resolvedUrl && (
            <div className="absolute inset-0 flex flex-col">
              <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-bold shrink-0">
                <AlertCircle size={13} />
                يتم استخدام العارض الاحتياطي المدمج في المتصفح
              </div>
              <object
                key={`obj-${reloadKey}`}
                data={resolvedUrl}
                type="application/pdf"
                className="flex-1 w-full"
              >
                {/* Final fallback if <object> not supported */}
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center shadow-sm">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">
                      لا يدعم هذا المتصفح المعاينة المدمجة
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      استخدم زر «فتح خارجي» لتحميل أو عرض السيرة الذاتية
                    </p>
                  </div>
                  {resolvedUrl && (
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-2xl bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-black transition-all flex items-center gap-2 shadow-md active:scale-95"
                    >
                      <ExternalLink size={14} />
                      فتح السيرة الذاتية
                    </a>
                  )}
                </div>
              </object>
            </div>
          )}

          {/* ERROR STATE */}
          {mode === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-red-200 dark:border-red-900/50 p-8 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center shadow-sm">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white">
                    لا يوجد ملف سيرة ذاتية
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    لم يرفع هذا المتقدم سيرة ذاتية بعد
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black transition-all hover:bg-slate-200 active:scale-95"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: mode indicator + retry ── */}
        {mode !== 'resolving' && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
              {mode === 'google' && '🌐 معاينة عبر Google Docs'}
              {mode === 'object' && '💻 عارض المتصفح المدمج'}
              {mode === 'error' && '❌ تعذّر التحميل'}
            </span>
            <button
              onClick={() => {
                setReloadKey(k => k + 1);
              }}
              className="flex items-center gap-1 text-[10px] font-black text-[#0a66c2] dark:text-blue-400 hover:text-[#004182] dark:hover:text-blue-300 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <RefreshCw size={11} />
              إعادة المحاولة
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
};
