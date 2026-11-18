import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function loadModule(relativePath) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const cv = await loadModule('../src/lib/cv/cvData.ts');
const pdf = await loadModule('../src/lib/cv/pdfWriter.ts');
const pagination = await loadModule('../src/lib/cv/cvPagination.ts');
const { buildImagePdf, isSafePdfUri, PAGE_CSS_WIDTH, PAGE_CSS_HEIGHT, PAGE_PT_WIDTH, PAGE_PT_HEIGHT } = pdf;
const { fitCvPage, CV_CONTENT_HEIGHT, CV_MIN_SCALE } = pagination;

// A small RGB JPEG; extra binary suffixes below exercise byte-oriented serialization.
const JPEG = new Uint8Array(Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgA//Z',
  'base64',
));
const OPTIONS = { title: 'السيرة الذاتية (CV)', language: 'ar', createdAt: new Date('2026-11-17T12:34:56Z') };
const imagePage = (links = [], overrides = {}) => ({ jpeg: JPEG, width: 1, height: 1, links, ...overrides });
const link = (href = 'https://example.com/', overrides = {}) => ({ href, x: 79.4, y: 112.3, width: 158.8, height: 224.6, ...overrides });

function parsePdf(bytes) {
  assert.ok(bytes instanceof Uint8Array);
  const buffer = Buffer.from(bytes);
  const text = buffer.toString('latin1'); // One character per byte, including image bytes.
  assert.ok(buffer.subarray(0, 9).equals(Buffer.from('%PDF-1.4\n')));
  const ending = /startxref\n(\d+)\n%%EOF\n?$/.exec(text);
  assert.ok(ending, 'PDF has a terminal startxref and EOF');
  const xrefOffset = Number(ending[1]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 5), 'xref\n');
  const table = text.slice(xrefOffset);
  const header = /^xref\n0 (\d+)\n/.exec(table);
  assert.ok(header);
  const count = Number(header[1]);
  const rows = table.slice(header[0].length).split('\n').slice(0, count);
  assert.equal(rows.length, count);
  assert.equal(rows[0], '0000000000 65535 f ');
  const offsets = rows.map((row, index) => {
    assert.match(row, /^\d{10} \d{5} [fn] $/, `xref row ${index}`);
    if (index) assert.match(row, /^\d{10} 00000 n $/);
    return Number(row.slice(0, 10));
  });
  const objects = new Map();
  for (let id = 1; id < count; id++) {
    assert.ok(offsets[id] > offsets[id - 1], 'object byte offsets strictly increase');
    const object = buffer.subarray(offsets[id], offsets[id + 1] ?? xrefOffset);
    assert.ok(object.subarray(0, `${id} 0 obj\n`.length).equals(Buffer.from(`${id} 0 obj\n`)), `xref points to object ${id}`);
    assert.match(object.toString('latin1'), /\nendobj\n$/);
    objects.set(id, object);
  }
  const trailer = /trailer\n<<([\s\S]*?)>>/.exec(table)?.[1];
  assert.ok(trailer);
  assert.match(trailer, new RegExp(`/Size ${count}\\b`));
  const reference = key => {
    const match = new RegExp(`/${key} (\\d+) 0 R`).exec(trailer);
    assert.ok(match, `trailer has ${key}`);
    return objects.get(Number(match[1])).toString('latin1');
  };
  return { buffer, text, objects, catalog: reference('Root'), info: reference('Info') };
}

function streamBytes(object) {
  const text = object.toString('latin1');
  const start = text.indexOf('stream\n') + 7;
  assert.ok(start >= 7);
  const length = Number(/\/Length (\d+)\b/.exec(text.slice(0, start))?.[1]);
  assert.ok(Number.isSafeInteger(length));
  assert.equal(text.slice(start + length, start + length + 10), '\nendstream');
  return object.subarray(start, start + length);
}

function annotations(parsed) {
  return [...parsed.objects.values()].map(object => object.toString('latin1')).filter(text => /\/Subtype \/Link\b/.test(text));
}

function rect(annotation) {
  const match = /\/Rect \[([^\]]+)\]/.exec(annotation);
  assert.ok(match);
  return match[1].trim().split(/\s+/).map(Number);
}

function close(actual, expected, tolerance = 0.000002) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} approximately equals ${expected}`);
}

function uri(annotation) {
  const match = /\/URI \(((?:\\.|[^\\)])*)\)/.exec(annotation);
  assert.ok(match, 'annotation contains a literal URI string');
  return match[1].replace(/\\([\\()])/g, '$1');
}

test('PDF exports fixed A4 CSS and point dimensions', () => {
  assert.deepEqual([PAGE_CSS_WIDTH, PAGE_CSS_HEIGHT, PAGE_PT_WIDTH, PAGE_PT_HEIGHT], [794, 1123, 595.28, 841.89]);
});

test('PDF 1.4 has Catalog, Pages, Info, language, page resources and an exact binary xref', () => {
  const binary = new Uint8Array(Buffer.concat([Buffer.from(JPEG), Buffer.from('\x00\xff\x80\nendstream\nendobj\nxref\n', 'latin1')]));
  const parsed = parsePdf(buildImagePdf([imagePage([link()], { jpeg: binary, width: 1588, height: 2246 }), imagePage()], OPTIONS));
  assert.match(parsed.catalog, /\/Type \/Catalog\b/);
  assert.match(parsed.catalog, /\/Lang \(ar\)/);
  const pagesId = Number(/\/Pages (\d+) 0 R/.exec(parsed.catalog)?.[1]);
  const pages = parsed.objects.get(pagesId).toString('latin1');
  assert.match(pages, /\/Type \/Pages\b/);
  assert.match(pages, /\/Count 2\b/);
  const kids = /\/Kids \[([^\]]+)\]/.exec(pages)?.[1].match(/\d+ 0 R/g);
  assert.equal(kids.length, 2);
  const images = [...parsed.objects.values()].filter(object => /\/Subtype \/Image\b/.test(object.toString('latin1')));
  assert.equal(images.length, 2);
  for (const [index, reference] of kids.entries()) {
    const page = parsed.objects.get(Number(reference.split(' ')[0])).toString('latin1');
    assert.match(page, /\/Type \/Page\b/);
    assert.match(page, new RegExp(`/Parent ${pagesId} 0 R`));
    assert.match(page, /\/MediaBox \[0 0 595\.28 841\.89\]/);
    const imageId = Number(/\/XObject\s*<<\s*\/\w+ (\d+) 0 R/.exec(page)?.[1]);
    assert.match(parsed.objects.get(imageId).toString('latin1'), /\/Filter \/DCTDecode\b/);
    const contentId = Number(/\/Contents (\d+) 0 R/.exec(page)?.[1]);
    const content = streamBytes(parsed.objects.get(contentId)).toString('ascii');
    assert.match(content, /q\s+595\.28 0 0 841\.89 0 0 cm\s+\/\w+ Do\s+Q/);
    assert.equal(page.includes('/Annots'), index === 0);
  }
  assert.match(images[0].toString('latin1'), /\/Width 1588 \/Height 2246\b/);
  assert.match(images[1].toString('latin1'), /\/Width 1 \/Height 1\b/);
  assert.match(images[0].toString('latin1'), /\/ColorSpace \/DeviceRGB\b/);
  assert.match(images[0].toString('latin1'), /\/BitsPerComponent 8\b/);
  assert.deepEqual(streamBytes(images[0]), Buffer.from(binary));
  assert.deepEqual(streamBytes(images[1]), Buffer.from(JPEG));
  assert.match(parsed.info, /\/CreationDate \(D:20261117123456Z\)/);
});

test('PDF keeps byte offsets and stream lengths exact over 40 pages with Uint8Array views', () => {
  const storage = new Uint8Array(JPEG.byteLength + 20);
  storage.fill(0xff);
  storage.set(JPEG, 10);
  const view = storage.subarray(10, storage.length - 10);
  const before = storage.slice();
  const parsed = parsePdf(buildImagePdf(Array.from({ length: 40 }, (_, i) => imagePage(i % 2 ? [link(`https://example.com/page/${i}`)] : [], { jpeg: view })), OPTIONS));
  const images = [...parsed.objects.values()].filter(object => /\/Subtype \/Image\b/.test(object.toString('latin1')));
  assert.equal(images.length, 40);
  images.forEach(object => assert.deepEqual(streamBytes(object), Buffer.from(JPEG)));
  assert.equal(annotations(parsed).length, 20);
  assert.deepEqual(storage, before, 'input JPEG storage is not mutated');
});

test('PDF stores Unicode titles as UTF-16BE hex, including surrogate pairs and PDF delimiters', () => {
  const title = 'سيرة 中文 \uD83D\uDE80 (title) \\\n/Action';
  const parsed = parsePdf(buildImagePdf([imagePage()], { ...OPTIONS, title, language: 'en' }));
  const expected = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(title, 'utf16le').swap16()]).toString('hex').toUpperCase();
  assert.match(parsed.info, new RegExp(`/Title <${expected}>`, 'i'));
  assert.match(parsed.catalog, /\/Lang \(en\)/);
  assert.doesNotMatch(parsed.info, /\/Action/);
  parsePdf(buildImagePdf([imagePage()], { title: '', language: 'ar' }));
});

test('PDF maps top-left CSS links to inverted point coordinates independent of JPEG pixels', () => {
  const parsed = parsePdf(buildImagePdf([imagePage([link()], { width: 3176, height: 4492 })], OPTIONS));
  const links = annotations(parsed);
  assert.equal(links.length, 1);
  rect(links[0]).forEach((value, index) => close(value, [59.528, 589.323, 178.584, 757.701][index]));
  assert.match(links[0], /\/Border \[0 0 0\]/);
  assert.match(links[0], /\/S \/URI\b/);
  assert.equal(uri(links[0]), 'https://example.com/');
});

test('PDF clamps rectangles to the CSS page and drops invalid, negative or zero-area links', () => {
  const links = [
    link('https://example.com/left', { x: -10, y: -20, width: 110, height: 220 }),
    link('https://example.com/bottom', { x: 780, y: 1100, width: 100, height: 100 }),
    ...[
      { x: 794 }, { y: 1123 }, { width: 0 }, { height: 0 }, { width: -1 }, { height: -1 },
      { x: -200, width: 10 }, { y: -300, height: 10 }, { x: NaN }, { y: Infinity },
      { width: Infinity }, { height: NaN }, { x: '20' }, { width: 1e-12 }, { height: 1e-12 },
    ].map(overrides => link('https://example.com/drop', overrides)),
    link('javascript:alert(1)'),
  ];
  const parsed = parsePdf(buildImagePdf([imagePage(links)], OPTIONS));
  const kept = annotations(parsed);
  assert.equal(kept.length, 2);
  const expected = [
    [0, PAGE_PT_HEIGHT - 200 * PAGE_PT_HEIGHT / PAGE_CSS_HEIGHT, 100 * PAGE_PT_WIDTH / PAGE_CSS_WIDTH, PAGE_PT_HEIGHT],
    [780 * PAGE_PT_WIDTH / PAGE_CSS_WIDTH, 0, PAGE_PT_WIDTH, PAGE_PT_HEIGHT - 1100 * PAGE_PT_HEIGHT / PAGE_CSS_HEIGHT],
  ];
  kept.forEach((annotation, i) => rect(annotation).forEach((value, j) => close(value, expected[i][j])));
});

test('PDF accepts only safe ASCII http(s), mailto and tel URIs', () => {
  const safe = ['https://example.com/', 'http://example.com/a?q=1&b=2#part', 'HTTPS://EXAMPLE.COM/%D8%B3', 'mailto:user@example.com', 'mailto:user@example.com?subject=CV%20request', 'tel:+9647701234567', 'tel:+1-555-123-4567;ext=42'];
  const unsafe = [
    '', null, 42, {}, 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,test', 'file:///C:/secret',
    'ftp://example.com', '//example.com', 'example.com', 'https:', 'https://', 'http://[bad]',
    'https://user:password@example.com', 'https://example.com/\\evil', 'https://example.com/a b',
    ' https://example.com/', 'https://example.com/\n/Action', 'https://example.com/\x00', 'https://example.com/\x7f',
    'https://example.com/سيرة', 'https://example.com/%0a', 'https://example.com/%0D', 'https://example.com/%00',
    'https://example.com/%zz', 'mailto:', 'mailto:not-an-email', 'mailto:user@example.com?subject=x%0d%0aBcc:evil@example.com',
    'tel:', 'tel:javascript:alert(1)', 'tel:+12\n34',
  ];
  safe.forEach(href => assert.equal(isSafePdfUri(href), true, href));
  unsafe.forEach(href => assert.equal(isSafePdfUri(href), false, String(href)));
  const parsed = parsePdf(buildImagePdf([imagePage([...safe, ...unsafe].map(href => link(href)))], OPTIONS));
  assert.deepEqual(annotations(parsed).map(uri), safe);
  assert.doesNotMatch(parsed.text, /\/JavaScript|\/Launch|\/OpenAction/);
});

test('PDF escapes URI parentheses and omits Annots entirely when no usable links remain', () => {
  const href = 'https://example.com/resume_(final)?q=(CV)';
  const parsed = parsePdf(buildImagePdf([imagePage([link(href)]), imagePage([link('javascript:alert(1)'), link('tel:+1234567', { width: 0 })])], OPTIONS));
  assert.equal(uri(annotations(parsed)[0]), href);
  assert.ok(annotations(parsed)[0].includes('resume_\\(final\\)?q=\\(CV\\)'));
  const noLinks = parsePdf(buildImagePdf([imagePage()], OPTIONS));
  assert.equal(annotations(noLinks).length, 0);
  assert.doesNotMatch(noLinks.text, /\/Annots\b/);
});

test('PDF rejects empty documents, empty images, invalid pixel sizes and invalid metadata', () => {
  assert.throws(() => buildImagePdf([], OPTIONS));
  for (const overrides of [{ jpeg: new Uint8Array() }, { width: 0 }, { height: -1 }, { width: NaN }, { height: Infinity }, { width: 1.5 }]) {
    assert.throws(() => buildImagePdf([imagePage([], overrides)], OPTIONS));
  }
  assert.throws(() => buildImagePdf([imagePage()], { ...OPTIONS, language: '/Action' }));
  assert.throws(() => buildImagePdf([imagePage()], { ...OPTIONS, createdAt: new Date(NaN) }));
});

test('one-page layout keeps short CVs at original size without enlarging text', () => {
  assert.deepEqual(fitCvPage(400), { scale: 1, x: 0, height: 400, fits: true });
  assert.equal(fitCvPage(CV_CONTENT_HEIGHT).fits, true);
});

test('one-page layout fits modest overflow and centers the entire document', () => {
  const height = CV_CONTENT_HEIGHT / 0.95;
  const result = fitCvPage(height);
  close(result.scale, 0.95);
  close(result.height, CV_CONTENT_HEIGHT);
  close(result.x, PAGE_CSS_WIDTH * (1 - result.scale) / 2);
  assert.equal(result.fits, true);
});

test('one-page layout refuses excessive shrinking without truncating content', () => {
  const height = 9000;
  const result = fitCvPage(height);
  assert.equal(result.scale, CV_MIN_SCALE);
  assert.ok(result.scale >= 0.9, 'body text stays at least nine point');
  assert.equal(result.height, height * CV_MIN_SCALE, 'full content remains measurable and visible');
  assert.equal(result.fits, false);
});

test('one-page layout accepts the exact readable limit but rejects a line beyond it', () => {
  assert.equal(fitCvPage(CV_CONTENT_HEIGHT / CV_MIN_SCALE).fits, true);
  assert.equal(fitCvPage(CV_CONTENT_HEIGHT / CV_MIN_SCALE + 23).fits, false);
});

test('one-page layout reserves space for the branded footer', () => {
  assert.ok(CV_CONTENT_HEIGHT < PAGE_CSS_HEIGHT - 68);
  const result = fitCvPage(CV_CONTENT_HEIGHT + 20);
  assert.ok(result.height <= CV_CONTENT_HEIGHT + 0.001);
  assert.equal(result.fits, true);
});

test('one-page layout rejects invalid browser measurements', () => {
  for (const height of [0, -1, NaN, Infinity]) assert.throws(() => fitCvPage(height));
});

test('CV normalization drops malicious URLs but normalizes safe domains and preserves comparison text', () => {
  const bad = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>bad</script>', 'file:///tmp/cv', 'ftp://example.com', 'mailto:a@example.com', '//evil.example.com', 'https://user:pass@example.com', 'https://localhost', 'https://[bad]', 'https://example.com/' + 'x'.repeat(cv.CV_LIMITS.url)];
  bad.forEach(value => assert.equal(cv.normalizeCvUrl(value), '', value));
  assert.equal(cv.normalizeCvUrl(' Example.COM/cv '), 'https://example.com/cv');
  assert.equal(cv.normalizeCvUrl('https://example.com/سيرة'), 'https://example.com/%D8%B3%D9%8A%D8%B1%D8%A9');
  const data = cv.normalizeCvData({ personal: { website: 'javascript:alert(1)' }, links: bad.map(url => ({ url })), summary: 'Experience < 5 years\nالخبرة > 3 سنوات' });
  assert.equal(data.personal.website, '');
  assert.deepEqual(data.links, []);
  assert.equal(data.summary, 'Experience < 5 years\nالخبرة > 3 سنوات');
});

test('CV normalization handles garbage shapes, settings, dates and non-finite values without coercing objects', () => {
  for (const input of [undefined, null, false, 42, 'bad', [], { personal: [], experiences: {}, education: false, skills: 'bad', languages: null, links: 12, settings: [] }]) {
    assert.deepEqual(cv.normalizeCvData(input), cv.createEmptyCvData());
  }
  const data = cv.normalizeCvData({
    version: 999, personal: { fullName: {}, title: 2026, location: Infinity, email: [] },
    experiences: [null, false, [], { current: 'true', role: 'Developer', end: '2026' }, { role: 'Lead', current: true, end: 'discard' }],
    languages: [{ name: 'Arabic', level: 'expert' }, { name: 'English', level: 'fluent' }],
    skills: [' TypeScript ', 'typescript', null, {}, NaN, 'Arabic'],
    settings: { language: 'fr', showPhoto: false, showPhone: 'false', showEmail: 0 }, updatedAt: 'not a date',
  });
  assert.equal(data.version, 1);
  assert.equal(data.personal.fullName, '');
  assert.equal(data.personal.title, '2026');
  assert.equal(data.personal.location, '');
  assert.deepEqual(data.settings, { language: 'ar', showPhoto: false, showPhone: true, showEmail: true });
  assert.deepEqual(data.skills, ['TypeScript', 'Arabic']);
  assert.deepEqual(data.languages.map(item => item.level), ['', 'fluent']);
  assert.deepEqual(data.experiences.map(item => [item.current, item.end]), [[false, '2026'], [true, '']]);
  assert.equal(data.updatedAt, '');
  assert.equal(cv.normalizeCvData({ updatedAt: '2026-11-17T12:34:56Z', settings: { language: 'en' } }).updatedAt, '2026-11-17T12:34:56Z');
});

test('CV contacts reject internal/invalid emails and normalize Arabic and Persian phone digits', () => {
  for (const value of ['member@prolink.internal', 'MEMBER@PROLINK.LOCAL', ' member @ prolink.internal ', 'bad', 'a@@example.com', 'a@example', 'a<b>@example.com']) {
    assert.equal(cv.normalizeCvEmail(value), '', value);
    assert.equal(cv.normalizeCvData({ personal: { email: value } }).personal.email, '');
    assert.equal(cv.cvFromProfile({ email: value }).personal.email, '');
  }
  assert.equal(cv.normalizeCvEmail(' User@Example.COM '), 'user@example.com');
  assert.equal(cv.normalizeCvPhone('+٩٦٤ ٧٧٠ ١٢٣ ٤٥٦٧'), '+964 770 123 4567');
  assert.equal(cv.normalizeCvPhone('۰۰۴۴ ۷۷۰۰ ۹۰۰۱۲۳'), '0044 7700 900123');
  assert.equal(cv.normalizeCvPhone('12345'), '');
  assert.ok(cv.normalizeCvPhone('1'.repeat(100)).length <= cv.CV_LIMITS.phone);
});

test('CV text normalization removes controls, limits lines, and never cuts a surrogate pair', () => {
  assert.equal(cv.cleanCvText('  A\t B\r\nC\u0000\u202E\u2066\uFEFF  ', 100), 'A B C');
  assert.equal(cv.cleanCvText(' A  B\r\n\r\n\r\nC \u2028D ', 100, true), 'A B\n\nC\nD');
  assert.equal(cv.cleanCvText('ab\uD83D\uDE80cd', 3), 'ab');
  assert.equal(cv.cleanCvText('ab\uD83D\uDE80cd', 4), 'ab\uD83D\uDE80');
  const lines = Array.from({ length: 40 }, (_, i) => `Line ${i}`).join('\n');
  assert.equal(cv.cleanCvText(lines, 10000, true).split('\n').length, cv.CV_LIMITS.descriptionLines);
});

test('CV normalization enforces every collection and text field limit', () => {
  const L = cv.CV_LIMITS;
  const long = 'x'.repeat(5000);
  const data = cv.normalizeCvData({
    personal: { fullName: long, title: long, location: long, phone: '1'.repeat(100), email: 'a'.repeat(70) + '@example.com', website: 'https://example.com' }, summary: long,
    experiences: Array.from({ length: 20 }, () => ({ role: long, company: long, location: long, start: long, end: long, description: long })),
    education: Array.from({ length: 20 }, () => ({ degree: long, school: long, field: long, start: long, end: long, description: long })),
    skills: Array.from({ length: 40 }, (_, i) => `${i}-${long}`),
    languages: Array.from({ length: 20 }, () => ({ name: long, level: 'native' })),
    certifications: Array.from({ length: 20 }, () => ({ name: long, issuer: long, year: long })),
    links: Array.from({ length: 20 }, () => ({ label: long, url: 'https://example.com/cv' })),
  });
  for (const [collection, limit] of [['experiences', L.experiences], ['education', L.education], ['skills', L.skills], ['languages', L.languages], ['certifications', L.certifications], ['links', L.links]]) {
    assert.equal(data[collection].length, limit, collection);
  }
  for (const [field, limit] of [['fullName', L.name], ['title', L.title], ['location', L.location], ['phone', L.phone]]) assert.equal(data.personal[field].length, limit, field);
  assert.ok(data.personal.email.length <= L.email);
  assert.ok(data.personal.website.length <= L.url);
  assert.equal(data.summary.length, L.summary);
  for (const item of data.experiences) for (const [field, limit] of [['role', L.role], ['company', L.company], ['location', L.location], ['start', L.date], ['end', L.date], ['description', L.experienceDescription]]) assert.equal(item[field].length, limit, field);
  for (const item of data.education) for (const [field, limit] of [['degree', L.degree], ['school', L.school], ['field', L.field], ['start', L.date], ['end', L.date], ['description', L.educationDescription]]) assert.equal(item[field].length, limit, field);
  data.skills.forEach(skill => assert.equal(skill.length, L.skill));
  data.languages.forEach(item => assert.equal(item.name.length, L.languageName));
  data.certifications.forEach(item => {
    assert.equal(item.name.length, L.certificationName);
    assert.equal(item.issuer.length, L.issuer);
    assert.equal(item.year.length, L.date);
  });
  data.links.forEach(item => assert.equal(item.label.length, L.linkLabel));
});

test('CV IDs preserve valid IDs and replace invalid/duplicate IDs within every collection', () => {
  const ids = ['valid-id_1', 'valid-id_1', '<script>', 'x'.repeat(41), 42];
  const data = cv.normalizeCvData({
    experiences: ids.map(id => ({ id, role: 'Developer' })), education: ids.map(id => ({ id, degree: 'BSc' })),
    languages: ids.map(id => ({ id, name: 'Arabic' })), certifications: ids.map(id => ({ id, name: 'Certificate' })),
    links: ids.map(id => ({ id, url: 'https://example.com' })),
  });
  for (const collection of ['experiences', 'education', 'languages', 'certifications', 'links']) {
    const values = data[collection].map(item => item.id);
    assert.equal(values[0], 'valid-id_1');
    assert.equal(new Set(values).size, values.length, collection);
    values.forEach(id => assert.match(id, /^[A-Za-z0-9_-]{1,40}$/));
  }
  const generated = Array.from({ length: 100 }, () => cv.newCvId());
  assert.equal(new Set(generated).size, generated.length);
});

test('CV byte sizing measures UTF-8 JSON and detects content exceeding the persistence byte budget', () => {
  assert.equal(cv.CV_LIMITS.maxBytes, 60000);
  const data = cv.normalizeCvData({ personal: { fullName: 'سيرة 中文' }, summary: 'نص عربي' });
  const json = JSON.stringify(data);
  assert.equal(cv.cvByteSize(data), Buffer.byteLength(json, 'utf8'));
  assert.ok(cv.cvByteSize(data) > json.length);
  assert.ok(cv.cvByteSize(data) < cv.CV_LIMITS.maxBytes);
  // normalizeCvData has field limits; the persistence caller must also check maxBytes.
  const oversized = { ...data, summary: 'س'.repeat(cv.CV_LIMITS.maxBytes / 2) };
  assert.ok(cv.cvByteSize(oversized) > cv.CV_LIMITS.maxBytes);
});

test('new CV automatically imports the profile identity, biography, skills, experience and education', () => {
  const profile = {
    name: 'ليلى أحمد', title: 'مهندسة', displayTitle: 'مهندسة برمجيات', location: 'بغداد',
    phone: '07701234567', email: 'layla@example.test', website: 'https://example.test/',
    bio: 'أطوّر تطبيقات مفيدة وسهلة الاستخدام.', skills: ['React', 'إدارة المشاريع'],
    experience: 'تطوير تطبيقات لشركة محلية.', education: 'بكالوريوس هندسة الحاسوب\nجامعة بغداد',
  };
  const before = structuredClone(profile);
  const data = cv.cvFromProfile(profile);
  assert.deepEqual(data.personal, {
    fullName: profile.name, title: profile.displayTitle, location: profile.location,
    phone: profile.phone, email: profile.email, website: profile.website,
  });
  assert.equal(data.summary, profile.bio);
  assert.deepEqual(data.skills, profile.skills);
  assert.equal(data.experiences[0].description, profile.experience);
  assert.equal(data.education[0].degree, 'بكالوريوس هندسة الحاسوب');
  assert.equal(data.education[0].description, 'جامعة بغداد');
  assert.deepEqual(profile, before);
});

test('CV profile identity merges only blanks, remains normalized, and does not mutate saved data', () => {
  const saved = cv.normalizeCvData({ personal: { fullName: 'Saved name' }, settings: { language: 'en', showEmail: false } });
  const merged = cv.withProfileIdentity(saved, { name: 'New name', display_title: 'Developer', email: 'hidden@prolink.internal', phone: '٠٧٧٠١٢٣٤٥٦٧', website: 'example.com' });
  assert.equal(merged.personal.fullName, 'Saved name');
  assert.equal(merged.personal.title, 'Developer');
  assert.equal(merged.personal.email, '');
  assert.equal(merged.personal.phone, '07701234567');
  assert.equal(merged.personal.website, 'https://example.com/');
  assert.equal(merged.settings.showEmail, false);
  assert.equal(saved.personal.title, '');
  assert.equal(cv.withProfileIdentity(saved, null), saved);
});
