import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ZoomIn, ZoomOut, RotateCcw, ChevronRight, ChevronLeft,
  FileText, Loader2, AlertCircle, RefreshCw, CheckCircle2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Initialize PDF.js worker with Vite asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfSource: string | ArrayBuffer | null; // Can be a URL, signed URL, or raw ArrayBuffer
  title?: string;
  userName?: string;
  userAvatar?: string;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  pdfSource,
  title = 'معاينة السيرة الذاتية (CV)',
  userName,
  userAvatar,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── 1. Load Document ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !pdfSource) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    const loadDoc = async () => {
      try {
        let loadingTask: any;

        if (typeof pdfSource === 'string') {
          // If it's a Word document
          if (pdfSource.toLowerCase().includes('.doc')) {
            throw new Error('ملفات Word (.doc/.docx) لا يمكن معاينتها مباشرة كـ PDF. يرجى رفع ملف بصيغة PDF.');
          }

          // Fetch bytes first to bypass CORS/iframe restrictions safely
          const res = await fetch(pdfSource);
          if (!res.ok) {
            if (res.status === 403) throw new Error('غير مصرح بالوصول إلى الملف (403).');
            if (res.status === 404) throw new Error('الملف غير موجود في التخزين (404).');
            throw new Error(`تعذر جلب الملف (رمز الاستجابة: ${res.status}).`);
          }
          const buf = await res.arrayBuffer();
          if (buf.byteLength === 0) throw new Error('الملف فارغ أو تالف (0 بايت).');
          loadingTask = pdfjsLib.getDocument({ data: buf });
        } else {
          // ArrayBuffer directly
          if (pdfSource.byteLength === 0) throw new Error('الملف فارغ أو تالف.');
          loadingTask = pdfjsLib.getDocument({ data: pdfSource });
        }

        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[PDFViewerModal] Load error:', err);
        setError(err?.message || 'تعذر تحميل أو قراءة ملف السيرة الذاتية.');
        setLoading(false);
      }
    };

    loadDoc();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy(); } catch (_) {}
        pdfDocRef.current = null;
      }
    };
  }, [isOpen, pdfSource]);

  // ─── 2. Render Current Page to Canvas ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !pdfDocRef.current || loading || error) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Cancel previous ongoing render task if active
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
          renderTaskRef.current = null;
        }

        // Adjust scale for High-DPI (Retina) screens for crystal-clear text
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[PDFViewerModal] Render page error:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [isOpen, currentPage, scale, loading, error]);

  // ─── Controls ────────────────────────────────────────────────────────────────
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 2.8));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.6));
  const handleResetZoom = () => setScale(1.2);
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, numPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="w-full h-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Top Bar: User Info & Close ── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              {userAvatar ? (
                <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                  <img src={userAvatar} alt={userName || ''} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-300 flex items-center justify-center shadow-sm shrink-0">
                  <FileText size={20} />
                </div>
              )}
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm sm:text-base leading-tight">
                  {userName || title}
                </h3>
                <p className="text-[11px] text-[#0a66c2] dark:text-blue-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> معاينة مباشرة وآمنة داخل التطبيق
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all border border-red-200 dark:border-red-800/60 shadow-sm flex items-center justify-center cursor-pointer"
                title="إغلاق (X)"
              >
                <X size={20} />
              </motion.button>
            </div>
          </div>

          {/* ── Toolbar: Zoom & Page Controls (Only when loaded) ── */}
          {!loading && !error && numPages > 0 && (
            <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 shrink-0 text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
              {/* Pagination */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-2xs"
                  title="الصفحة السابقة"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="px-2 py-1 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-black">
                  صفحة {currentPage} من {numPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-2xs"
                  title="الصفحة التالية"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleZoomOut}
                  disabled={scale <= 0.6}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-2xs"
                  title="تصغير"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="px-2 py-1 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-black min-w-[48px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 2.8}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-2xs"
                  title="تكبير"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-2xs"
                  title="إعادة ضبط الحجم"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Content Area: Native Canvas Renderer ── */}
          <div
            ref={containerRef}
            className="flex-1 w-full bg-slate-200/80 dark:bg-slate-950 overflow-auto flex items-center justify-center p-3 sm:p-6"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-[#0a66c2] dark:text-blue-400 flex items-center justify-center shadow-md">
                  <Loader2 size={28} className="animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                    جاري إعداد وعرض السيرة الذاتية...
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    يتم تحويل صفحات المستند بجودة عالية للعرض الفوري
                  </p>
                </div>
                {/* Skeleton placeholders */}
                <div className="w-56 space-y-2 mt-2">
                  <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-800 animate-pulse w-full" />
                  <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-800 animate-pulse w-4/5 mx-auto" />
                  <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-800 animate-pulse w-2/3 mx-auto" />
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-red-200 dark:border-red-900/50">
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center shadow-sm">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
                    تعذر عرض السيرة الذاتية
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {error}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      // Trigger re-fetch
                      const s = pdfSource;
                      pdfDocRef.current = null;
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-black transition-all flex items-center gap-2 shadow-md active:scale-95"
                  >
                    <RefreshCw size={14} />
                    <span>إعادة المحاولة</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black transition-all hover:bg-slate-200 active:scale-95"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center py-2 transition-transform duration-200">
                <canvas
                  ref={canvasRef}
                  className="rounded-xl shadow-2xl bg-white border border-slate-300 dark:border-slate-700 max-w-full"
                />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

