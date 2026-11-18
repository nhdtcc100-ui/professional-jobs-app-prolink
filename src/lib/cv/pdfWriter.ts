export const PAGE_CSS_WIDTH = 794;
export const PAGE_CSS_HEIGHT = 1123;
export const PAGE_PT_WIDTH = 595.28;
export const PAGE_PT_HEIGHT = 841.89;

/** Link rectangles use CSS pixels measured from the page's top-left corner. */
export interface PdfLink {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** width/height describe the JPEG's pixels, not the CSS page or PDF points. */
export interface PdfImagePage {
  jpeg: Uint8Array;
  width: number;
  height: number;
  links: PdfLink[];
}

export function isSafePdfUri(href: string): boolean {
  if (typeof href !== 'string' || !/^[\x21-\x7e]+$/.test(href) || href.includes('\\')) return false;
  // Never permit malformed escapes or percent-encoded control characters.
  if (/%(?![0-9a-f]{2})/i.test(href) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(href)) return false;
  try {
    const url = new URL(href);
    if (/^https?:\/\//i.test(href)) {
      return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname) && !url.username && !url.password;
    }
    if (/^mailto:/i.test(href)) {
      return url.protocol === 'mailto:' && /^[^@\s<>(),;:"]+@[^@\s<>(),;:"]+$/.test(url.pathname) && !url.hash;
    }
    if (/^tel:/i.test(href)) {
      return /^tel:\+?[0-9][0-9().-]*(?:;ext=[0-9]+)?$/i.test(href);
    }
  } catch {
    return false;
  }
  return false;
}

function pdfNumber(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '') || '0';
}

function literal(value: string): string {
  return `(${value.replace(/[\\()]/g, char => `\\${char}`)})`;
}

function unicodeHex(value: string): string {
  let hex = 'FEFF';
  // Iterate UTF-16 code units so surrogate pairs retain their big-endian encoding.
  for (let i = 0; i < value.length; i++) hex += value.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function pdfDate(date: Date): string {
  const year = date.getUTCFullYear();
  if (!Number.isFinite(date.getTime()) || year < 0 || year > 9999) throw new Error('Invalid PDF creation date');
  const pad = (n: number, length = 2) => String(n).padStart(length, '0');
  return `D:${pad(year, 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function annotation(link: PdfLink): string | null {
  if (!link || !isSafePdfUri(link.href)) return null;
  const { x, y, width, height } = link;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  const left = clamp(x, PAGE_CSS_WIDTH);
  const right = clamp(x + width, PAGE_CSS_WIDTH);
  const top = clamp(y, PAGE_CSS_HEIGHT);
  const bottom = clamp(y + height, PAGE_CSS_HEIGHT);
  if (right <= left || bottom <= top) return null;

  const scaleX = PAGE_PT_WIDTH / PAGE_CSS_WIDTH;
  const scaleY = PAGE_PT_HEIGHT / PAGE_CSS_HEIGHT;
  const rect = [left * scaleX, PAGE_PT_HEIGHT - bottom * scaleY, right * scaleX, PAGE_PT_HEIGHT - top * scaleY].map(pdfNumber);
  // Very small rectangles can round to zero area in PDF point coordinates.
  if (rect[0] === rect[2] || rect[1] === rect[3]) return null;
  return `<< /Type /Annot /Subtype /Link /Rect [${rect.join(' ')}] /Border [0 0 0] /A << /S /URI /URI ${literal(link.href)} >> >>`;
}

/** Embeds one RGB JPEG per A4 page, with independent interactive URI overlays. */
export function buildImagePdf(
  pages: PdfImagePage[],
  options: { title: string; language: 'ar' | 'en'; createdAt?: Date },
): Uint8Array {
  if (!pages.length) throw new Error('A PDF requires at least one image page');
  if (options.language !== 'ar' && options.language !== 'en') throw new Error('Invalid PDF language');
  const creationDate = pdfDate(options.createdAt ?? new Date());
  const encoder = new TextEncoder();
  type PdfObject = (string | Uint8Array)[];
  const objects: PdfObject[] = [];
  const reserve = () => { objects.push([]); return objects.length; };
  const catalogId = reserve();
  const pagesId = reserve();
  const infoId = reserve();
  const pageIds: number[] = [];

  for (const page of pages) {
    if (!(page.jpeg instanceof Uint8Array) || !page.jpeg.byteLength ||
      !Number.isSafeInteger(page.width) || page.width <= 0 || !Number.isSafeInteger(page.height) || page.height <= 0) {
      throw new Error('Invalid PDF image bytes or pixel dimensions');
    }
    const pageId = reserve();
    const imageId = reserve();
    const contentId = reserve();
    pageIds.push(pageId);
    const annotationIds: number[] = [];
    for (const link of page.links) {
      const body = annotation(link);
      if (!body) continue;
      const id = reserve();
      objects[id - 1] = [body];
      annotationIds.push(id);
    }
    const annots = annotationIds.length ? ` /Annots [${annotationIds.map(id => `${id} 0 R`).join(' ')}]` : '';
    objects[pageId - 1] = [
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_PT_WIDTH} ${PAGE_PT_HEIGHT}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R${annots} >>`,
    ];
    objects[imageId - 1] = [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.byteLength} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    ];
    const content = encoder.encode(`q\n${PAGE_PT_WIDTH} 0 0 ${PAGE_PT_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`);
    objects[contentId - 1] = [`<< /Length ${content.byteLength} >>\nstream\n`, content, '\nendstream'];
  }

  objects[catalogId - 1] = [`<< /Type /Catalog /Pages ${pagesId} 0 R /Lang ${literal(options.language)} >>`];
  objects[pagesId - 1] = [`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`];
  objects[infoId - 1] = [`<< /Title ${unicodeHex(options.title)} /CreationDate ${literal(creationDate)} >>`];

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const append = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    byteLength += bytes.byteLength;
  };
  append('%PDF-1.4\n');
  append(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // Binary PDF marker.
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(byteLength);
    append(`${index + 1} 0 obj\n`);
    body.forEach(append);
    append('\nendobj\n');
  });
  const xrefOffset = byteLength;
  append(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    if (offset > 9999999999) throw new Error('PDF exceeds classic xref offset limits');
    append(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
