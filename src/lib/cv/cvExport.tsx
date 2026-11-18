import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { CvDocument, CvFooter, CV_DOCUMENT_RESET, CvAssets } from '../../components/features/cv/CvDocument';
import { CvData, CV_LABELS, cvFileName, cvHasContent, normalizeCvData } from './cvData';
import { loadCvFonts } from './cvFonts';
import { allowedBreaks, computePageSlices } from './cvPagination';
import { buildImagePdf, PdfLink, PdfImagePage } from './pdfWriter';
import { shareCvFile } from '../utils/cv';

const WIDTH = 794;
const HEIGHT = 1123;
const CONTENT_HEIGHT = 1027;
const NEXT_TOP = 28;
let exportBusy = false;

async function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(blob);
  });
}

async function embedImage(url: string, size: number): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('تعذر تحميل الصورة');
  const blob = await response.blob();
  if (blob.size > 15 * 1024 * 1024) throw new Error('الصورة كبيرة جداً');
  const image = new Image();
  image.src = await blobDataUrl(blob);
  await image.decode();
  const ratio = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('هذا الجهاز لا يدعم تجهيز السيرة الذاتية');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function cvExportAssets(avatarUrl?: string): Promise<CvAssets> {
  const logoSrc = await embedImage(`${import.meta.env.BASE_URL}logo.png`, 192);
  let avatarSrc: string | undefined;
  if (avatarUrl) {
    try {
      const resolved = new URL(avatarUrl, location.href);
      if (resolved.origin === location.origin || resolved.protocol === 'https:') avatarSrc = await embedImage(resolved.href, 384);
    } catch { /* An optional photo must not prevent export. */ }
  }
  return { logoSrc, avatarSrc };
}

function collectLinks(element: HTMLElement): PdfLink[] {
  const origin = element.getBoundingClientRect();
  return Array.from(element.querySelectorAll<HTMLElement>('[data-cv-href]')).flatMap(link =>
    Array.from(link.getClientRects()).map(rect => ({
      href: link.dataset.cvHref || '',
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    }))
  );
}

async function rasterPage(svg: string): Promise<Uint8Array> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * 2;
  canvas.height = HEIGHT * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('هذا الجهاز لا يدعم تصدير PDF');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('تعذر تجهيز صفحة السيرة الذاتية')), 'image/jpeg', 0.92);
  });
  canvas.width = canvas.height = 1;
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportCvPdf(input: CvData, avatarUrl?: string): Promise<Blob> {
  if (exportBusy) throw new Error('يجري تجهيز سيرة ذاتية أخرى؛ انتظر قليلاً');
  const data = normalizeCvData(input);
  if (!cvHasContent(data)) throw new Error('أدخل الاسم وبعض تفاصيل السيرة قبل التصدير');
  exportBusy = true;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;pointer-events:none;z-index:-1;';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const [fontCss, assets] = await Promise.all([loadCvFonts(), cvExportAssets(data.settings.showPhoto ? avatarUrl : undefined)]);
    flushSync(() => root.render(<><CvDocument data={data} assets={assets} /><div data-cv-footer><CvFooter data={data} assets={assets} /></div></>));
    await document.fonts.load('400 13px ProlinkCv', 'عمل Curriculum Vitae');
    await Promise.all(Array.from(host.querySelectorAll('img')).map(image => image.decode()));
    const doc = host.querySelector<HTMLElement>('.prolink-cv')!;
    const docRect = doc.getBoundingClientRect();
    const total = Math.ceil(docRect.height);
    const breaks = allowedBreaks(Array.from(doc.querySelectorAll<HTMLElement>('[data-cv-block]')).map(block => {
      const rect = block.getBoundingClientRect();
      return { top: rect.top - docRect.top, bottom: rect.bottom - docRect.top, keepWithNext: block.hasAttribute('data-cv-keep') };
    }));
    const slices = computePageSlices(total, breaks, CONTENT_HEIGHT, CONTENT_HEIGHT - NEXT_TOP);
    const serialized = new XMLSerializer().serializeToString(doc);
    const allLinks = collectLinks(doc);
    const pages: PdfImagePage[] = [];
    for (let index = 0; index < slices.length; index++) {
      const slice = slices[index];
      const top = index === 0 ? 0 : NEXT_TOP;
      flushSync(() => root.render(<><CvDocument data={data} assets={assets} /><div data-cv-footer><CvFooter data={data} assets={assets} page={index + 1} total={slices.length} /></div></>));
      const footer = host.querySelector<HTMLElement>('[data-cv-footer] .prolink-cv')!;
      const footerMarkup = new XMLSerializer().serializeToString(footer);
      const footerY = HEIGHT - 68;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * 2}" height="${HEIGHT * 2}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="white"/><svg x="0" y="${top}" width="${WIDTH}" height="${slice.height}" viewBox="0 ${slice.start} ${WIDTH} ${slice.height}" style="overflow:hidden"><foreignObject x="0" y="0" width="${WIDTH}" height="${total}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${fontCss}${CV_DOCUMENT_RESET}</style>${serialized}</div></foreignObject></svg><foreignObject x="0" y="${footerY}" width="${WIDTH}" height="48"><div xmlns="http://www.w3.org/1999/xhtml"><style>${fontCss}${CV_DOCUMENT_RESET}</style>${footerMarkup}</div></foreignObject></svg>`;
      const links = allLinks.flatMap(link => {
        const yStart = Math.max(link.y, slice.start);
        const yEnd = Math.min(link.y + link.height, slice.start + slice.height);
        if (yEnd <= yStart) return [];
        return [{ ...link, y: yStart - slice.start + top, height: yEnd - yStart }];
      });
      links.push(...collectLinks(footer).map(link => ({ ...link, y: link.y + footerY })));
      pages.push({ jpeg: await rasterPage(svg), width: WIDTH * 2, height: HEIGHT * 2, links });
    }
    const pdf = buildImagePdf(pages, { title: `${CV_LABELS[data.settings.language].documentTitle} — ${data.personal.fullName}`, language: data.settings.language });
    return new Blob([pdf as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error('تعذر تجهيز السيرة الذاتية؛ حاول مرة أخرى');
  } finally {
    root.unmount();
    host.remove();
    exportBusy = false;
  }
}

export async function downloadCvPdf(blob: Blob, data: CvData): Promise<void> {
  if (Capacitor.isNativePlatform()) return shareCvPdf(blob, data);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = cvFileName(data);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function shareCvPdf(blob: Blob, data: CvData): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    try { await shareCvFile(url, data.personal.fullName.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60)); }
    finally { URL.revokeObjectURL(url); }
    return;
  }
  const file = new File([blob], cvFileName(data), { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: data.personal.fullName });
  } else {
    await downloadCvPdf(blob, data);
  }
}
