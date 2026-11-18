import React, { useEffect, useRef, useState } from 'react';
import { CvData } from '../../../lib/cv/cvData';
import { loadCvFonts } from '../../../lib/cv/cvFonts';
import { cvExportAssets } from '../../../lib/cv/cvExport';
import { CV_FOOTER_TOP, CV_OVERFLOW_MESSAGE, fitCvPage } from '../../../lib/cv/cvPagination';
import { CvAssets, CvDocument, CvFooter } from './CvDocument';

export function CvPreview({ data, avatarUrl }: { data: CvData; avatarUrl?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(794);
  const [height, setHeight] = useState(240);
  const [assets, setAssets] = useState<CvAssets>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const photo = data.settings.showPhoto ? avatarUrl : undefined;
  useEffect(() => {
    let active = true;
    setReady(false);
    setError('');
    Promise.all([loadCvFonts(), cvExportAssets(photo)]).then(([, nextAssets]) => {
      if (active) { setAssets(nextAssets); setReady(true); }
    }).catch(() => { if (active) setError('تعذر تحميل معاينة السيرة؛ أعد فتحها للمحاولة مجدداً.'); });
    return () => { active = false; };
  }, [photo]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (container.current?.clientWidth) setWidth(Math.min(794, container.current.clientWidth));
      if (documentRef.current) {
        const measured = Math.ceil(parseFloat(getComputedStyle(documentRef.current).height));
        if (measured > 0) setHeight(measured);
      }
    });
    if (container.current) observer.observe(container.current);
    if (documentRef.current) observer.observe(documentRef.current);
    return () => observer.disconnect();
  }, []);
  const layout = fitCvPage(height);
  const scale = width / 794;
  const footerTop = Math.max(CV_FOOTER_TOP, layout.height + 28);
  const paperHeight = footerTop + 68;
  return <div data-cv-preview data-cv-fit={ready ? layout.fits ? 'fits' : 'overflow' : 'loading'} className="mx-auto w-full max-w-[794px] space-y-3">
    <p role="status" className={`text-xs font-bold ${ready && !layout.fits ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{!ready ? 'جارٍ تجهيز المعاينة…' : layout.fits ? 'ورقة واحدة · A4' : 'المحتوى يتجاوز ورقة واحدة'}</p>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {ready && !layout.fits && <p role="alert" className="rounded-2xl bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{CV_OVERFLOW_MESSAGE}</p>}
    <div ref={container} className="w-full">
      <div style={{ height: paperHeight * scale, position: 'relative' }}>
        <div data-cv-paper style={{ width: 794, height: paperHeight, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0, background: 'white', boxShadow: '0 4px 24px #172b4d14' }}>
          <div ref={documentRef} style={{ width: 794, position: 'absolute', left: layout.x, top: 0, transform: `scale(${layout.scale})`, transformOrigin: 'top left' }}>
            <CvDocument data={data} assets={assets} />
          </div>
          <div style={{ position: 'absolute', left: 0, top: footerTop }}><CvFooter data={data} assets={assets} /></div>
        </div>
      </div>
    </div>
  </div>;
}
