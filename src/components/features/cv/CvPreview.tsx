import React, { useEffect, useRef, useState } from 'react';
import { CvData } from '../../../lib/cv/cvData';
import { loadCvFonts } from '../../../lib/cv/cvFonts';
import { CvDocument, CvFooter } from './CvDocument';

export function CvPreview({ data, avatarUrl }: { data: CvData; avatarUrl?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(794);
  const [height, setHeight] = useState(1123);
  const [fontError, setFontError] = useState('');
  useEffect(() => {
    let active = true;
    loadCvFonts().catch(() => { if (active) setFontError('تعذر تحميل الخط؛ حاول إعادة فتح المعاينة'); });
    const observer = new ResizeObserver(() => {
      if (container.current) setWidth(Math.min(794, container.current.clientWidth));
      if (documentRef.current) setHeight(documentRef.current.offsetHeight);
    });
    if (container.current) observer.observe(container.current);
    if (documentRef.current) observer.observe(documentRef.current);
    return () => { active = false; observer.disconnect(); };
  }, []);
  const scale = width / 794;
  const assets = { logoSrc: `${import.meta.env.BASE_URL}logo.png`, avatarSrc: avatarUrl };
  return <div ref={container} className="w-full max-w-[794px] mx-auto">
    {fontError && <p role="alert" className="text-sm text-red-600 mb-2">{fontError}</p>}
    <div style={{ height: height * scale, position: 'relative' }}>
      <div ref={documentRef} style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0, background: 'white' }}>
        <CvDocument data={data} assets={assets} />
        <CvFooter data={data} assets={assets} />
      </div>
    </div>
  </div>;
}
