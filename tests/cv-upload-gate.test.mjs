import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Mock database/browser boundaries only; never connect to Supabase.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const settingsPath = 'src/lib/services/platformSettingsService.ts';
const coursePath = 'src/components/features/missions/ApplyCourseModal.tsx';
const ok = data => ({ data, error: null });
function settingsBoundary(responses = [], cached) {
  const calls = [];
  const events = [];
  const cache = new Map(cached ? [['prolink_platform_public_settings', JSON.stringify(cached)]] : []);
  const finish = call => {
    calls.push(call);
    assert.ok(responses.length, `Unexpected ${call.operation}`);
    return Promise.resolve(responses.shift());
  };
  const supabase = {
    rpc: name => finish({ operation: 'rpc', name }),
    from(table) {
      const call = { table, operation: 'select' };
      return {
        select(fields) { call.fields = fields; return this; },
        in(field, keys) { call.filter = [field, Array.from(keys)]; return this; },
        eq(field, value) { call.filter = [field, value]; return this; },
        upsert(rows, options) { call.operation = 'upsert'; call.rows = JSON.parse(JSON.stringify(rows)); call.options = options; return this; },
        maybeSingle() { return finish(call); },
        then(resolve, reject) { return finish(call).then(resolve, reject); },
      };
    },
  };
  const source = read(settingsPath).replace(/^import .*;\r?\n/gm, '').replace(/\bexport (?=const |interface )/g, '');
  const { service, defaults } = vm.runInNewContext(`${stripTypeScriptTypes(source)}\n({ service: platformSettingsService, defaults: DEFAULT_PUBLIC_SETTINGS });`, {
    supabase,
    localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) },
    window: { dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  });
  return { service, defaults, calls, events, cache };
}

test('CV upload is a boolean contract, closed by default and in older caches', () => {
  assert.match(read(settingsPath), /cvUploadEnabled: boolean;/);
  const boundary = settingsBoundary([], { accountSwitchEnabled: true });
  assert.equal(boundary.defaults.cvUploadEnabled, false);
  assert.equal(boundary.service.getCached().cvUploadEnabled, false);
});

for (const [value, enabled] of [['true', true], [' true ', true], ['false', false], ['TRUE', false], ['', false], [null, false]]) {
  test(`settings fetch parses cv_upload_enabled=${JSON.stringify(value)} strictly`, async () => {
    const boundary = settingsBoundary([ok([{ key: 'cv_upload_enabled', value }])]);
    assert.equal((await boundary.service.fetch()).cvUploadEnabled, enabled);
    assert.ok(boundary.calls[0].filter[1].includes('cv_upload_enabled'));
    assert.equal(JSON.parse(boundary.cache.get('prolink_platform_public_settings')).cvUploadEnabled, enabled);
  });
}

test('missing server CV key replaces a stale open cache with the closed default', async () => {
  const boundary = settingsBoundary([ok([])], { cvUploadEnabled: true });
  assert.equal((await boundary.service.fetch()).cvUploadEnabled, false);
});

for (const enabled of [false, true]) {
  test(`settings save serializes CV gate ${enabled} and publishes the saved value`, async () => {
    const boundary = settingsBoundary([ok(null)]);
    assert.equal((await boundary.service.save({ cvUploadEnabled: enabled })).success, true);
    const row = boundary.calls[0].rows[0];
    assert.equal(row.key, 'cv_upload_enabled');
    assert.equal(row.value, String(enabled));
    assert.ok(Number.isFinite(Date.parse(row.updated_at)));
    assert.equal(boundary.calls[0].options.onConflict, 'key');
    assert.equal(boundary.events[0].type, 'prolink_platform_settings_changed');
    assert.equal(boundary.events[0].detail.cvUploadEnabled, enabled);
    assert.equal(JSON.parse(boundary.cache.get('prolink_platform_public_settings')).cvUploadEnabled, enabled);
  });
}

test('failed save cannot update cached gate or emit a settings event', async () => {
  const boundary = settingsBoundary([{ error: { message: 'Denied' } }], { cvUploadEnabled: false });
  assert.equal((await boundary.service.save({ cvUploadEnabled: true })).success, false);
  assert.equal(boundary.service.getCached().cvUploadEnabled, false);
  assert.equal(boundary.events.length, 0);
});

for (const [response, applied] of [[ok({ key: 'cv_upload_enabled' }), true], [ok(null), false], [{ error: { message: 'Denied' } }, false]]) {
  test(`migration detection requires a readable CV key (${applied})`, async () => {
    const boundary = settingsBoundary([ok(false), response]);
    assert.equal(await boundary.service.isGateMigrationApplied(), applied);
    assert.deepEqual(boundary.calls[1].filter, ['key', 'cv_upload_enabled']);
  });
}

test('migration detection still requires the existing server gate RPC', async () => {
  const boundary = settingsBoundary([{ error: { message: 'Missing function' } }]);
  assert.equal(await boundary.service.isGateMigrationApplied(), false);
});

for (const [admin, enabled, allowed] of [[false, false, false], [false, true, true], [true, false, true], [true, true, true]]) {
  test(`context CV gate: admin=${admin}, platform=${enabled} => ${allowed}`, () => {
    const source = read('src/contexts/AppContext.tsx');
    assert.match(source, /canUseCvUpload: boolean;/);
    const expression = source.match(/const canUseCvUpload = ([^;]+);/)?.[1];
    assert.ok(expression, 'Context must compute and export the CV upload gate');
    assert.equal(vm.runInNewContext(expression, { isAdminUser: admin, platformSettings: { cvUploadEnabled: enabled } }), allowed);
    assert.match(source, /platformSettings, canUseMessaging[^\n]*canUseCvUpload/);
  });
}

test('CV service exposes the shared 25 MB limit consumed by the course picker', () => {
  const source = read('src/lib/services/cvService.ts')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\bexport (?=const |interface )/g, '');
  const service = vm.runInNewContext(`${stripTypeScriptTypes(source)}\ncvService;`, {});
  assert.equal(service.MAX_CV_SIZE_BYTES, 25 * 1024 * 1024,
    'cvService must expose MAX_CV_SIZE_BYTES; its private constant cannot be consumed by UI callers');
});

// No installed component UI runner: inspect TSX containment and execute handlers
// with mocked service boundaries instead of rendering or using a live account.
function courseNodes() {
  const source = read(coursePath);
  const tree = ts.createSourceFile(coursePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fileInputs = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'input' &&
      node.attributes.properties.some(attr => attr.name?.getText(tree) === 'type' && attr.initializer?.text === 'file')) fileInputs.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { tree, fileInputs };
}

test('course file picker is inside the context gate and uses the shared size limit', () => {
  assert.match(read(coursePath), /const \{ canUseCvUpload \} = useAppContext\(\)/);
  const { tree, fileInputs } = courseNodes();
  assert.equal(fileInputs.length, 1);
  let parent = fileInputs[0].parent;
  while (parent && !(ts.isBinaryExpression(parent) && parent.left.getText(tree) === 'canUseCvUpload' && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) parent = parent.parent;
  assert.ok(parent, 'The file input must be hidden when the gate is closed');
  const onChange = fileInputs[0].attributes.properties.find(attr => attr.name?.getText(tree) === 'onChange').initializer.expression.getText(tree);
  assert.match(onChange, /canUseCvUpload/);
  assert.match(onChange, /cvService\.MAX_CV_SIZE_BYTES/);
});

function submitCourse({ gate, file = null, existing = 'https://example.test/previous.pdf' }) {
  const calls = { uploads: [], applications: [], cleared: false, toasts: [] };
  const source = read(coursePath).match(/  const handleSubmit = async[\s\S]+?\n  };/)[0];
  const submit = vm.runInNewContext(`${stripTypeScriptTypes(source)}\nhandleSubmit;`, {
    appUser: { id: 'user-1', cvUrl: existing }, course: { id: 'course-1', provider_id: 'provider-1' },
    canUseCvUpload: gate, cvFileObj: file, motivation: '', experience: '', education: '',
    cvService: { MAX_CV_SIZE_BYTES: 25 * 1024 * 1024, uploadCV: async (...args) => { calls.uploads.push(args); return { data: 'https://example.test/new.pdf', error: null }; } },
    courseService: { applyToCourse: async (...args) => { calls.applications.push(args); return ok({}); } },
    setCvFileObj: value => { calls.cleared = value === null; },
    setIsApplying() {}, setApplySuccess() {}, onSuccess() {}, onClose() {},
    setTimeout() {}, clearTimeout() {}, console: { warn() {} },
    addToast: (...args) => calls.toasts.push(args),
  });
  return { calls, submit };
}

test('closed gate rejects and clears a stale selected file before any upload/submission', async () => {
  const { calls, submit } = submitCourse({ gate: false, file: { size: 10, name: 'cv.pdf' } });
  await submit();
  assert.equal(calls.uploads.length, 0);
  assert.equal(calls.applications.length, 0);
  assert.equal(calls.cleared, true);
  assert.ok(calls.toasts.length);
});

test('closed gate still attaches the existing CV URL without uploading a file', async () => {
  const { calls, submit } = submitCourse({ gate: false });
  await submit();
  assert.equal(calls.uploads.length, 0);
  assert.equal(calls.applications[0][3].cvUrl, 'https://example.test/previous.pdf');
});

for (const [size, allowed] of [[25 * 1024 * 1024, true], [25 * 1024 * 1024 + 1, false]]) {
  test(`course submission enforces shared 25 MB limit at ${size} bytes`, async () => {
    const { calls, submit } = submitCourse({ gate: true, file: { size, name: 'cv.pdf' } });
    await submit();
    assert.equal(calls.uploads.length, allowed ? 1 : 0);
    assert.equal(calls.applications.length, allowed ? 1 : 0);
    if (allowed) assert.equal(calls.applications[0][3].cvUrl, 'https://example.test/new.pdf');
  });
}

test('admin CV toggle loads/saves the gate and explains unaffected CV capabilities', () => {
  const source = read('src/components/features/AdminDashboard.tsx');
  assert.match(source, /\[cvUploadOpen, setCvUploadOpen\] = useState\(false\)/);
  assert.match(source, /setCvUploadOpen\(platformSettings\.cvUploadEnabled\)/);
  assert.match(source, /cvUploadEnabled: cvUploadOpen/);
  assert.ok(source.includes('فتح رفع ملف السيرة الذاتية'));
  assert.match(source, /إنشاء السيرة الذاتية وعرضها وتصديرها متاح دائماً/);
});
