// Run: node tests/browser-reliability.mjs
// Real isolated Chromium + bundled production modules; no installed browser driver.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const caseNames = [
  'BilingualSmartText preserves full Arabic, English and long text after <',
  'Arabic phone click opens ContactMenuHost with WhatsApp and tel links',
  'RSS content:encoded outranks content and description, including trailing text',
  'Atom content outranks summary, including trailing text',
  'ServicesView consumes fresh prefetch cache without a duplicate request or loading flash',
  'ServicesView unmount/remount reuses fresh cache without a request or loading flash',
  'ServicesView viewer change hides previous rows and fetches separately',
  'ServicesView debounced search renders empty results and clear restores cache',
  'ServicesView failed request finishes loading and retry succeeds once',
  'ServicesView real 10-second timeout finishes loading, aborts and permits retry',
  'ServicesView in-flight unmount aborts; late response cannot pollute remount',
  'App home marketplace profile return preserves filters/results and clears stale origin',
  'App standalone services profile return preserves filters/results and clears stale origin',
  'No unexpected browser errors, network attempts or external link activation',
];

// Compile verbatim App slices, not a second implementation of navigation. Only
// unrelated home content and the authenticated ProfilePage body are omitted.
const app = ts.createSourceFile('App.tsx', await readFile(path.join(root, 'src/App.tsx'), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
(function visit(node) { nodes.push(node); ts.forEachChild(node, visit); })(app);
const text = node => node.getText(app);
function one(predicate) {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, 'App navigation slice must be unambiguous');
  return matches[0];
}
function ancestor(node, predicate) {
  for (let parent = node.parent; parent; parent = parent.parent) if (predicate(parent)) return parent;
  throw new Error('Required App navigation ancestor missing');
}
const component = name => one(n => ts.isJsxSelfClosingElement(n) && text(n.tagName) === name);
const markets = nodes.filter(n => ts.isJsxSelfClosingElement(n) && text(n.tagName) === 'ServicesView');
assert.equal(markets.length, 2, 'Exercise both actual ServicesView entry points');
const homeChoice = ancestor(markets[0], ts.isConditionalExpression);
const homeWrapper = ancestor(markets[0], n => ts.isJsxElement(n) &&
  text(n.openingElement).includes('keepalive-tab-home'));
const dedicatedMarket = ancestor(markets[1], ts.isJsxExpression);
const profile = component('ProfilePage');
const profileWrapper = ancestor(profile, ts.isJsxExpression);
const back = one(n => ts.isJsxElement(n) && text(n.openingElement.tagName) === 'button' &&
  text(n).includes('العودة إلى سوق المهن'));
assert(back.pos > profileWrapper.pos && back.end < profile.pos, 'Back belongs inside profile, before Suspense');
assert(back.end < profile.parent.openingElement.pos, 'Back must remain outside ProfilePage Suspense');
for (const name of ['Navbar', 'MobileNav']) {
  const nav = component(name);
  assert(nav.end < profileWrapper.pos && !text(ancestor(nav, ts.isJsxExpression)).includes("activeTab !== 'profile'"),
    name + ' must remain separate from the profile-only back control');
}
const states = ['returnToServicesTab', 'returnToJob', 'returnToDetailFeed'].map(name => text(ancestor(one(n =>
  ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && text(n.name.elements[0]) === name), ts.isVariableStatement))).join('\n');
const clearOrigin = text(one(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) &&
  text(n.expression.expression) === 'useEffect' && text(n).includes('setReturnToServicesTab')));
const profileProps = profile.attributes.properties.filter(n => ['profile', 'onBack'].includes(text(n.name))).map(text).join(' ');
const navigationShell = `
// Context and other screens are test-owned; navigation handlers/effect/JSX below are production text.
function NavigationShell({ entry }) {
  const [activeTab, setActiveTab] = useState(entry), [selectedProfile, setSelectedProfile] = useState(null);
  ${states}
  ${clearOrigin}
  const appUser = viewer('navigation-' + entry), selectedJobCategory = entry === 'home' ? 'services' : 'الكل';
  const requireAuth = () => check(false, 'Unexpected authentication prompt');
  const setDetailFeed = requireAuth, setInitialJobForMissions = requireAuth;
  useEffect(() => { setReturnToJob({ id: 'stale-job' }); setReturnToDetailFeed({ type: 'job' }); }, []);
  return <div className="navigation-fixture" data-tab={activeTab} data-selected={selectedProfile?.id || ''}
    data-origin={returnToServicesTab || ''} data-stale={Boolean(returnToJob || returnToDetailFeed)}>
    <nav aria-label="Test shell top navigation"><button onClick={() => setActiveTab('settings')}>Test: leave profile</button></nav>
    ${text(homeWrapper.openingElement)}{${text(homeChoice.condition)} ? ${text(homeChoice.whenTrue)} : null}${text(homeWrapper.closingElement)}
    ${text(dedicatedMarket)}
    ${text(profileWrapper).replace(text(profile), '<ProfileStub ' + profileProps + ' />')}
    <nav aria-label="Test shell bottom navigation"><button onClick={() => { setSelectedProfile(null); setActiveTab('profile'); }}>Test: own profile</button></nav>
  </div>;
}
const TabSkeleton = () => <p>Test shell loading</p>;
const ProfileStub = ({ profile, onBack }) => <article aria-label="Synthetic profile body">
  <h2>{profile.name}</h2><p>Isolated navigation fixture — not the authenticated ProfilePage.</p>
  <button onClick={onBack}>Test: ProfilePage onBack</button></article>;
`;

// Installed before any application module executes. CSP and a rejecting proxy
// independently block browser resource loads, not just fetch/XHR calls.
const guard = String.raw`
window.__audit = { network: [], errors: [], console: [] };
const deny = kind => function () {
  window.__audit.network.push(kind);
  throw new Error('Forbidden network/navigation boundary: ' + kind);
};
window.fetch = deny('fetch');
XMLHttpRequest.prototype.open = deny('XMLHttpRequest');
window.WebSocket = deny('WebSocket');
window.EventSource = deny('EventSource');
window.RTCPeerConnection = deny('RTCPeerConnection');
navigator.sendBeacon = deny('sendBeacon');
window.open = deny('window.open');
document.addEventListener('click', event => {
  if (event.target.closest?.('a[href]')) {
    event.preventDefault();
    window.__audit.network.push('anchor activation');
  }
}, true);
document.addEventListener('submit', event => {
  event.preventDefault();
  window.__audit.network.push('form submission');
}, true);
window.addEventListener('securitypolicyviolation', event => {
  window.__audit.network.push('CSP: ' + event.violatedDirective);
});
window.addEventListener('error', event => window.__audit.errors.push(event.message));
window.addEventListener('unhandledrejection', event => window.__audit.errors.push(String(event.reason)));
for (const level of ['error', 'warn']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    window.__audit.console.push({ level, text: args.map(String).join(' ') });
    original(...args);
  };
}
`;

const fixture = String.raw`
import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BilingualSmartText } from './src/lib/utils/bilingualText';
import { ContactMenuHost } from './src/components/ui/ContactMenu';
import { newsService } from './src/lib/services/newsService';
import { ServicesView, prefetchServices } from './src/components/features/services/ServicesView';

__NAVIGATION_SHELL__
const names = __CASE_NAMES__;
const results = [];
const requests = [];
const queued = [];
const boundaryErrors = [];
const expectedConsole = [];
const audit = window.__audit;
let activeRoot;
let activeHost;
let currentCase = '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const compact = text => text.replace(/\s/g, '');
function check(value, message) { if (!value) throw new Error(message); }
function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  const brief = text => text.length > 500 ? text.slice(0, 250) + ' ... ' + text.slice(-150) + ' (length ' + text.length + ')' : text;
  check(a === b, message + '; actual=' + brief(a) + '; expected=' + brief(b));
}
async function until(predicate, message, timeout = 2500) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error(message);
    await delay(25);
  }
}
function mount(element) {
  check(!activeRoot, 'Previous root must be unmounted');
  activeHost = document.createElement('section');
  document.getElementById('fixture').append(activeHost);
  activeRoot = createRoot(activeHost);
  flushSync(() => activeRoot.render(element));
  return activeHost;
}
function unmount() {
  if (activeRoot) flushSync(() => activeRoot.unmount());
  activeRoot = null;
  activeHost?.remove();
  activeHost = null;
}
const viewer = id => ({ id, name: 'Synthetic viewer', email: '', avatar: '', role: 'seeker' });
const provider = (id, name = id) => ({
  id, name, role: 'freelancer', avatar_url: '', title: 'كهربائي',
  display_title: 'كهربائي تجريبي', location: 'بغداد', is_available: true,
  is_active: true, is_pro: false, bio: 'Synthetic provider only',
});
const services = id => <ServicesView appUser={viewer(id)} onUserClick={() => {}} onRequireAuth={() => {}} />;
const busy = () => activeHost?.querySelector('[aria-busy]')?.getAttribute('aria-busy');
const alert = () => activeHost?.querySelector('[role="alert"]');
const cardNames = () => [...activeHost.querySelectorAll('h3')].map(node => node.textContent);
const button = label => [...activeHost.querySelectorAll('button')].find(node => node.textContent.trim() === label);
function click(node) {
  check(node instanceof HTMLElement && !node.disabled, 'Expected an enabled clickable element');
  check(node.getBoundingClientRect().width > 0, 'Expected a laid-out clickable element');
  flushSync(() => node.click());
}
async function ready(name) {
  await until(() => busy() === 'false' && cardNames().includes(name), 'Expected loaded provider ' + name);
  check(!alert(), 'Successful results must not have an error alert');
  check(!activeHost.querySelector('[aria-label="جاري تحميل الخدمات"]'), 'Loading skeleton must finish');
}
function expectResponse(options = {}) {
  const plan = { rows: [], error: null, hold: false, ignoreAbort: false, ...options };
  queued.push(plan);
  return plan;
}

// This is the ONLY substituted application import. The strict query boundary
// records actual component requests and provides controlled synthetic replies.
window.__database = {
  from(table) {
    check(table === 'profiles', 'Unexpected Supabase table ' + table);
    const record = { operations: [], signal: null, case: currentCase };
    requests.push(record);
    const query = {};
    for (const method of ['select', 'in', 'not', 'order', 'range', 'or', 'ilike']) {
      query[method] = (...args) => { record.operations.push([method, ...args]); return query; };
    }
    query.abortSignal = signal => { record.signal = signal; return query; };
    query.then = (resolve, reject) => {
      const plan = queued.shift();
      if (!plan) {
        const message = 'Unexpected Supabase request in ' + currentCase;
        boundaryErrors.push(message);
        return Promise.reject(new Error(message)).then(resolve, reject);
      }
      plan.record = record;
      record.startedAt = performance.now();
      const response = new Promise((done, fail) => {
        check(record.signal instanceof AbortSignal, 'Actual helper must attach AbortSignal');
        check(record.operations.some(op => op[0] === 'in' && op[1] === 'role' &&
          JSON.stringify(op[2]) === JSON.stringify(['freelancer', 'seeker', 'job_seeker'])),
          'Actual provider role filter must execute');
        check(record.operations.some(op => op[0] === 'range' && op[1] === 0 && op[2] === 9),
          'Expected actual first-page range');
        plan.release = () => {
          record.settledAt = performance.now();
          done({ data: plan.rows, count: plan.rows.length, error: plan.error });
        };
        record.signal.addEventListener('abort', () => {
          record.abortedAt = performance.now();
          if (!plan.ignoreAbort) fail(new DOMException('Fixture request aborted', 'AbortError'));
        }, { once: true });
        if (!plan.hold) plan.release();
      });
      return response.then(resolve, reject);
    };
    return query;
  },
};

async function test(index, action) {
  currentCase = names[index];
  const start = performance.now();
  try {
    await action();
    check(queued.length === 0, 'All planned Supabase responses must be consumed');
    results.push({ name: currentCase, status: 'PASS', ms: Math.round(performance.now() - start) });
  } catch (error) {
    results.push({ name: currentCase, status: 'FAIL', error: String(error),
      dom: activeHost?.textContent.slice(-1200) || '' });
  } finally {
    unmount();
    queued.length = 0;
    await delay(50);
  }
}

async function run() {
  await test(0, async () => {
    const texts = [
      'الخبرة < 5 سنوات\nبقية التفاصيل والنهاية',
      'Software Engineer experience < 4 years with all final details',
      'Software Engineer خبرة < 4 سنوات ونص أخير',
      '١٢٣ < ٩٩٩ و 500 > 100',
      'الخبرة < 5 سنوات\n' + 'تفاصيل كاملة محفوظة '.repeat(400) + '\nالنهاية بعد كامل التفاصيل',
      'Literal <section> text must remain text, not markup',
    ];
    const host = mount(<>{texts.map((text, index) =>
      <article data-text-case={index} key={index}><BilingualSmartText text={text} /></article>
    )}<ContactMenuHost /></>);
    texts.forEach((text, index) => equal(compact(host.querySelector('[data-text-case="' + index + '"]').textContent),
      compact(text), 'Full rendered text must be retained for sample ' + index));
    check(host.querySelector('p[dir="rtl"]') && host.querySelector('p[dir="ltr"]'), 'Both text directions must render');
    check(!host.querySelector('article section'), 'Literal markup must not become HTML');
  });

  await test(1, async () => {
    const phone = '٠٧٧٠ ١٢٣ ٤٥٦٧';
    let bubbled = 0;
    const host = mount(<><div onClick={() => bubbled++}>
      <BilingualSmartText text={'اتصل ' + phone + ' الراتب 500000 التاريخ 2026-11-17'} />
    </div><ContactMenuHost /></>);
    await delay(25); // Allow the real host's effect listener to attach.
    const phones = host.querySelectorAll('button');
    equal(phones.length, 1, 'Only the phone, not salary/date, should be actionable');
    equal(phones[0].getAttribute('aria-label'), 'التواصل مع ' + phone, 'Accessible Arabic phone label');
    click(phones[0]);
    await until(() => host.textContent.includes('خيارات التواصل'), 'Actual contact menu should open');
    equal(bubbled, 0, 'Phone click must not activate a parent card');
    const wa = host.querySelector('a[href="https://wa.me/9647701234567"]');
    const tel = host.querySelector('a[href="tel:+9647701234567"]');
    check(wa && tel, 'Both correctly normalized contact links must exist');
    equal(wa.target, '_blank', 'WhatsApp opens separately when used by a human');
    check(wa.relList.contains('noopener') && wa.relList.contains('noreferrer'), 'WhatsApp link isolation');
    check(wa.getBoundingClientRect().height > 0 && tel.getBoundingClientRect().height > 0, 'Links must be laid out');
    // Deliberately NEVER activate either external link.
    flushSync(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await until(() => !host.querySelector('a[href^="tel:"]'), 'Escape must close ContactMenuHost');
  });

  await test(2, async () => {
    const content = 'الخبرة < 5 سنوات\n\n' + 'التفاصيل الكاملة '.repeat(400) + 'نهاية الخبر الكامل';
    const xml = '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>' +
      '<title>خبر تجريبي</title><guid>fixture-rss</guid><description>ملخص قصير فقط</description>' +
      '<content>محتوى بديل غير مطلوب</content><content:encoded><![CDATA[<p>' +
      content.replace('\n\n', '</p><p>') + '</p>]]></content:encoded></item></channel></rss>';
    const parsed = new DOMParser().parseFromString(xml, 'text/xml');
    check(!parsed.querySelector('parsererror'), 'Synthetic RSS must be valid XML');
    check(parsed.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded').length === 1,
      'Native DOM must contain the actual namespaced encoded element');
    const items = newsService.parseXML(xml, 'Synthetic RSS');
    equal(items.length, 1, 'RSS must parse in native DOMParser');
    equal(compact(items[0].content), compact(content), 'Namespaced encoded content must win in full');
    equal(items[0].description, 'ملخص قصير فقط', 'RSS summary remains separate');
    const host = mount(<BilingualSmartText text={items[0].content} />);
    equal(compact(host.textContent), compact(content), 'Parsed full RSS content must render past <');
  });

  await test(3, async () => {
    const content = 'Experience < 5 years\n\nAll final Atom details remain available';
    const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>fixture-atom</id>' +
      '<title>Atom fixture</title><summary>Short summary only</summary>' +
      '<content type="html">&lt;p&gt;Experience &amp;lt; 5 years&lt;/p&gt;' +
      '&lt;p&gt;All final Atom details remain available&lt;/p&gt;</content></entry></feed>';
    const items = newsService.parseXML(xml, 'Synthetic Atom');
    equal(items.length, 1, 'Atom must parse in native DOMParser');
    equal(compact(items[0].content), compact(content), 'Atom content must outrank summary');
    equal(items[0].description, 'Short summary only', 'Atom summary remains separate');
    const host = mount(<BilingualSmartText text={items[0].content} />);
    equal(compact(host.textContent), compact(content), 'Atom text must render fully');
  });

  await test(4, async () => {
    const start = requests.length;
    const row = provider('prefetched-provider');
    expectResponse({ rows: [row] });
    await prefetchServices('prefetch-viewer', new AbortController().signal);
    await prefetchServices('prefetch-viewer', new AbortController().signal);
    equal(requests.length - start, 1, 'Second fresh prefetch must not request again');
    mount(services('prefetch-viewer'));
    equal(cardNames(), [row.name], 'Prefetched row is present in the first committed render');
    equal(busy(), 'false', 'Fresh prefetch must not start in loading state');
    await ready(row.name);
    await delay(350);
    equal(requests.length - start, 1, 'Mount must reuse the fresh prefetch');
  });

  await test(5, async () => {
    const start = requests.length;
    const row = provider('remounted-provider');
    expectResponse({ rows: [row] });
    mount(services('remount-viewer'));
    await ready(row.name);
    unmount();
    await delay(100);
    mount(services('remount-viewer'));
    equal(cardNames(), [row.name], 'Remount paints cached row immediately');
    equal(busy(), 'false', 'Fresh remount must not flash skeleton/loading');
    await delay(350);
    equal(requests.length - start, 1, 'Unmount/remount must not duplicate fresh request');
  });

  await test(6, async () => {
    const start = requests.length;
    const oldRow = provider('viewer-a-only');
    const newRow = provider('viewer-b-only');
    expectResponse({ rows: [oldRow] });
    mount(services('scope-viewer-a'));
    await ready(oldRow.name);
    const oldCard = activeHost.querySelector('h3').closest('.group');
    await until(() => Number(getComputedStyle(oldCard).opacity) >= 0.99, 'Old card must finish entering before account switch');
    const next = expectResponse({ rows: [newRow], hold: true });
    flushSync(() => activeRoot.render(services('scope-viewer-b')));
    const retainedOldRow = cardNames().includes(oldRow.name);
    const retainedOpacity = oldCard.isConnected ? getComputedStyle(oldCard).opacity : 'detached';
    await until(() => next.release && busy() === 'true', 'Different viewer must fetch independently');
    next.release();
    await ready(newRow.name);
    await until(() => !cardNames().includes(oldRow.name), 'Old viewer card must at least finish exiting');
    equal(cardNames(), [newRow.name], 'Viewer B must only receive its own result');
    equal(requests.length - start, 2, 'Viewer-specific cache must require two requests');
    check(!retainedOldRow, 'Previous viewer row remained in DOM on account-change commit (opacity ' + retainedOpacity +
      '), although viewer-scoped fetch and eventual replacement succeeded');
  });

  await test(7, async () => {
    const start = requests.length;
    const row = provider('search-original-provider');
    expectResponse({ rows: [row] });
    mount(services('search-viewer'));
    await ready(row.name);
    const empty = expectResponse({ rows: [] });
    const input = activeHost.querySelector('input');
    input.focus();
    flushSync(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'تخصص غير موجود');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await delay(100);
    equal(requests.length - start, 1, 'Search must be debounced, not dispatched immediately');
    await until(() => empty.record && busy() === 'false' && activeHost.textContent.includes('لا توجد نتائج مطابقة'),
      'Search must finish with the actual empty-results UI');
    check(empty.record.operations.some(op => op[0] === 'or' && op[1].includes('تخصص غير موجود')),
      'Search term must reach the actual query');
    await until(() => cardNames().length === 0, 'Previous cards must exit after empty search');
    check(!alert(), 'Empty response is not a request failure');
    check(!activeHost.querySelector('[role="status"]'), 'Empty search must not leave loading UI');
    click(activeHost.querySelector('[aria-label="مسح جميع الفلاتر"]'));
    await ready(row.name);
    await delay(350);
    equal(requests.length - start, 2, 'Clear must reuse original cached page');
  });

  await test(8, async () => {
    const start = requests.length;
    const errorText = '[ServicesView] fetch error: Error: fixture-request-failed';
    expectedConsole.push(errorText);
    expectResponse({ error: new Error('fixture-request-failed') });
    mount(services('error-viewer'));
    await until(() => alert() && busy() === 'false', 'Failed request must finish loading with alert');
    check(alert().textContent.includes('تعذّر تحميل الخدمات'), 'Expected request-failure message');
    check(!activeHost.textContent.includes('لا يوجد مزودو خدمات مسجلون بعد'), 'Failure must not masquerade as empty success');
    check(!activeHost.querySelector('[role="status"]'), 'Failure must remove skeleton/status');
    const row = provider('recovered-provider');
    const retry = expectResponse({ rows: [row], hold: true });
    const retryButton = button('إعادة المحاولة');
    check(retryButton && !retryButton.disabled, 'Retry must be enabled');
    // Two clicks before React commits exercise the synchronous request-ref guard.
    flushSync(() => { retryButton.click(); retryButton.click(); });
    await until(() => retry.release && busy() === 'true', 'Retry must initiate loading');
    equal(requests.length - start, 2, 'Rapid retry must dispatch only one new request');
    retry.release();
    await ready(row.name);
    check(!button('بحث').disabled, 'Search must be enabled after recovery');
    equal(requests.length - start, 2, 'Recovery must not dispatch another request');
  });

  await test(9, async () => {
    const start = requests.length;
    expectedConsole.push('[ServicesView] fetch error: Error: TIMEOUT: ServicesView.providers (10000ms)');
    const stalled = expectResponse({ hold: true });
    mount(services('timeout-viewer'));
    await until(() => stalled.record && busy() === 'true', 'Stalled request must start with loading UI');
    check(activeHost.querySelector('[aria-label="جاري تحميل الخدمات"]'), 'Initial stalled request needs a loading skeleton');
    // Native, real-time browser timers: no replaced helper, fake clock or virtual time.
    await until(() => alert() && busy() === 'false', '10-second timeout must release loading', 11500);
    const elapsed = performance.now() - stalled.record.startedAt;
    check(elapsed >= 9950 && elapsed <= 11500, 'Timeout must occur around 10 seconds, observed ' + elapsed);
    check(alert().textContent.includes('استغرق تحميل الخدمات وقتاً طويلاً'), 'Timeout needs the dedicated error message');
    check(stalled.record.signal.aborted, 'Timeout must abort the actual request signal');
    check(!activeHost.querySelector('[role="status"]'), 'Timeout must remove skeleton/status');
    check(!activeHost.textContent.includes('لا يوجد مزودو خدمات مسجلون بعد'), 'Timeout must not render empty success');
    const row = provider('timeout-recovered-provider');
    expectResponse({ rows: [row] });
    click(button('إعادة المحاولة'));
    await ready(row.name);
    equal(requests.length - start, 2, 'Timeout retry must perform one fresh request');
  });

  await test(10, async () => {
    const start = requests.length;
    const late = expectResponse({ rows: [provider('aborted-stale-provider')], hold: true, ignoreAbort: true });
    mount(services('inflight-viewer'));
    await until(() => late.release && busy() === 'true', 'Initial request must be pending');
    unmount();
    check(late.record.signal.aborted, 'Unmount must abort its request signal');
    const row = provider('inflight-remount-provider');
    const fresh = expectResponse({ rows: [row], hold: true });
    mount(services('inflight-viewer'));
    await until(() => fresh.release, 'Remount must issue a new request');
    late.release();
    await delay(100);
    equal(cardNames(), [], 'Aborted late response must not appear in remount');
    equal(busy(), 'true', 'Aborted predecessor must not finish successor loading');
    fresh.release();
    await ready(row.name);
    unmount();
    mount(services('inflight-viewer'));
    equal(cardNames(), [row.name], 'Late old response must not poison the cache');
    await delay(350);
    equal(requests.length - start, 2, 'Final remount must use only the successful fresh cache');
  });

  for (const [index, entry] of ['home', 'services'].entries()) await test(11 + index, async () => {
    const start = requests.length, row = provider('navigation-provider-' + entry, 'مزود تجريبي ' + entry);
    expectResponse({ rows: [row] });
    const host = mount(<NavigationShell entry={entry} />), shell = host.querySelector('.navigation-fixture');
    await ready(row.name);
    const inputs = [...host.querySelectorAll('input')], values = ['كهربائي', 'بغداد'];
    const filtered = expectResponse({ rows: [row, { ...provider('unavailable-' + entry), is_available: false }] });
    flushSync(() => inputs.forEach((input, i) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, values[i]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    await until(() => filtered.record && busy() === 'false', 'Both market filters must finish searching');
    check(filtered.record.operations.some(op => op[0] === 'or' && op[1].includes(values[0])) &&
      filtered.record.operations.some(op => op[0] === 'ilike' && op[2].includes(values[1])), 'Actual query must use both filters');
    const available = host.querySelector('[aria-pressed]');
    click(available);
    await until(() => cardNames().length === 1, 'Availability filter must remove unavailable result');
    const card = host.querySelector('h3'), market = inputs[0].closest('[aria-hidden]');
    const navs = [...host.querySelectorAll('nav')];
    for (const returnLabel of ['العودة إلى سوق المهن', 'Test: ProfilePage onBack']) {
      click(button('عرض الملف'));
      equal(shell.dataset.tab, 'profile', 'Actual source handler must open profile');
      equal(shell.dataset.selected, row.id, 'Actual provider must be selected');
      equal(shell.dataset.stale, 'false', 'Service origin must clear prior job/detail origins');
      check(market.isConnected && inputs.every(input => input.isConnected), 'Actual market wrapper must keep component mounted');
      equal(market.getAttribute('aria-hidden'), 'true', 'Retained market must leave accessibility tree');
      equal(inputs[0].getClientRects().length, 0, 'Retained market must be visually hidden');
      const back = button('العودة إلى سوق المهن');
      check(back?.tagName === 'BUTTON' && back.type === 'button' && !back.disabled && back.tabIndex === 0,
        'Return control must be an enabled named native keyboard button');
      await until(() => back.checkVisibility({ checkOpacity: true }) &&
        getComputedStyle(back.parentElement.parentElement).transform === 'none', 'Back button animation must settle visibly');
      back.focus();
      check(document.activeElement === back && back.getBoundingClientRect().height >= 44,
        'Back focus=' + (document.activeElement === back) + ', height=' + back.getBoundingClientRect().height +
        ', profile transform=' + getComputedStyle(back.parentElement.parentElement).transform);
      if (returnLabel === 'العودة إلى سوق المهن') {
        const captured = new Promise(resolve => window.addEventListener('fixture-captured', resolve, { once: true }));
        console.log('NAV_CAPTURE:' + entry);
        await captured;
      }
      click(button(returnLabel));
      equal(shell.dataset.tab, entry, 'Return must restore the same marketplace entry');
      equal([shell.dataset.selected, shell.dataset.origin], ['', ''], 'Return must clear selected profile and origin');
      check(!button('العودة إلى سوق المهن'), 'Return button must disappear outside profile');
      equal(market.getAttribute('aria-hidden'), 'false', 'Market must become accessible again');
      check(inputs[0].getClientRects().length > 0 && inputs[0] === host.querySelector('input'), 'Return must reuse visible input DOM');
      equal(inputs.map(input => input.value), values, 'Search filters must survive profile return');
      equal(available.getAttribute('aria-pressed'), 'true', 'Availability filter must survive');
      check(card === host.querySelector('h3') && navs.every(nav => nav.isConnected), 'Result and shell navigation must stay mounted');
      equal(cardNames(), [row.name], 'Filtered results must survive');
      await delay(350);
      equal(requests.length - start, 2, 'Opening/returning must not cause another request');
    }
    click(button('عرض الملف'));
    click(button('Test: leave profile'));
    await until(() => shell.dataset.origin === '', 'Actual App effect must clear origin after leaving profile');
    check(!button('العودة إلى سوق المهن'), 'Unrelated screen must not show market return');
    click(button('Test: own profile'));
    equal(shell.dataset.tab, 'profile', 'Fixture must revisit an unrelated profile');
    check(!button('العودة إلى سوق المهن'), 'Unrelated profile must not inherit stale marketplace back button');
    equal(requests.length - start, 2, 'Unrelated navigation must not request providers');
  });

  await test(13, async () => {
    await delay(100);
    equal(boundaryErrors, [], 'No unplanned Supabase operations');
    equal(audit.network, [], 'No external calls, resource loads or link activations');
    equal(audit.errors, [], 'No uncaught browser errors or unhandled rejections');
    equal(audit.console, expectedConsole.map(text => ({ level: 'error', text })),
      'Only the deliberately induced failure and timeout console errors are expected');
    equal(performance.getEntriesByType('resource').length, 0, 'Entire fixture must run without subresource requests');
  });
}

function report() {
  const payload = { userAgent: navigator.userAgent, results,
    requests: requests.length, console: audit.console, network: audit.network, errors: audit.errors };
  const encoded = 'BROWSER_REPORT:' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  document.getElementById('browser-results').textContent = encoded;
  console.log(encoded);
}
run().then(report, error => {
  results.push({ name: 'Fixture runner', status: 'FAIL', error: String(error) });
  report();
});
`.replace('__CASE_NAMES__', JSON.stringify(caseNames)).replace('__NAVIGATION_SHELL__', () => navigationShell);

async function launch(args, owned, fixtureUrl, screenshots) {
  // CDP talks only to this test's new isolated browser; the sole evaluation below
  // acknowledges capture to our fixture, never accessing a user's browser.
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, {
      windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, TMP: owned, TEMP: owned, TMPDIR: owned },
    });
    let stderr = '';
    let socket;
    let report;
    let failure;
    let nextId = 0;
    const pending = new Map();
    const terminate = () => {
      // Only terminate the process tree this test created, never other browsers.
      if (process.platform === 'win32' && child.pid) {
        try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
        catch { child.kill(); }
      } else child.kill('SIGKILL');
    };
    const fail = error => { failure = error; terminate(); };
    const timer = setTimeout(() => fail(new Error('90-second browser deadline exceeded')), 90000);
    function command(method, params = {}, sessionId) {
      return new Promise((done, failed) => {
        const id = ++nextId;
        pending.set(id, { done, failed });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
    function connect(url) {
      socket = new WebSocket(url);
      socket.addEventListener('error', event => {
        // Browser.close can reset its local debugging socket after the report.
        if (!report) fail(new Error('Local Chrome DevTools connection failed: ' +
          (event.message || event.error?.message || 'unknown WebSocket error')));
      });
      socket.addEventListener('message', event => {
        try {
          const message = JSON.parse(event.data);
          if (message.id) {
            const waiter = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) waiter?.failed(new Error(JSON.stringify(message.error)));
            else waiter?.done(message.result);
          } else if (message.method === 'Runtime.consoleAPICalled') {
            const value = message.params.args[0]?.value;
            if (value === 'NAV_CAPTURE:home' || value === 'NAV_CAPTURE:services') void (async () => {
              const { nodes } = await command('Accessibility.getFullAXTree', {}, message.sessionId);
              assert(nodes.some(n => !n.ignored && n.role?.value === 'button' && n.name?.value === 'العودة إلى سوق المهن'),
                'Actual back button must have the correct accessible name in Chrome AX tree');
              const { data } = await command('Page.captureScreenshot', { format: 'png' }, message.sessionId);
              const file = path.join(screenshots, value.slice('NAV_CAPTURE:'.length) + '-profile.png');
              await writeFile(file, Buffer.from(data, 'base64'));
              console.log('Navigation screenshot: ' + file);
              await command('Runtime.evaluate', { expression: "window.dispatchEvent(new Event('fixture-captured'))" }, message.sessionId);
            })().catch(fail);
            if (typeof value === 'string' && value.startsWith('BROWSER_REPORT:')) {
              report = JSON.parse(Buffer.from(value.slice('BROWSER_REPORT:'.length), 'base64').toString('utf8'));
              void command('Browser.close').catch(fail);
            }
          }
        } catch (error) { fail(error); }
      });
      socket.addEventListener('open', async () => {
        try {
          const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
          const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
          await command('Runtime.enable', {}, sessionId);
          await command('Page.enable', {}, sessionId);
          await command('Page.bringToFront', {}, sessionId);
          await command('Page.navigate', { url: fixtureUrl }, sessionId);
        } catch (error) { fail(error); }
      });
    }
    child.stderr.on('data', data => {
      stderr = (stderr + data.toString()).slice(-12000);
      const endpoint = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/);
      if (!socket && endpoint) connect(endpoint[1]);
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      socket?.close();
      if (failure || code !== 0 || !report) {
        reject(new Error('Chromium run incomplete; NOT fully browser-verified: ' +
          (failure?.message || 'exit ' + code + ', report=' + Boolean(report)) + '\n' + stderr));
      } else resolve(report);
    });
  });
}

let owned;
let proxy;
const proxySockets = new Set();
let blockedProxyRequests = 0;
try {
  await access(chrome);
  // Verify parents with ls before creating the owned directory and its contents.
  execFileSync('ls', ['-ld', tmpdir()], { stdio: 'ignore' });
  owned = await mkdtemp(path.join(tmpdir(), 'prolink-browser-reliability-'));
  execFileSync('ls', ['-ld', owned], { stdio: 'ignore' });
  const screenshots = await mkdtemp(path.join(tmpdir(), 'prolink-navigation-screenshots-'));
  execFileSync('ls', ['-ld', screenshots], { stdio: 'ignore' });

  const bundle = await build({
    stdin: { contents: fixture, sourcefile: 'browser-reliability-fixture.tsx', resolveDir: root, loader: 'tsx' },
    absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife',
    target: 'chrome120', jsx: 'automatic', metafile: true, logLevel: 'silent',
    define: { 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"test"}', 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'supabase-network-boundary-only', setup(builder) {
      builder.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'supabase', namespace: 'fixture-boundary' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture-boundary' }, () => ({ contents:
        'export const supabase = new Proxy({}, { get: (_, key) => { ' +
        'if (key !== "from") throw new Error("Unexpected Supabase boundary: " + String(key)); ' +
        'return (...args) => window.__database.from(...args); } });' }));
    } }],
  });
  const inputs = Object.keys(bundle.metafile.inputs).map(file => file.replaceAll('\\', '/'));
  for (const suffix of ['src/lib/utils/bilingualText.tsx', 'src/components/ui/ContactMenu.tsx',
    'src/lib/services/newsService.ts', 'src/components/features/services/ServicesView.tsx',
    'src/lib/utils/withTimeout.ts', 'src/lib/services/mockDataService.ts',
    'node_modules/react/index.js', 'node_modules/react-dom/client.js']) {
    assert(inputs.some(file => file.endsWith(suffix)), 'Real module must be bundled: ' + suffix);
  }
  assert(!inputs.some(file => /src\/lib\/supabase\./.test(file)), 'Live Supabase initialization must never be bundled');
  const escapeScript = text => text.replace(/<\/script/gi, '<\\/script');
  const html = '<!doctype html><html lang="ar"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; ' +
    'style-src \'unsafe-inline\'; connect-src \'none\'; img-src \'none\'; font-src \'none\'; ' +
    'frame-src \'none\'; worker-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">' +
    '<title>Prolink isolated browser reliability fixture</title>' +
    '<style>body{font-family:Arial,sans-serif;margin:24px}button,input,a{min-height:24px}section{max-width:900px}' +
    '.navigation-fixture .hidden{display:none!important}.navigation-fixture .min-h-11{min-height:2.75rem}' +
    '.navigation-fixture{background:#f3f2ef;padding:24px}.navigation-fixture nav{padding:16px 0}' +
    '.navigation-fixture article{background:white;padding:24px;margin:16px 0}</style>' +
    '</head><body><main id="fixture"></main><pre id="browser-results">RUNNING</pre>' +
    '<script>' + escapeScript(guard) + '</script><script>' + escapeScript(bundle.outputFiles[0].text) + '</script></body></html>';
  const htmlPath = path.join(owned, 'fixture.html');
  await writeFile(htmlPath, html);

  // Deny HTTP and HTTPS CONNECT without DNS lookup or upstream forwarding.
  // Even Chromium's own background requests cannot reach an external server.
  proxy = createServer((_request, response) => {
    blockedProxyRequests++;
    response.writeHead(403, { Connection: 'close' });
    response.end();
  });
  proxy.on('connect', (_request, socket) => {
    blockedProxyRequests++;
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  proxy.on('connection', socket => {
    proxySockets.add(socket);
    // Chrome may reset a deliberately rejected background proxy connection.
    socket.on('error', () => socket.destroy());
    socket.on('close', () => proxySockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', resolve);
  });
  const report = await launch([
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability',
    '--disable-sync', '--disable-extensions', '--disable-breakpad', '--disable-quic',
    '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--proxy-server=http://127.0.0.1:' + proxy.address().port, '--proxy-bypass-list=<-loopback>',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--user-data-dir=' + path.join(owned, 'profile'), '--window-size=1280,1000',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', 'about:blank',
  ], owned, pathToFileURL(htmlPath).href, screenshots);
  console.log('Browser: ' + report.userAgent);
  for (const result of report.results) {
    console.log(result.status + ' ' + result.name + (result.ms === undefined ? '' : ' (' + result.ms + ' browser ms)'));
    if (result.error) console.error(result.error + '\nDOM: ' + result.dom);
  }
  const failed = report.results.filter(result => result.status !== 'PASS');
  console.log(report.results.length - failed.length + '/' + caseNames.length + ' passed; ' +
    report.requests + ' mocked Supabase requests; ' + report.network.length + ' fixture network attempts; ' +
    blockedProxyRequests + ' browser-background proxy requests blocked.');
  assert.deepEqual(report.results.map(result => result.name), caseNames, 'Every required browser case must finish');
  assert.equal(failed.length, 0, 'Browser regressions failed');
} catch (error) {
  console.error(error.stack || String(error));
  process.exitCode = 1;
} finally {
  for (const socket of proxySockets) socket.destroy();
  if (proxy?.listening) await new Promise(resolve => proxy.close(resolve));
  if (owned) {
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    console.log('Cleaned the test-owned temporary fixture and isolated Chrome profile.');
  }
}
