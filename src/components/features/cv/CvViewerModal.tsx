import React, { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Download, Share2, Loader2 } from 'lucide-react';
import { CvData } from '../../../lib/cv/cvData';
import { exportCvPdf, shareCvPdf, downloadCvPdf } from '../../../lib/cv/cvExport';
import { CvPreview } from './CvPreview';

export function CvViewerModal({ data, avatarUrl, onClose }: { data: CvData; avatarUrl?: string; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') || []).filter(element => element.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      const outside = !dialog.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    const handler = Capacitor.isNativePlatform() ? App.addListener('backButton', onClose) : null;
    return () => {
      document.removeEventListener('keydown', key, true);
      handler?.then(listener => listener.remove());
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);
  useEffect(() => {
    generation.current++;
    setBlob(null); setBusy(false); setError('');
    return () => { generation.current++; };
  }, [data, avatarUrl]);
  const prepare = async () => {
    const ticket = ++generation.current;
    setBusy(true); setError('');
    try {
      const prepared = await exportCvPdf(data, avatarUrl);
      if (ticket === generation.current) setBlob(prepared);
    } catch (e) {
      if (ticket === generation.current) setError(e instanceof Error ? e.message : 'تعذر تجهيز PDF');
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  };
  const deliver = async (share: boolean) => {
    if (!blob) return;
    setError('');
    try { await (share ? shareCvPdf(blob, data) : downloadCvPdf(blob, data)); }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setError('تعذر مشاركة الملف؛ حاول تنزيله'); }
  };
  return <div ref={dialog} role="dialog" aria-modal="true" aria-label="معاينة السيرة الذاتية" dir="rtl" className="fixed inset-0 z-[1300] bg-slate-100 dark:bg-slate-950 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
    <header className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <button onClick={onClose} aria-label="رجوع" className="p-2 rounded-lg"><ArrowRight size={22} /></button>
      <h1 className="font-bold text-slate-800 dark:text-white flex-1">السيرة الذاتية</h1>
      {!blob ? <button onClick={prepare} disabled={busy} className="bg-[#0a66c2] text-white px-4 py-2 rounded-lg disabled:opacity-50 flex gap-2 items-center">{busy && <Loader2 className="animate-spin" size={18} />}{busy ? 'جاري التجهيز...' : 'تجهيز PDF'}</button> : <>
        <button onClick={() => deliver(true)} className="bg-[#0a66c2] text-white px-3 py-2 rounded-lg flex items-center gap-2"><Share2 size={18} />مشاركة</button>
        <button onClick={() => deliver(false)} className="border border-slate-300 px-3 py-2 rounded-lg flex items-center gap-2"><Download size={18} />تنزيل</button>
      </>}
    </header>
    {error && <p role="alert" className="p-3 text-red-600 text-sm">{error}</p>}
    <div className="overflow-y-auto flex-1 p-3 sm:p-6"><CvPreview data={data} avatarUrl={avatarUrl} /></div>
  </div>;
}
