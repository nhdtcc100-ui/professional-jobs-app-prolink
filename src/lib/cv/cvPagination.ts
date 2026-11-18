import { PAGE_CSS_WIDTH } from './pdfWriter';

export const CV_CONTENT_HEIGHT = 1027;
export const CV_FOOTER_TOP = 1055;
export const CV_MIN_SCALE = 0.9;
export const CV_OVERFLOW_MESSAGE = 'المحتوى أطول من ورقة A4 واحدة. اختصر النبذة أو تفاصيل الخبرات والشهادات؛ لن نحذف بياناتك أو نصغّرها إلى خط غير مقروء.';

export function fitCvPage(contentHeight: number) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) throw new Error('Invalid CV height');
  const scale = Math.max(CV_MIN_SCALE, Math.min(1, CV_CONTENT_HEIGHT / contentHeight));
  const height = contentHeight * scale;
  return { scale, x: PAGE_CSS_WIDTH * (1 - scale) / 2, height, fits: height <= CV_CONTENT_HEIGHT + 0.001 };
}
