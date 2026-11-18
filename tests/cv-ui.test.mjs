import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const viewerSource = read('src/components/features/cv/CvViewerModal.tsx');

function prepareBoundary() {
  const file = ts.createSourceFile('viewer.tsx', viewerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  const visit = node => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === 'prepare')) declaration = node.getText(file);
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(declaration);
  let resolve;
  let reject;
  let blob = null;
  let error = '';
  let busy = false;
  const generation = { current: 0 };
  const prepare = vm.runInNewContext(`${declaration}\nprepare;`, {
    generation, data: {}, avatarUrl: undefined, Error,
    exportCvPdf: () => new Promise((yes, no) => { resolve = yes; reject = no; }),
    setBlob: value => { blob = value; },
    setError: value => { error = value; },
    setBusy: value => { busy = value; },
  });
  return { prepare, invalidate: () => { generation.current++; blob = null; busy = false; }, resolve: value => resolve(value), reject: value => reject(value), state: () => ({ blob, error, busy }) };
}

test('viewer cannot install an old PDF after data or privacy settings change', async () => {
  const boundary = prepareBoundary();
  const pending = boundary.prepare();
  boundary.invalidate();
  boundary.resolve({ name: 'old PDF' });
  await pending;
  assert.equal(boundary.state().blob, null);
  assert.equal(boundary.state().busy, false);
});

test('viewer ignores export failures after its generation is invalidated', async () => {
  const boundary = prepareBoundary();
  const pending = boundary.prepare();
  boundary.invalidate();
  boundary.reject(new Error('old export failed'));
  await pending;
  assert.equal(boundary.state().error, '');
});

test('CV editor is layered above its job application parent and uses the canonical branded preview', () => {
  const builder = read('src/components/features/cv/CvBuilderView.tsx');
  const application = read('src/components/features/ApplyJobModal.tsx');
  const editorZ = Number(builder.match(/className="fixed inset-0 z-\[(\d+)\]/)?.[1]);
  const applicationZ = Number(application.match(/className="fixed inset-0[^"\n]*z-\[(\d+)\]/)?.[1]);
  assert.ok(editorZ > applicationZ, `editor ${editorZ} must be above application ${applicationZ}`);
  assert.match(builder, /import \{ CvPreview \} from '\.\/CvPreview'/);
  assert.doesNotMatch(builder, /function CvPreview\(/);
});

test('CV setup is a single page without a wizard and retains all editable sections', () => {
  const builder = read('src/components/features/cv/CvBuilderView.tsx');
  assert.doesNotMatch(builder, /const steps\s*=|setStep\(|step ===|الخطوة السابقة/);
  for (const name of ['CvPersonalFields', 'CvSummaryField', 'CvExperienceFields', 'CvEducationFields', 'CvSkillsLanguageFields', 'CvCertificationLinkFields', 'CvPreviewSettings']) {
    assert.match(builder, new RegExp(`<${name}\\b`), name);
  }
  assert.match(builder, /إعداد السيرة الذاتية/);
});

test('a profile card cannot keep an editor mounted for another user', () => {
  const card = read('src/components/features/cv/CvProfileCard.tsx');
  assert.match(card, /props\.isMe && editing &&/);
  assert.match(card, /setEditing\(false\);\s*setViewing\(false\);/);
});

const validationBundle = await build({
  stdin: { contents: "export * from './src/lib/cv/cvData'; export { isContactPhone, normalizePhoneDigits } from './src/lib/utils/contact';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
});
const validationDependencies = await import(`data:text/javascript;base64,${Buffer.from(validationBundle.outputFiles[0].text).toString('base64')}`);
const builderFile = ts.createSourceFile('builder.tsx', read('src/components/features/cv/CvBuilderView.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const validationDeclaration = builderFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'validateFields');
assert.ok(validationDeclaration);
const validationJs = ts.transpileModule(validationDeclaration.getText(builderFile), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const validateFields = vm.runInNewContext(`${validationJs}\nvalidateFields;`, validationDependencies);

for (const [name, skills] of [
  ['too many skills', Array.from({ length: 31 }, (_, i) => `Skill ${i}`)],
  ['an oversized individual skill', ['x'.repeat(41)]],
]) {
  test(`skills textarea rejects ${name} before normalization can discard data`, () => {
    const data = { ...validationDependencies.normalizeCvData({}), skills };
    assert.ok(validateFields(data).skills);
    assert.deepEqual(data.skills, skills);
  });
}

test('skills textarea accepts boundary lengths and ignores empty lines', () => {
  const skills = ['', ...Array.from({ length: 30 }, (_, i) => String(i).padEnd(40, 'x')), '  '];
  assert.equal(validateFields({ ...validationDependencies.normalizeCvData({}), skills }).skills, undefined);
});

test('Tab from the preview section continues within the preview instead of jumping to Back', () => {
  let declaration;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(builderFile) === 'keydown') declaration = node.getText(builderFile);
    ts.forEachChild(node, visit);
  };
  visit(builderFile);
  assert.ok(declaration);
  const document = { activeElement: {} };
  const elements = Array.from({ length: 3 }, () => ({ getClientRects: () => [{}], closest: () => null, focus() { document.activeElement = this; } }));
  const dialog = { current: { querySelectorAll: () => elements, contains: () => true } };
  const js = ts.transpileModule(`const ${declaration}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const keydown = vm.runInNewContext(`${js}\nkeydown;`, { document, dialog });
  let prevented = false;
  keydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

function viewerKeyboardBoundary() {
  const file = ts.createSourceFile('viewer.tsx', viewerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  const visit = node => {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === 'key')) declaration = node.getText(file);
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(declaration);
  const document = { activeElement: null };
  const elements = Array.from({ length: 3 }, () => ({ offsetParent: {}, focus() { document.activeElement = this; } }));
  const dialog = { current: { querySelectorAll: () => elements, contains: element => elements.includes(element) } };
  let closed = false;
  const javascript = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const key = vm.runInNewContext(`${javascript}\nkey;`, { document, dialog, onClose: () => { closed = true; } });
  return { document, elements, key, closed: () => closed };
}

for (const shiftKey of [false, true]) {
  test(`viewer traps ${shiftKey ? 'reverse' : 'forward'} Tab navigation at dialog boundaries`, () => {
    const boundary = viewerKeyboardBoundary();
    boundary.document.activeElement = boundary.elements[shiftKey ? 0 : 2];
    let prevented = false;
    boundary.key({ key: 'Tab', shiftKey, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(boundary.document.activeElement, boundary.elements[shiftKey ? 2 : 0]);
  });
}

test('viewer Escape closes only its own overlay', () => {
  const boundary = viewerKeyboardBoundary();
  let stopped = false;
  boundary.key({ key: 'Escape', preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.equal(boundary.closed(), true);
  assert.equal(stopped, true);
});

test('a malformed optional profile photo cannot prevent CV export assets loading', async () => {
  const source = read('src/lib/cv/cvExport.tsx');
  const file = ts.createSourceFile('export.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'cvExportAssets');
  assert.ok(declaration);
  const javascript = ts.transpileModule(declaration.getText(file).replace(/^export /, '').replace(/import\.meta\.env\.BASE_URL/g, "'/professional-jobs-app-prolink/'"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const assets = vm.runInNewContext(`${javascript}\ncvExportAssets;`, {
    URL, location: { href: 'http://127.0.0.1:3000/', origin: 'http://127.0.0.1:3000' },
    embedImage: async () => 'embedded-logo',
  });
  const result = await assets('https://[');
  assert.equal(result.logoSrc, 'embedded-logo');
  assert.equal(result.avatarSrc, undefined);
});
