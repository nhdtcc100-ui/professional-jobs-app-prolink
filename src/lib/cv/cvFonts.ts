import arabicUrl from '../../assets/fonts/noto-kufi-arabic-arabic-wght-normal.woff2?url';
import latinUrl from '../../assets/fonts/noto-kufi-arabic-latin-wght-normal.woff2?url';
import latinExtUrl from '../../assets/fonts/noto-kufi-arabic-latin-ext-wght-normal.woff2?url';

const subsets = [
  { url: arabicUrl, range: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC4,U+10EFC-10EFF,U+1EE00-1EEFF' },
  { url: latinExtUrl, range: 'U+0100-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1EFF,U+2020,U+20A0-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' },
  { url: latinUrl, range: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' },
];

let loaded: Promise<string> | undefined;

export function loadCvFonts(): Promise<string> {
  if (!loaded) {
    loaded = Promise.all(subsets.map(async ({ url, range }) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('تعذر تحميل خط السيرة الذاتية');
      const bytes = await response.arrayBuffer();
      const face = new FontFace('ProlinkCv', bytes, { weight: '100 900', style: 'normal', unicodeRange: range });
      await face.load();
      document.fonts.add(face);
      let binary = '';
      const array = new Uint8Array(bytes);
      for (let i = 0; i < array.length; i += 8192) binary += String.fromCharCode(...array.subarray(i, i + 8192));
      return `@font-face{font-family:ProlinkCv;src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');font-weight:100 900;font-style:normal;unicode-range:${range};}`;
    })).then(css => css.join('')).catch(error => {
      loaded = undefined;
      throw error;
    });
  }
  return loaded;
}
