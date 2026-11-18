// Run only after production edits settle: node tests/browser-cv.mjs
// Optional: CHROME_PATH=/absolute/path/to/chrome. No Vite, driver, DB or auth required.
// Only test-owned temporary files are written. Screenshots/PDFs/report are retained
// in the printed output directory; the isolated Chrome profile is removed.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = {
  id: 'fixture-cv-user', name: 'ليلى أحمد', title: 'مهندسة برمجيات', role: 'seeker',
  location: 'بغداد، العراق', phone: '+9647701234567', email: 'login@example.test',
  website: 'https://example.test/', avatar: '', bio: 'نبذة الملف لا تتغير',
  cvUrl: 'https://example.test/previous-upload.pdf', skills: ['React', 'التواصل'],
  experience: 'تطوير واجهات عربية لشركة محلية.', education: 'بكالوريوس هندسة الحاسوب\nجامعة بغداد',
};
const base = {
  version: 1,
  personal: {
    fullName: 'ليلى أحمد', title: 'مهندسة برمجيات', location: 'بغداد، العراق',
    phone: '+9647701234567', email: 'layla@example.test', website: 'https://example.test/',
  },
  summary: 'مهندسة برمجيات أعمل على تطوير تطبيقات سهلة الاستخدام، وتحسين جودة المنتجات بالتعاون مع فرق التصميم والعملاء.',
  experiences: [
    { id: 'role-a', role: 'مهندسة برمجيات', company: 'شركة النور', location: 'بغداد', start: '2023', end: '', current: true,
      description: 'طورت واجهات عربية متجاوبة، وحسنت سرعة التطبيق وجودة الاختبارات بالتعاون مع فريق مكون من خمسة مهندسين.' },
    { id: 'role-b', role: 'مطورة واجهات', company: 'حلول الرافدين', location: 'أربيل', start: '2021', end: '2023', current: false,
      description: 'نفذت لوحة متابعة للمشاريع وربطتها بالخدمات، وكتبت توثيقاً واضحاً لتسهيل تسليم العمل للعملاء.' },
  ],
  education: [{ id: 'degree-a', degree: 'بكالوريوس', school: 'جامعة بغداد', field: 'هندسة الحاسوب', start: '2017', end: '2021', description: 'مشروع التخرج: منصة تعليمية عربية.' }],
  skills: ['React', 'TypeScript', 'إدارة المشاريع', 'اختبار البرمجيات'],
  languages: [{ id: 'lang-a', name: 'العربية', level: 'native' }, { id: 'lang-b', name: 'الإنجليزية', level: 'advanced' }],
  certifications: [{ id: 'cert-a', name: 'إدارة المشاريع', issuer: 'مركز التدريب المهني', year: '2024' }],
  links: [{ id: 'link-a', label: 'معرض الأعمال', url: 'https://example.test/portfolio' }],
  settings: { language: 'ar', showPhoto: true, showPhone: true, showEmail: true },
  updatedAt: '2026-11-17T12:00:00.000Z',
};
const english = {
  ...structuredClone(base),
  personal: { ...base.personal, fullName: 'Layla Ahmed', title: 'Software Engineer', location: 'Baghdad, Iraq' },
  summary: 'Software engineer building accessible products, improving reliability, and working closely with designers and customers.',
  experiences: [
    { ...base.experiences[0], role: 'Software Engineer', company: 'Noor Software', location: 'Baghdad', description: 'Built responsive interfaces and improved application performance and test coverage with a team of five engineers.' },
    { ...base.experiences[1], role: 'Frontend Developer', company: 'Rafidain Solutions', location: 'Erbil', description: 'Delivered a project dashboard, integrated services, and documented the product for customer handover.' },
  ],
  education: [{ ...base.education[0], degree: 'Bachelor of Science', school: 'University of Baghdad', field: 'Computer Engineering', description: 'Graduation project: an accessible learning platform.' }],
  skills: ['React', 'TypeScript', 'Project management', 'Software testing'],
  languages: [{ id: 'lang-a', name: 'Arabic', level: 'native' }, { id: 'lang-b', name: 'English', level: 'advanced' }],
  certifications: [{ ...base.certifications[0], name: 'Project Management', issuer: 'Professional Training Centre' }],
  links: [{ ...base.links[0], label: 'Portfolio' }],
  settings: { ...base.settings, language: 'en' },
};
const longCv = {
  ...structuredClone(base),
  experiences: Array.from({ length: 10 }, (_, index) => {
    const ending = '؛ نهاية الخبرة رقم ' + (index + 1);
    const sentence = 'شاركت في تحليل المتطلبات وتطوير الواجهات واختبار الأداء وتوثيق النتائج ومراجعة جودة الخدمات مع فريق العمل. ';
    return { ...base.experiences[1], id: 'long-' + index, role: 'مهندسة مشاريع ' + (index + 1),
      description: sentence.repeat(20).slice(0, 1000 - ending.length) + ending };
  }),
};
const minimal = {
  version: 1, personal: { fullName: 'سارة علي', title: '', location: '', phone: '', email: '', website: '' },
  summary: '', experiences: [], education: [], skills: ['Excel'], languages: [], certifications: [], links: [],
  settings: { language: 'ar', showPhoto: true, showPhone: true, showEmail: true }, updatedAt: base.updatedAt,
};
const samples = {
  arabic: base, english,
  'hidden-phone': { ...structuredClone(base), settings: { ...base.settings, showPhone: false } },
  'hidden-email': { ...structuredClone(base), settings: { ...base.settings, showEmail: false } },
  'hidden-both': { ...structuredClone(base), settings: { ...base.settings, showPhone: false, showEmail: false } },
  minimal, 'malformed-photo': structuredClone(minimal), long: longCv,
};
assert(longCv.experiences.every(entry => entry.description.length === 1000));

// This source is bundled, not injected through CDP. All mutating actions below
// are ordinary fixture/production button handlers driven by native Input events.
const fixture = String.raw`
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FixtureProvider } from './src/contexts/AppContext';
import { CvBuilderView } from './src/components/features/cv/CvBuilderView';
import { CvViewerModal } from './src/components/features/cv/CvViewerModal';
import { CvPreview } from './src/components/features/cv/CvPreview';
import { normalizeCvData, PLATFORM_URL } from './src/lib/cv/cvData';
import { exportCvPdf } from './src/lib/cv/cvExport';
const rawSamples = __SAMPLES__;
const samples = Object.fromEntries(Object.entries(rawSamples).map(([key, data]) => [key, normalizeCvData(data)]));
window.__cvTest = {
  profile: __PROFILE__, samples, brand: PLATFORM_URL, seed: null,
  saves: [], syncs: [], callbacks: [], closes: 0, drafts: {}, loads: [], exports: [],
  boundaryErrors: [], audit: window.__cvAudit,
};
for (let i = 0; i < 10; i++) {
  if (samples.long.experiences[i].description !== rawSamples.long.experiences[i].description)
    throw new Error('Long fixture must remain legitimate, untruncated input after normalization');
}
const state = window.__cvTest;
const clone = value => structuredClone(value);
async function encode(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Fixture could not read exported Blob'));
    reader.readAsDataURL(blob);
  });
}
function Direct({ name, onBack }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const data = samples[name];
  const avatar = name === 'malformed-photo' ? 'https://[' : '/logo.png';
  async function runExport() {
    if (busy) return;
    setBusy(true); setMessage('');
    const record = { name, status: 'pending' };
    state.exports.push(record);
    try {
      const blob = await exportCvPdf(data, avatar);
      record.type = blob.type; record.bytes = blob.size;
      record.base64 = await encode(blob); record.status = 'success';
      setMessage('Fixture PDF ready');
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      record.status = 'error'; setMessage(record.error);
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl p-3 sm:p-6" dir="rtl">
    <div className="mb-4 flex flex-wrap gap-3">
      <button data-test="back" onClick={onBack}>Test: back</button>
      <button data-test="direct-export" disabled={busy} onClick={runExport}>Test: export PDF</button>
    </div>
    <p data-test="direct-result" role={message && message !== 'Fixture PDF ready' ? 'alert' : 'status'}>{message}</p>
    <CvPreview data={data} avatarUrl={name === 'malformed-photo' ? undefined : avatar} />
  </main>;
}
function Fixture() {
  const [screen, setScreen] = useState('menu'), [selected, setSelected] = useState('arabic');
  const [viewerData, setViewerData] = useState(samples.arabic);
  const back = () => setScreen('menu');
  const close = () => { state.closes++; back(); };
  if (screen === 'builder') return <FixtureProvider><CvBuilderView user={state.profile} onClose={close}
    onSaved={data => state.callbacks.push(clone(data))} /></FixtureProvider>;
  if (screen === 'direct') return <Direct key={selected} name={selected} onBack={back} />;
  if (screen === 'viewer') return <>
    <CvViewerModal data={viewerData} avatarUrl="/logo.png" onClose={close} />
    <aside data-test="viewer-controls" style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 3000 }}>
      <button data-test="viewer-hide-contacts" onClick={() => setViewerData(samples['hidden-both'])}>Test: hide viewer contacts</button>
    </aside>
  </>;
  return <main className="mx-auto max-w-5xl space-y-4 p-6">
    <h1>Isolated CV regression fixture</h1>
    <div className="flex flex-wrap gap-3">
      <button data-test="open-builder" onClick={() => { state.seed = null; setScreen('builder'); }}>Test: builder</button>
      <button data-test="open-long-builder" onClick={() => {
        state.seed = { data: clone(samples.long), isPublic: false, updatedAt: samples.long.updatedAt, storage: 'database' };
        setScreen('builder');
      }}>Test: long builder</button>
      {Object.keys(samples).map(name => <button key={name} data-test={'open-' + name}
        onClick={() => { setSelected(name); setScreen('direct'); }}>Test: {name}</button>)}
      <button data-test="open-viewer" onClick={() => { setViewerData(samples.arabic); setScreen('viewer'); }}>Test: viewer</button>
      <button data-test="open-long-viewer" onClick={() => { setViewerData(samples.long); setScreen('viewer'); }}>Test: long viewer</button>
    </div>
  </main>;
}
createRoot(document.getElementById('fixture')).render(<Fixture />);
`.replace('__SAMPLES__', JSON.stringify(samples)).replace('__PROFILE__', JSON.stringify(profile));

const boundaries = {
  AppContext: `
    import React, { createContext, useContext, useState } from 'react';
    const Context = createContext(null);
    export const useAppContext = () => useContext(Context);
    export function FixtureProvider({ children }) {
      const [appUser, setAppUser] = useState(window.__cvTest.profile);
      return React.createElement(Context.Provider, { value: { appUser, setAppUser } }, children);
    }
  `,
  profileService: `
    export const profileService = { async updateProfile(id, updates) {
      const state = window.__cvTest;
      if (id !== state.profile.id) throw new Error('Unexpected synthetic profile owner');
      state.syncs.push({ id, updates: structuredClone(updates) });
      return { data: { ...state.profile, ...updates }, error: null };
    } };
  `,
  cvProfileService: `
    const state = () => window.__cvTest;
    const check = id => { if (id !== state().profile.id) throw new Error('Unexpected synthetic CV owner'); };
    export const cvProfileService = {
      readDraft(id) { check(id); return state().drafts[id] || null; },
      writeDraft(id, data, isPublic) {
        check(id); state().drafts[id] = { data: structuredClone(data), isPublic, storage: 'local', updatedAt: data.updatedAt };
      },
      async loadOwn(id) { check(id); state().loads.push(id); return structuredClone(state().seed); },
      async save(id, data, isPublic) {
        check(id); state().saves.push({ id, data: structuredClone(data), isPublic });
        this.writeDraft(id, data, isPublic);
        return { data: structuredClone(data), isPublic, storage: 'database', updatedAt: data.updatedAt };
      },
    };
  `,
  supabase: `
    export const supabase = new Proxy({}, { get(_, key) {
      const message = 'Forbidden Supabase boundary: ' + String(key);
      window.__cvTest?.boundaryErrors.push(message);
      throw new Error(message);
    } });
  `,
};

function guardSource(allowedPaths) {
  return String.raw`
  window.__cvAudit = { network: [], errors: [], console: [], downloads: [] };
  const audit = window.__cvAudit;
  const allowed = new Set(__ALLOWED__);
  const deny = kind => function () {
    audit.network.push(kind); throw new Error('Forbidden fixture boundary: ' + kind);
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== location.origin || !allowed.has(url.pathname)) return deny('fetch ' + url.href)();
    return nativeFetch(input, init);
  };
  XMLHttpRequest.prototype.open = deny('XMLHttpRequest');
  window.WebSocket = deny('WebSocket'); window.EventSource = deny('EventSource');
  window.RTCPeerConnection = deny('RTCPeerConnection'); navigator.sendBeacon = deny('sendBeacon');
  window.open = deny('window.open');
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    if (link.href.startsWith('blob:' + location.origin + '/') && /\.pdf$/i.test(link.download)) {
      audit.downloads.push(link.download); return;
    }
    event.preventDefault(); audit.network.push('anchor activation: ' + link.getAttribute('href'));
  }, true);
  document.addEventListener('submit', event => { event.preventDefault(); audit.network.push('form submission'); }, true);
  window.addEventListener('securitypolicyviolation', event => audit.network.push('CSP ' + event.violatedDirective + ': ' + event.blockedURI));
  window.addEventListener('error', event => audit.errors.push(event.message || 'Resource error'));
  window.addEventListener('unhandledrejection', event => audit.errors.push(String(event.reason)));
  for (const level of ['warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => { audit.console.push({ level, text: args.map(String).join(' ') }); original(...args); };
  }
  `.replace('__ALLOWED__', JSON.stringify(allowedPaths));
}

async function bundleFixture() {
  const resources = new Map();
  const assets = new Map();
  const result = await build({
    stdin: { contents: fixture, sourcefile: 'browser-cv-fixture.tsx', resolveDir: root, loader: 'tsx' },
    absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife',
    target: 'chrome120', jsx: 'automatic', metafile: true, logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true, MODE: 'test' }), 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'cv-test-boundaries-and-local-font-urls', setup(builder) {
      builder.onResolve({ filter: /(^|\/)(AppContext|profileService|cvProfileService|supabase)(\.[jt]sx?)?$/ }, args => {
        const name = args.path.split('/').pop().replace(/\.[jt]sx?$/, '');
        return { path: name, namespace: 'cv-test-boundary' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'cv-test-boundary' }, args => ({ contents: boundaries[args.path], resolveDir: root, loader: 'js' }));
      builder.onResolve({ filter: /\.woff2\?url$/ }, args => {
        const absolute = path.resolve(args.resolveDir, args.path.replace(/\?url$/, ''));
        return { path: absolute, namespace: 'cv-test-font' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'cv-test-font' }, async args => {
        const route = '/assets/' + path.basename(args.path);
        const previous = assets.get(route);
        assert(!previous || previous === args.path, 'Font route collision');
        assets.set(route, args.path);
        resources.set(route, { type: 'font/woff2', body: await readFile(args.path) });
        return { contents: 'export default ' + JSON.stringify(route), loader: 'js' };
      });
    } }],
  });
  const inputs = Object.keys(result.metafile.inputs).map(file => file.replaceAll('\\', '/'));
  for (const suffix of [
    'src/components/features/cv/CvBuilderView.tsx', 'src/components/features/cv/CvBuilderFields.tsx',
    'src/components/features/cv/CvDocument.tsx', 'src/components/features/cv/CvPreview.tsx',
    'src/components/features/cv/CvViewerModal.tsx', 'src/lib/cv/cvData.ts',
    'src/lib/cv/cvExport.tsx', 'src/lib/cv/cvPagination.ts', 'src/lib/cv/cvFonts.ts',
    'src/lib/cv/pdfWriter.ts', 'node_modules/react/index.js', 'node_modules/react-dom/client.js',
  ]) assert(inputs.some(file => file.endsWith(suffix)), 'Must bundle real production module: ' + suffix);
  assert(!inputs.some(file => /src\/(?:lib\/(?:supabase\.|services\/(?:profileService|cvProfileService)\.)|contexts\/AppContext\.)/.test(file)),
    'Live context, profile services and Supabase initialization must never be bundled');
  assert(!inputs.some(file => file.includes('node_modules/@supabase/')), 'No live Supabase client may enter the fixture');

  // Use actual application CSS and Tailwind's installed scanner/compiler. Only
  // Google's external font import is replaced, with the identical local family.
  const cssPath = path.join(root, 'src/index.css');
  const appCss = (await readFile(cssPath, 'utf8')).replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^'"]+['"]\);/g, '');
  assert(!/@import[^;]*https?:/i.test(appCss), 'Unexpected external stylesheet; add an explicit local fixture boundary');
  const compiler = await compile(appCss, { base: path.dirname(cssPath), onDependency() {} });
  const scanner = new Scanner({ sources: [{ base: path.join(root, 'src'), pattern: '**/*.{tsx,ts,css}', negated: false }] });
  const candidates = [...scanner.scan(), ...scanner.scanFiles([{ content: fixture, extension: 'tsx' }])];
  const localFonts = [...assets.keys()].map(route => {
    const range = route.includes('-arabic-wght-') ? 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFC'
      : route.includes('-latin-ext-') ? 'U+0100-02FF,U+1E00-1EFF' : 'U+0000-00FF,U+2000-206F,U+20AC,U+2122';
    return `@font-face{font-family:'Noto Kufi Arabic';src:url('${route}') format('woff2');font-style:normal;font-weight:100 900;font-display:swap;unicode-range:${range};}`;
  }).join('\n');
  resources.set('/fixture.css', { type: 'text/css; charset=utf-8', body: compiler.build(candidates) + '\n' + localFonts +
    '\n[data-test]{border:1px solid #64748b;border-radius:6px;padding:8px 12px;background:white;color:#172b4d;min-height:44px}' });
  resources.set('/fixture.js', { type: 'text/javascript; charset=utf-8', body: result.outputFiles[0].text });
  resources.set('/logo.png', { type: 'image/png', body: await readFile(path.join(root, 'public/logo.png')) });
  const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const guard = guardSource([...resources.keys()]).replace(/<\/script/gi, '<\\/script');
  resources.set('/', { type: 'text/html; charset=utf-8', body:
    '<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '"><title>Isolated CV regression fixture</title>' +
    '<link rel="icon" href="data:,"><link rel="stylesheet" href="/fixture.css"></head><body>' +
    '<script>' + guard + '</script><div id="fixture"></div><script src="/fixture.js"></script></body></html>' });
  return resources;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message, timeout = 15000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await predicate();
    if (last) return last;
    await delay(60);
  }
  throw new Error(message + (last ? ': ' + JSON.stringify(last) : ''));
}
function trackServer(server) {
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket); socket.on('error', () => socket.destroy()); socket.on('close', () => sockets.delete(socket));
  });
  return async () => {
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  };
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
}

async function launchBrowser(args, owned, fixtureUrl, resources, downloadsDirectory) {
  const child = spawn(chrome, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, TMP: owned, TEMP: owned, TMPDIR: owned } });
  let stderr = '', socket, closed = false, nextId = 0;
  const pending = new Map(), handlers = new Map(), downloads = new Map(), loaded = new Set();
  const network = [], consoleMessages = [], exceptions = [];
  let resolveExit;
  const exited = new Promise(resolve => { resolveExit = resolve; });
  const terminate = () => {
    if (closed) return;
    if (process.platform === 'win32' && child.pid) {
      try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
      catch { child.kill(); }
    } else child.kill('SIGKILL');
  };
  const deadline = setTimeout(terminate, 600000);
  child.once('close', code => {
    closed = true; clearTimeout(deadline);
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('Test Chrome closed: ' + code)); }
    pending.clear(); resolveExit(code);
  });
  function on(method, handler) { handlers.set(method, [...(handlers.get(method) || []), handler]); }
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return reject(new Error('Test CDP socket is unavailable'));
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome did not expose its isolated CDP endpoint\n' + stderr)), 20000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); reject(new Error('Chrome exited before CDP: ' + code + '\n' + stderr)); });
      child.stderr.on('data', data => {
        stderr = (stderr + data.toString()).slice(-12000);
        const match = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const waiter = pending.get(message.id); pending.delete(message.id);
        if (!waiter) return;
        clearTimeout(waiter.timer);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      } else for (const handler of handlers.get(message.method) || []) {
        Promise.resolve(handler(message.params, message.sessionId)).catch(error => exceptions.push(String(error)));
      }
    });
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Isolated Chrome socket failed')), { once: true });
    });
    const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => command(method, params, sessionId);
    on('Runtime.consoleAPICalled', (event, session) => {
      if (session === sessionId && ['error', 'warning', 'warn'].includes(event.type))
        consoleMessages.push({ type: event.type, text: event.args.map(arg => arg.value ?? arg.description ?? '').join(' ') });
    });
    on('Runtime.exceptionThrown', (event, session) => {
      if (session === sessionId) exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text);
    });
    const permitted = raw => {
      if (/^(?:data:|blob:)/.test(raw)) return true;
      try { const url = new URL(raw); return url.origin === new URL(fixtureUrl).origin && resources.has(url.pathname); }
      catch { return false; }
    };
    on('Fetch.requestPaused', async (event, session) => {
      if (session !== sessionId) return;
      if (permitted(event.request.url)) await page('Fetch.continueRequest', { requestId: event.requestId });
      else {
        network.push(event.request.url);
        await page('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' });
      }
    });
    on('Browser.downloadWillBegin', event => downloads.set(event.guid, { ...event, state: 'started' }));
    on('Browser.downloadProgress', event => downloads.set(event.guid, { ...downloads.get(event.guid), ...event }));
    on('Page.lifecycleEvent', (event, session) => {
      if (session === sessionId && event.name === 'load') loaded.add(event.loaderId);
    });
    await page('Runtime.enable'); await page('Page.enable'); await page('DOM.enable');
    await page('Page.setLifecycleEventsEnabled', { enabled: true });
    await page('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await command('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloadsDirectory, eventsEnabled: true });
    await page('Page.bringToFront');
    return {
      command, page, on, downloads, loaded, network, consoleMessages, exceptions,
      async close() {
        if (!closed) {
          try { await command('Browser.close'); } catch { /* Socket may close before the reply. */ }
          const force = setTimeout(terminate, 3000);
          await exited; clearTimeout(force);
        }
        socket.close();
      },
    };
  } catch (error) {
    terminate(); await exited; socket?.close(); throw error;
  }
}

// Every Runtime.evaluate expression is read-only: inspect DOM, geometry, and the
// synthetic fixture's result state. No clicks, input mutation, fetch, timers,
// storage, cookies or authentication APIs are evaluated in the page.
function driver(browser) {
  const inspect = async expression => {
    const response = await browser.page('Runtime.evaluate', { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  const node = selector => `document.querySelector(${JSON.stringify(selector)})`;
  const button = label => `[...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(label)})`;
  const scroll = async expression => {
    const response = await browser.page('Runtime.evaluate', { expression, returnByValue: false });
    assert(!response.exceptionDetails && response.result.objectId && response.result.subtype === 'node', 'Expected a real element: ' + expression);
    try { await browser.page('DOM.scrollIntoViewIfNeeded', { objectId: response.result.objectId }); }
    finally { await browser.page('Runtime.releaseObject', { objectId: response.result.objectId }); }
  };
  const click = async expression => {
    await until(() => inspect(`Boolean((${expression}) && !(${expression}).disabled && !(${expression}).closest('fieldset:disabled'))`), 'Expected enabled target: ' + expression);
    await scroll(expression);
    const point = await inspect(`(() => {
      const el = (${expression}); const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, visible: r.width > 0 && r.height > 0 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && (hit === el || el.contains(hit)) };
    })()`);
    assert(point.visible, 'Click target must be visible and unobstructed: ' + expression);
    await browser.page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await browser.page('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: point.x, y: point.y });
    await browser.page('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: point.x, y: point.y });
  };
  const key = async (keyName, code, modifiers = 0) => {
    await browser.page('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: keyName, code, modifiers,
      windowsVirtualKeyCode: ({ Escape: 27, Backspace: 8, a: 65, Tab: 9 })[keyName] });
    await browser.page('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, modifiers });
  };
  const openDetails = async expression => {
    for (let count = 0; count < 12; count++) {
      const parent = `(() => {
        const el = (${expression}); if (!el) return null;
        const parents = []; for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) parents.push(p);
        return parents.at(-1)?.querySelector(':scope > summary') || null;
      })()`;
      if (!await inspect(`Boolean(${parent})`)) return;
      await click(parent);
    }
    throw new Error('Too many closed details ancestors');
  };
  const fill = async (field, value) => {
    const expression = node(`[data-cv-field="${field}"]`);
    await openDetails(expression); await click(expression);
    await key('a', 'KeyA', 2); await key('Backspace', 'Backspace');
    if (value) await browser.page('Input.insertText', { text: value });
    await until(() => inspect(`(${expression})?.value === ${JSON.stringify(value)}`), 'Field did not accept native input: ' + field);
  };
  return { inspect, node, button, scroll, click, key, openDetails, fill };
}

async function assertPdf(bytes, sample, brand, name) {
  assert(bytes.length > 1000, name + ': exported PDF must not be empty');
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, 1, name + ': exactly one A4 PDF page, never silently paginate');
    const page = await pdf.getPage(1), box = page.view;
    assert(Math.abs(box[2] - box[0] - 595.28) < 0.1 && Math.abs(box[3] - box[1] - 841.89) < 0.1, name + ': portrait A4 MediaBox');
    const metadata = await pdf.getMetadata();
    assert(metadata.info.Title.includes(sample.personal.fullName), name + ': Unicode name survives PDF metadata');
    const operators = await page.getOperatorList();
    assert(operators.fnArray.some(op => [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat].includes(op)), name + ': page contains the actual rasterized document');
    const annotations = (await page.getAnnotations()).filter(annotation => annotation.subtype === 'Link');
    const urls = annotations.map(annotation => annotation.url || annotation.unsafeUrl);
    for (const annotation of annotations) {
      const [x1, y1, x2, y2] = annotation.rect;
      assert([x1, y1, x2, y2].every(Number.isFinite) && x2 > x1 && y2 > y1, name + ': nonzero link rectangle');
      assert(x1 >= -0.1 && y1 >= -0.1 && x2 <= 595.38 && y2 <= 841.99, name + ': link annotation stays inside A4');
    }
    const expected = [brand, sample.personal.website, ...sample.links.map(link => link.url)].filter(Boolean);
    if (sample.settings.showPhone && sample.personal.phone) expected.push('tel:+9647701234567', 'https://wa.me/9647701234567');
    if (sample.settings.showEmail && sample.personal.email) expected.push('mailto:' + sample.personal.email);
    for (const url of expected) assert(urls.includes(url), name + ': missing PDF annotation ' + url);
    if (!sample.settings.showPhone || !sample.personal.phone) assert(!urls.some(url => /^(?:tel:|https:\/\/wa\.me\/)/.test(url)), name + ': hidden phone must not leak tel/WhatsApp links');
    if (!sample.settings.showEmail || !sample.personal.email) assert(!urls.some(url => /^mailto:/.test(url)), name + ': hidden email must not leak a mailto link');
    assert(urls.every(url => /^(?:https?:\/\/|tel:|mailto:)/.test(url)), name + ': safe link schemes only');
    return { pages: pdf.numPages, width: box[2] - box[0], height: box[3] - box[1], urls, bytes: bytes.length };
  } finally { await task.destroy(); }
}

let owned, output, downloadsDirectory, browser;
const cleanupServers = [], results = [], audits = [], artifacts = [], pdfs = [];
let blockedProxyRequests = 0;
try {
  await access(chrome);
  execFileSync('ls', ['-ld', tmpdir()], { stdio: 'ignore' });
  owned = await mkdtemp(path.join(tmpdir(), 'prolink-cv-browser-'));
  output = await mkdtemp(path.join(tmpdir(), 'prolink-cv-evidence-'));
  execFileSync('ls', ['-ld', owned, output], { stdio: 'ignore' });
  downloadsDirectory = await mkdtemp(path.join(output, 'downloads-'));
  console.log('Retained CV screenshots, PDFs and report: ' + output);
  const resources = await bundleFixture();
  const unexpectedRequests = [];
  const server = createServer((request, response) => {
    const resource = resources.get(request.url);
    if (!resource || request.method !== 'GET') {
      unexpectedRequests.push({ method: request.method, url: request.url }); response.writeHead(404); response.end(); return;
    }
    response.writeHead(200, { 'Content-Type': resource.type, 'Cache-Control': 'no-store' }); response.end(resource.body);
  });
  cleanupServers.push(trackServer(server)); await listen(server);
  const fixtureUrl = 'http://127.0.0.1:' + server.address().port + '/';
  // Separate from Vite. Only this exact origin is ever navigated by the harness.
  const proxy = createServer((_request, response) => {
    blockedProxyRequests++; response.writeHead(403, { Connection: 'close' }); response.end();
  });
  proxy.on('connect', (_request, socket) => {
    blockedProxyRequests++; socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  cleanupServers.push(trackServer(proxy)); await listen(proxy);
  browser = await launchBrowser([
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-domain-reliability', '--disable-sync', '--disable-extensions',
    '--disable-breakpad', '--disable-quic', '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--proxy-server=http://127.0.0.1:' + proxy.address().port,
    '--proxy-bypass-list=<-loopback>;127.0.0.1:' + server.address().port,
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--user-data-dir=' + path.join(owned, 'profile'), '--window-size=1440,1000',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', 'about:blank',
  ], owned, fixtureUrl, resources, downloadsDirectory);
  const { inspect, node, button, click, scroll, key, openDetails, fill } = driver(browser);
  const testButton = name => node('[data-test="' + name + '"]');
  const preview = node('[data-cv-preview]');
  const fitValue = `document.querySelector('[data-cv-fit]')?.getAttribute('data-cv-fit')`;
  const exportClean = `![...document.querySelectorAll('.prolink-cv')].some(el => !el.closest('[data-cv-preview]'))`;
  const viewport = width => browser.page('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  const capture = async name => {
    const { data } = await browser.page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = path.join(output, name + '.png'); await writeFile(file, Buffer.from(data, 'base64'));
    artifacts.push(file); console.log('Screenshot: ' + file);
  };
  const waitFit = async expected => {
    await openDetails(preview);
    let previous = '', stable = 0;
    await until(async () => {
      const state = await inspect(`(() => {
        const paper = document.querySelector('[data-cv-paper]'), doc = (${preview})?.querySelector('.prolink-cv');
        return { fit: ${fitValue}, fonts: document.fonts.status,
          paper: paper ? [paper.getBoundingClientRect().width, paper.getBoundingClientRect().height] : [],
          document: doc ? [doc.getBoundingClientRect().width, doc.getBoundingClientRect().height] : [] };
      })()`);
      const signature = JSON.stringify(state);
      stable = signature === previous ? stable + 1 : 0; previous = signature;
      return state.fit === expected && state.fonts === 'loaded' && stable >= 2;
    }, 'Preview must settle with data-cv-fit=' + expected, 25000);
    assert.equal(await inspect(fitValue), expected, 'Correct one-page fit status');
    assert(await inspect(`document.body.innerText.includes('A4')`), 'Preview includes an A4 badge');
    if (expected === 'fits') {
      const ratio = await inspect(`(() => { const p = document.querySelector('[data-cv-paper]'); if (!p) return 0; const r = p.getBoundingClientRect(); return r.width / r.height; })()`);
      assert(Math.abs(ratio - 210 / 297) < 0.015, 'Preview paper must have portrait A4 proportions');
      assert(await inspect(`/(?:(?:صفحة|ورقة)(?:\\s+A4)?\\s+واحدة|1\\s*(?:\\/|من)\\s*1|one (?:A4 )?page)/i.test(document.body.innerText)`), 'Readable one-page fit status');
    }
  };
  const noHorizontalScroll = async () => {
    const overflow = await inspect(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const nodes = [document.documentElement, document.body, ...(dialog ? [dialog, ...dialog.querySelectorAll('*')] : [])];
      return nodes.filter(el => {
        if (!el.getClientRects().length || el.closest('.prolink-cv')) return false;
        const style = getComputedStyle(el);
        const scroller = el === document.documentElement || el === document.body || el === dialog || /^(auto|scroll)$/.test(style.overflowX);
        return scroller && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2;
      }).map(el => ({ tag: el.tagName, class: el.className, client: el.clientWidth, scroll: el.scrollWidth }));
    })()`);
    assert.deepEqual(overflow, [], 'No horizontal page/dialog/nested scroller overflow');
  };
  const assertVisibleContent = async sample => {
    const fragments = [sample.personal.fullName, sample.personal.title, sample.personal.location, sample.summary,
      ...sample.experiences.flatMap(e => [e.role, e.company, e.location, e.start, e.current ? '' : e.end, e.description]),
      ...sample.education.flatMap(e => [e.degree, e.school, e.field, e.start, e.end, e.description]),
      ...sample.skills, ...sample.languages.map(e => e.name), ...sample.certifications.flatMap(e => [e.name, e.issuer, e.year]),
      ...sample.links.map(e => e.label)].filter(Boolean);
    const content = await inspect(`(${preview})?.textContent || ''`);
    const compact = value => value.replace(/\s/g, '');
    for (const fragment of fragments) assert(compact(content).includes(compact(fragment)), 'Preview preserves: ' + fragment.slice(0, 90));
    // Range geometry detects display:none, line clamps and clipped overflow, not
    // just retained but invisible textContent. Scrollable ancestors remain valid.
    const descriptions = sample.experiences.map(e => e.description).filter(Boolean);
    const visibility = await inspect(`(() => {
      const host = ${preview};
      return ${JSON.stringify(descriptions)}.map(text => {
        const el = [...host.querySelectorAll('*')].find(n => n.textContent === text && ![...n.children].some(c => c.textContent === text));
        if (!el) return { visible: false, reason: 'missing description' };
        const range = document.createRange(); range.selectNodeContents(el); const rect = range.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return { visible: false, reason: 'empty range' };
        for (let p = el; p && p !== host.parentElement; p = p.parentElement) {
          const s = getComputedStyle(p), r = p.getBoundingClientRect();
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0 ||
              (s.webkitLineClamp && !['none', '0'].includes(s.webkitLineClamp)) ||
              (/^(hidden|clip)$/.test(s.overflowY) && (rect.bottom > r.bottom + 3 || rect.top < r.top - 3)))
            return { visible: false, reason: 'clipped description', class: p.className };
        }
        return { visible: true };
      });
    })()`);
    assert(visibility.every(item => item.visible), 'All experience text remains laid out without clipping: ' + JSON.stringify(visibility));
  };
  const overflowMessage = message => {
    assert(/[\u0600-\u06ff]/.test(message), 'Overflow rejection must be in Arabic');
    assert(/صفحة|ورقة|A4/.test(message) && /اختصر|تتجاوز|يتجاوز|طويل|تقليل|تقصير|لا تتسع|لا تتّسع|أطول|تجاوز/.test(message),
      'Actionable Arabic one-page overflow message, not an unrelated export error: ' + message);
  };
  const fresh = async () => {
    await viewport(1440);
    const navigation = await browser.page('Page.navigate', { url: fixtureUrl });
    assert(!navigation.errorText, navigation.errorText);
    await until(() => browser.loaded.has(navigation.loaderId), 'Fresh fixture navigation must load');
    await until(() => inspect(`Boolean(window.__cvTest && document.querySelector('[data-test="open-builder"]'))`), 'Fixture must mount');
    await until(() => inspect(`document.fonts.status === 'loaded'`), 'Local app fonts must load');
  };
  async function test(name, action) {
    const start = Date.now();
    try {
      await fresh(); await action(); results.push({ name, status: 'PASS', ms: Date.now() - start }); console.log('PASS ' + name);
    } catch (error) {
      const dom = await inspect(`document.body.innerText.slice(0, 2200)`).catch(() => '');
      results.push({ name, status: 'FAIL', error: error.stack || String(error), dom, ms: Date.now() - start });
      console.error('FAIL ' + name + '\n' + (error.stack || error));
      await capture('failure-' + results.length).catch(() => {});
    } finally {
      audits.push(await inspect(`({ audit: window.__cvAudit, boundaryErrors: window.__cvTest?.boundaryErrors || [] })`).catch(error => ({ readError: String(error) })));
    }
  }

  await test('Single setup page, native editing, repeated save, validation focus and actual download', async () => {
    await click(testButton('open-builder'));
    await until(() => inspect(`Boolean(document.querySelector('[data-cv-field="summary"]')) && document.querySelector('[aria-busy="true"]') === null`), 'All setup fields must render without navigating steps');
    const personalFields = ['fullName', 'title', 'location', 'phone', 'email', 'website'].map(name => 'personal.' + name);
    for (const field of [...personalFields, 'summary']) assert(await inspect(`Boolean(document.querySelector('[data-cv-field="${field}"]'))`), 'Setup field present: ' + field);
    assert(await inspect(`[...document.querySelectorAll('h1,h2')].some(el => el.textContent.trim() === 'إعداد السيرة الذاتية')`), 'New setup heading');
    assert(!await inspect(`Boolean(document.querySelector('[aria-current="step"],nav[aria-label*="خطوات"]'))`), 'No seven-step navigation');
    assert(!await inspect(`[...document.querySelectorAll('button')].some(el => /^(?:التالي|السابق)$/.test(el.textContent.trim()))`), 'No next/previous step buttons');
    assert.equal(await inspect(`document.querySelector('[data-cv-field="personal.fullName"]').value`), profile.name, 'Full name prefilled from fake profile');
    for (const label of ['حفظ السيرة', 'تجهيز PDF']) assert(await inspect(`Boolean(${button(label)})`), 'UI action present: ' + label);
    await fill('summary', 'مهندسة برمجيات تهتم بجودة العمل وتطوير تطبيقات مفيدة وسهلة الاستخدام.');
    await fill('personal.email', 'layla@example.test');
    await click(button('حفظ السيرة'));
    await until(() => inspect(`window.__cvTest.callbacks.length === 1`), 'First save must finish');
    await fill('personal.title', 'مهندسة برمجيات أولى');
    await click(button('حفظ السيرة'));
    await until(() => inspect(`window.__cvTest.callbacks.length === 2`), 'Second save must finish without closing');
    const saved = await inspect(`({ saves: window.__cvTest.saves, syncs: window.__cvTest.syncs, closes: window.__cvTest.closes })`);
    assert.equal(saved.saves.length, 2); assert.equal(saved.syncs.length, 2); assert.equal(saved.closes, 0);
    assert.equal(saved.saves[1].data.personal.title, 'مهندسة برمجيات أولى');
    assert.equal(saved.syncs[1].updates.title, 'مهندسة برمجيات أولى');
    for (const sync of saved.syncs) for (const forbidden of ['email', 'bio', 'avatar', 'avatar_url', 'cvUrl', 'role'])
      assert(!Object.hasOwn(sync.updates, forbidden), 'Save does not modify profile ' + forbidden);
    await fill('personal.email', 'not-an-email');
    const email = node('[data-cv-field="personal.email"]');
    const containingSummary = `(${email}).closest('details')?.querySelector(':scope > summary')`;
    assert(await inspect(`Boolean(${containingSummary})`), 'Optional contact fields must support closed-details validation');
    if (await inspect(`(${email}).closest('details').open`)) await click(containingSummary);
    assert.equal(await inspect(`(${email}).closest('details').open`), false, 'Email is inside a closed details section before save');
    await click(button('حفظ السيرة'));
    await until(() => inspect(`document.activeElement?.getAttribute('data-cv-field') === 'personal.email'`), 'Invalid email must receive focus even inside closed details');
    assert(await inspect(`(${email}).closest('details').open && (${email}).getAttribute('aria-invalid') === 'true'`), 'Validation opens details and exposes invalid field');
    assert.equal(await inspect('window.__cvTest.saves.length'), 2, 'Invalid email blocks the service save');
    assert.equal(await inspect('window.__cvTest.syncs.length'), 2, 'Invalid email blocks profile synchronization');
    await capture('builder-invalid-email');
    await fill('personal.email', 'layla@example.test');
    await waitFit('fits');
    for (const width of [320, 768, 1024, 1440]) {
      await viewport(width); await waitFit('fits');
      await scroll(node('[data-cv-field="personal.fullName"]'));
      await noHorizontalScroll(); await capture('builder-setup-' + width);
      await scroll(preview); await noHorizontalScroll(); await capture('builder-preview-' + width);
    }
    await openDetails(button('تجهيز PDF')); await click(button('تجهيز PDF'));
    await until(() => inspect(`Boolean((${button('تنزيل PDF')}) && !(${button('تنزيل PDF')}).disabled)`), 'Builder must finish preparing a PDF', 45000);
    assert(await inspect(exportClean), 'Builder export host is cleaned');
    await click(button('تنزيل PDF'));
    await until(() => [...browser.downloads.values()].some(item => item.state === 'completed'), 'Chrome must complete one actual PDF download', 20000);
    const completed = [...browser.downloads.values()].filter(item => item.state === 'completed');
    assert.equal(completed.length, 1, 'One click produces exactly one completed download');
    const files = await readdir(downloadsDirectory);
    assert.equal(files.length, 1, 'No duplicate or unfinished download file');
    assert(!files[0].endsWith('.crdownload'), 'Download must be complete');
    assert.match(completed[0].suggestedFilename, /\.pdf$/i);
    const bytes = await readFile(path.join(downloadsDirectory, files[0]));
    const lastDraft = await inspect('window.__cvTest.drafts[window.__cvTest.profile.id]?.data');
    assert(lastDraft, 'Edited synthetic draft remains available');
    const parsed = await assertPdf(bytes, lastDraft, await inspect('window.__cvTest.brand'), 'builder-download');
    pdfs.push({ name: 'builder-download', ...parsed });
    assert.equal(await inspect('window.__cvTest.closes'), 0, 'Builder stays open after download');
  });

  for (const name of ['arabic', 'english', 'hidden-phone', 'hidden-email', 'hidden-both', 'minimal', 'malformed-photo']) {
    await test('Real one-A4 export: ' + name, async () => {
      await click(testButton('open-' + name)); await waitFit('fits');
      const sample = await inspect('window.__cvTest.samples[' + JSON.stringify(name) + ']');
      await assertVisibleContent(sample);
      const rendered = await inspect(`({ direction: (${preview}).querySelector('.prolink-cv')?.getAttribute('dir'), links: [...(${preview}).querySelectorAll('a[href]')].map(a => a.getAttribute('href')) })`);
      assert.equal(rendered.direction, sample.settings.language === 'en' ? 'ltr' : 'rtl');
      if (!sample.settings.showPhone) assert(!rendered.links.some(url => /^(?:tel:|https:\/\/wa\.me\/)/.test(url)), 'Preview also hides phone links');
      if (!sample.settings.showEmail) assert(!rendered.links.some(url => url.startsWith('mailto:')), 'Preview also hides email links');
      await click(testButton('direct-export'));
      await until(() => inspect(`window.__cvTest.exports.at(-1)?.status !== 'pending' && window.__cvTest.exports.length === 1`), 'Direct export button must finish', 45000);
      const result = await inspect('window.__cvTest.exports[0]');
      assert.equal(result.status, 'success', result.error || name + ' export failed');
      assert.equal(result.type, 'application/pdf');
      const bytes = Buffer.from(result.base64, 'base64'); assert.equal(bytes.length, result.bytes);
      const file = path.join(output, name + '.pdf'); await writeFile(file, bytes); artifacts.push(file);
      pdfs.push({ name, ...await assertPdf(bytes, sample, await inspect('window.__cvTest.brand'), name) });
      assert(await inspect(exportClean), 'Export host removed after success');
      await scroll(preview); await capture('preview-' + name);
    });
  }

  await test('10 x 1000-character CV refuses export, preserves every description and cleans host', async () => {
    await click(testButton('open-long')); await waitFit('overflow');
    const sample = await inspect('window.__cvTest.samples.long');
    assert.equal(sample.experiences.length, 10);
    assert(sample.experiences.every(entry => entry.description.length === 1000));
    await assertVisibleContent(sample);
    await click(testButton('direct-export'));
    await until(() => inspect(`window.__cvTest.exports[0]?.status === 'error' || window.__cvTest.exports[0]?.status === 'success'`), 'Long export must settle', 45000);
    const result = await inspect('window.__cvTest.exports[0]');
    assert.equal(result.status, 'error', 'Never silently shrink/truncate/paginate a huge CV into a successful export');
    assert(!result.base64 && !result.bytes, 'Overflow must not return a partial PDF'); overflowMessage(result.error);
    assert(await inspect(`document.querySelector('[data-test="direct-result"]').innerText.includes(${JSON.stringify(result.error)})`), 'Arabic rejection is visible');
    await assertVisibleContent(sample); assert(await inspect(exportClean), 'Export host removed after overflow failure');
    await scroll(testButton('direct-result')); await capture('overflow-message');
    const finalDescription = `([...(${preview}).querySelectorAll('*')].find(el => el.textContent === ${JSON.stringify(sample.experiences[9].description)}))`;
    await scroll(finalDescription); await capture('overflow-last-experience-retained');
    // A later success proves the module-wide busy guard also resets on failure.
    await click(testButton('back')); await click(testButton('open-minimal')); await waitFit('fits');
    await click(testButton('direct-export'));
    await until(() => inspect(`window.__cvTest.exports.length === 2 && window.__cvTest.exports[1].status !== 'pending'`), 'Export must recover after overflow', 45000);
    assert.equal(await inspect('window.__cvTest.exports[1].status'), 'success');
    assert(await inspect(exportClean));
  });

  await test('Long builder keeps editable content and gives a visible Arabic overflow explanation', async () => {
    await click(testButton('open-long-builder'));
    await until(() => inspect(`Boolean(document.querySelector('[data-cv-field="personal.fullName"]'))`), 'Seeded builder must load');
    await waitFit('overflow');
    const field = node('[data-cv-field="experiences.long-9.description"]'); await openDetails(field);
    for (let i = 0; i < 10; i++) {
      const actual = await inspect(`document.querySelector('[data-cv-field="experiences.long-${i}.description"]')?.value`);
      assert.equal(actual, longCv.experiences[i].description, 'Builder preserves every long experience');
    }
    // Implementations may disable prepare once overflow is known, or reject on
    // click. Both must explain why and must never enable delivery of a PDF.
    await openDetails(button('تجهيز PDF'));
    if (!await inspect(`(${button('تجهيز PDF')}).disabled`)) {
      await click(button('تجهيز PDF'));
      await until(() => inspect(`Boolean(${button('تجهيز PDF')}) && !document.body.innerText.includes('جارٍ تجهيز PDF…')`), 'Overflow preparation must release loading', 45000);
    }
    const message = await inspect(`[...document.querySelectorAll('[role="alert"],[role="status"],[data-cv-fit]')].map(el => el.innerText).join('\\n')`);
    overflowMessage(message);
    assert(await inspect(`[${button('تنزيل PDF')}, ${button('مشاركة PDF')}].every(el => !el || el.disabled)`), 'Overflow does not enable delivery');
    await assertVisibleContent(await inspect('window.__cvTest.samples.long'));
    assert(await inspect(exportClean), 'Long builder leaves no export host');
    await scroll(field); await capture('builder-long-last-field');
  });

  await test('Existing viewer still prepares safely, invalidates changed privacy and closes with Escape', async () => {
    await click(testButton('open-viewer')); await waitFit('fits');
    await click(button('تجهيز PDF'));
    await until(() => inspect(`Boolean(${button('تنزيل')})`), 'Existing viewer must still prepare its PDF', 45000);
    assert(await inspect(exportClean));
    await click(testButton('viewer-hide-contacts'));
    await until(() => inspect(`Boolean(${button('تجهيز PDF')}) && !(${button('تنزيل')})`), 'Privacy change invalidates old prepared PDF');
    await waitFit('fits');
    assert(!await inspect(`Boolean((${preview}).querySelector('a[href^="tel:"],a[href^="mailto:"],a[href^="https://wa.me/"]'))`), 'Viewer privacy update removes contact links');
    await click(button('تجهيز PDF'));
    await until(() => inspect(`Boolean(${button('تنزيل')})`), 'Changed viewer can prepare again', 45000);
    await capture('old-viewer-private'); await key('Escape', 'Escape');
    await until(() => inspect(`!document.querySelector('[role="dialog"]') && window.__cvTest.closes === 1`), 'Escape closes old viewer');
    assert(await inspect(exportClean));
  });

  await test('Existing viewer rejects oversized CV without discarding preview content', async () => {
    await click(testButton('open-long-viewer')); await waitFit('overflow');
    await click(button('تجهيز PDF'));
    await until(() => inspect(`Boolean(document.querySelector('[role="alert"]'))`), 'Old viewer must expose overflow error', 45000);
    overflowMessage(await inspect(`document.querySelector('[role="alert"]').innerText`));
    assert(!await inspect(`Boolean(${button('تنزيل')})`), 'Old viewer cannot offer an oversized PDF');
    await assertVisibleContent(await inspect('window.__cvTest.samples.long'));
    assert(await inspect(exportClean)); await capture('old-viewer-overflow');
    await key('Escape', 'Escape');
    await until(() => inspect(`!document.querySelector('[role="dialog"]')`), 'Old viewer remains closable after rejection');
  });

  try {
    assert.deepEqual(browser.network, [], 'No external request attempts');
    assert.deepEqual(unexpectedRequests, [], 'Only explicit fixture/assets endpoints requested');
    assert.deepEqual(browser.exceptions, [], 'No uncaught browser exceptions');
    assert.deepEqual(browser.consoleMessages, [], 'No browser console warnings/errors');
    for (const audit of audits) {
      assert(!audit.readError, audit.readError); assert(audit.audit, 'Fixture audit is available');
      assert.deepEqual(audit.audit.network, [], 'No forbidden network/navigation boundary calls');
      assert.deepEqual(audit.audit.errors, [], 'No uncaught fixture errors');
      assert.deepEqual(audit.audit.console, [], 'No fixture console errors/warnings');
      assert.deepEqual(audit.boundaryErrors, [], 'No Supabase calls');
    }
    results.push({ name: 'No live DB/auth, external requests or browser errors', status: 'PASS' });
  } catch (error) {
    results.push({ name: 'No live DB/auth, external requests or browser errors', status: 'FAIL', error: error.stack || String(error) });
  }
  const report = { results, pdfs, screenshotsAndPdfs: artifacts, outputDirectory: output,
    downloadsDirectory, blockedBrowserBackgroundProxyRequests: blockedProxyRequests,
    browserConsole: browser.consoleMessages, browserExceptions: browser.exceptions, network: browser.network,
    unexpectedRequests, audits, userAgent: await inspect('navigator.userAgent') };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const failed = results.filter(result => result.status !== 'PASS');
  console.log(`${results.length - failed.length}/${results.length} CV browser cases passed.`);
  console.log('Retained evidence: ' + output);
  assert.equal(failed.length, 0, 'CV browser regressions failed; inspect retained report/screenshots');
} catch (error) {
  console.error(error.stack || String(error)); process.exitCode = 1;
  if (output) console.error('Evidence retained at: ' + output);
} finally {
  await browser?.close();
  for (const close of cleanupServers.reverse()) await close();
  if (owned) await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  // Deliberately do not delete output: the caller must inspect the screenshots.
}
