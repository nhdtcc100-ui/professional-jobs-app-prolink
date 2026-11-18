import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

function appNavigationNodes() {
  const source = readFileSync('src/App.tsx', 'utf8');
  const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const services = [];
  let backButton;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'ServicesView') services.push(node);
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'button' &&
      node.children.some(child => child.getText(tree).includes('العودة إلى سوق المهن'))) backButton = node;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { tree, services, backButton };
}

for (const origin of ['home', 'services']) {
  test(`marketplace profile has a back button returning to ${origin}`, () => {
    const { tree, services, backButton } = appNavigationNodes();
    assert.ok(backButton, 'Profile must render a visible marketplace back button');
    assert.equal(services.length, 2);
    const state = { activeTab: origin, selectedProfile: null, returnToServicesTab: null };
    const scope = {
      activeTab: origin,
      setReturnToServicesTab: value => { state.returnToServicesTab = value; },
      setSelectedProfile: value => { state.selectedProfile = value; },
      setActiveTab: value => { state.activeTab = value; },
      setReturnToJob: () => {}, setReturnToDetailFeed: () => {},
    };
    const open = services[origin === 'home' ? 0 : 1].attributes.properties
      .find(attr => attr.name?.getText(tree) === 'onUserClick').initializer.expression.getText(tree);
    vm.runInNewContext(`(${open})`, scope)({ id: 'market-provider' });
    assert.equal(state.activeTab, 'profile');
    assert.equal(state.selectedProfile.id, 'market-provider');
    assert.equal(state.returnToServicesTab, origin);
    const onClick = backButton.openingElement.attributes.properties
      .find(attr => attr.name?.getText(tree) === 'onClick').initializer.expression.getText(tree);
    vm.runInNewContext(`(${onClick})`, { ...scope, returnToServicesTab: state.returnToServicesTab })();
    assert.equal(state.activeTab, origin);
    assert.equal(state.selectedProfile, null);
    assert.equal(state.returnToServicesTab, null);
  });
}


function handler(path, name, scope) {
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf('\n  };', start) + 5;
  assert.ok(start >= 0 && end > start, `handler ${name} exists`);
  return vm.runInNewContext(`${stripTypeScriptTypes(source.slice(start, end))}\n; ${name}`, scope);
}

async function loadModule(path) {
  const result = await build({
    entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'import.meta.env': '{"PROD":false,"DEV":false,"MODE":"test"}' },
    plugins: [{ name: 'test-boundaries', setup(builder) {
      builder.onResolve({ filter: /\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
        export const SUPABASE_URL = 'https://storage.example.test';
        export const SUPABASE_ANON_KEY = 'public-test-key';
        export const AUTH_STORAGE_KEY = 'test-session';
        export const LEGACY_AUTH_STORAGE_KEY = 'test-legacy-session';
        export const supabase = new Proxy({}, { get: (_, key) => globalThis.testDatabase?.[key] });
      ` }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const textModule = await loadModule('src/lib/utils/bilingualText.tsx');
const contacts = await loadModule('src/lib/utils/contact.ts');

for (const text of ['الخبرة < 5 سنوات\nبقية التفاصيل والنهاية', 'Software Engineer خبرة < 4 سنوات ونص أخير', '١٢٣ < ٩٩٩ و 500 > 100']) {
  test(`full detail preserves comparison signs and trailing text: ${text}`, () => {
    const output = textModule.splitBilingualText(text).map(s => s.text).join('');
    assert.equal(output.replace(/\s/g, ''), text.replace(/\s/g, ''));
  });
}

test('phone normalization supports Arabic digits and international prefixes', () => {
  assert.equal(contacts.normalizeIraqiPhone('٠٧٧٠ ١٢٣ ٤٥٦٧'), '9647701234567');
  assert.equal(contacts.normalizeIraqiPhone('۰۰۴۴ ۷۷۰۰ ۹۰۰۱۲۳'), '447700900123');
  assert.equal(contacts.normalizeIraqiPhone('+44 7700 900123'), '447700900123');
});

test('phone links open the contact menu while salaries and dates stay plain', () => {
  const line = textModule.SmartLineRenderer({ text: 'اتصل ٠٧٧٠ ١٢٣ ٤٥٦٧ أو +44 7700 900123 الراتب 500000 التاريخ 2026-11-17', isArabic: true });
  const buttons = line.props.children.filter(node => node?.type === 'button');
  assert.equal(buttons.length, 2);
  let event;
  let stopped = false;
  globalThis.window = { dispatchEvent: value => { event = value; } };
  buttons[0].props.onClick({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(event.type, 'prolink:contact-menu');
  assert.equal(event.detail.phone, '٠٧٧٠ ١٢٣ ٤٥٦٧');
  delete globalThis.window;
});

const { newsService } = await loadModule('src/lib/services/newsService.ts');
test('feed cleaning preserves literal comparisons and removes closed HTML tags', () => {
  assert.equal(newsService.cleanText('<p>الخبرة < 5 سنوات</p><p>النهاية</p>'), 'الخبرة < 5 سنوات \n\nالنهاية');
});

test('sharing an article as a post preserves content following comparison signs', async () => {
  let stored;
  const share = handler('src/components/features/NewsDetailModal.tsx', 'handleShareAsPost', {
    appUser: { id: 'user-1', name: 'مستخدم' }, canUserPostAndInteract: () => true,
    showPostEditor: true, postComment: '', item: { content: 'الخبرة < 5 سنوات\nالنهاية', title: 'وظيفة' },
    newsService, setShowPostEditor() {}, setIsPosting() {}, setPostSuccess() {}, setTimeout() {}, console,
    supabase: { from: () => ({ insert: async rows => { stored = rows[0]; return { error: null }; } }) },
  });
  await share();
  assert.ok(stored.content.includes('الخبرة < 5 سنوات\nالنهاية'));
});

const { jobService } = await loadModule('src/lib/services/jobService.ts');
test('job edits preserve descriptions beyond 5000 characters', async () => {
  let stored;
  globalThis.testDatabase = { from: () => ({ update: data => {
    stored = data;
    const query = { eq: () => query, then: resolve => resolve({ data: [data], error: null }) };
    return query;
  } }) };
  const description = 'تفاصيل '.repeat(1000) + 'النهاية';
  const result = await jobService.updateJob('job-1', 'employer-1', { description });
  assert.equal(result.error, null);
  assert.equal(stored.description, description);
});
test('oversize job descriptions reject instead of silently truncating', async () => {
  globalThis.testDatabase = { from: () => { throw new Error('must not write'); } };
  for (const operation of [() => jobService.updateJob('job-1', 'employer-1', { description: 'x'.repeat(8001) }), () => jobService.postJob({ description: 'x'.repeat(8001) })]) {
    const result = await operation();
    assert.match(result.error?.message || '', /8000/);
  }
});

const { sanitizeInput } = await loadModule('src/lib/security/inputValidator.ts');
test('post editing preserves more than 500 characters and rejects oversized text', async () => {
  for (const content of ['تفاصيل '.repeat(1000) + 'النهاية', 'x'.repeat(20001)]) {
    let stored;
    const post = { id: 'post-1', authorId: 'user-1', content: 'قبل التعديل' };
    const query = { eq: () => query, then: resolve => resolve({ error: null }) };
    const save = handler('src/components/features/PostTransmissionCard.tsx', 'handleUpdatePost', {
      editContent: content, post, user: { id: 'user-1' }, appUser: {}, sanitizeInput,
      setIsEditing() {}, setIsSaving() {}, addToast() {},
      supabase: { from: () => ({ update: value => { stored = value; return query; } }) },
    });
    await save();
    assert.equal(stored?.content, content.length > 20000 ? undefined : content);
    assert.equal(post.content, content.length > 20000 ? 'قبل التعديل' : content);
  }
});

const { postService } = await loadModule('src/lib/services/postService.ts');
test('post creation preserves the form limit and rejects excess instead of truncating', async () => {
  let stored;
  globalThis.testDatabase = { from: () => ({ insert: rows => {
    stored = rows[0];
    return Promise.resolve({ data: rows, error: null });
  } }) };
  const content = 'تفاصيل '.repeat(1800) + 'النهاية';
  const result = await postService.createPost({ content });
  assert.equal(result.error, null);
  assert.equal(stored.content, content);
  const excess = await postService.createPost({ content: 'x'.repeat(20001) });
  assert.match(excess.error?.message || '', /20000/);
  assert.equal(stored.content, content);
});

const profilePath = 'src/components/features/profile/ModernProfileView.tsx';
test('profile handlers exclude duplicate fields but let cover and CV finish during stalled avatar', async () => {
  let rejectAvatar;
  const stalled = new Promise((_, reject) => { rejectAvatar = reject; });
  const calls = [];
  const saved = {};
  const uploadBusyRef = { current: { avatar: false, cover: false, cv: false } };
  const scope = {
    effectiveUserId: 'user-1', isMe: true, canUseCvUpload: true, uploadBusyRef, console: { error() {} },
    handleMobileDirectUpload: (_file, kind) => { calls.push(kind); return kind === 'avatar' ? stalled : Promise.resolve(`${kind}-saved`); },
    updateProfileDbFieldDirect: async (_id, kind, value) => { saved[kind] = value; },
    setIsUploadingAvatar() {}, setIsUploadingCover() {}, setAvatar() {}, setCoverUrl() {},
    setAppUser() {}, addToast() {}, setSavingCV() {}, setCvUploadProgress() {}, setPendingCVName() {},
    setPendingCVFile() {}, setCvUrl() {}, setTimeout() {},
  };
  const image = handler(profilePath, 'handleImageUpload', scope);
  const cv = handler(profilePath, 'handleCVFileSelect', scope);
  const event = () => ({ target: { files: [new File(['file'], 'test.pdf')], value: 'selected' } });
  const firstEvent = event();
  const first = image(firstEvent, 'avatar');
  await image(event(), 'avatar');
  await image(event(), 'cover');
  await cv(event());
  assert.deepEqual(calls, ['avatar', 'cover', 'cv']);
  assert.deepEqual(saved, { cover: 'cover-saved', cv: 'cv-saved' });
  rejectAvatar(new Error('upload timeout'));
  await first;
  assert.equal(firstEvent.target.value, '');
  assert.deepEqual(uploadBusyRef.current, { avatar: false, cover: false, cv: false });
  await image(event(), 'cover');
  assert.equal(calls.length, 4);
});

test('failed CV persistence keeps the previous saved URL and pending selection', async () => {
  const state = { url: 'old-cv', pending: new File(['%PDF-1.4'], 'cv.pdf') };
  const save = handler(profilePath, 'handleSaveCV', {
    effectiveUserId: 'user-1', isMe: true, canUseCvUpload: true, pendingCVFile: state.pending, cvUrl: state.url,
    uploadBusyRef: { current: { cv: false } }, cvInputRef: { current: { value: 'selected' } },
    handleMobileDirectUpload: async () => 'new-cv',
    updateProfileDbFieldDirect: async () => { throw new Error('denied'); },
    setCvUrl: value => { state.url = value; }, setPendingCVFile: value => { state.pending = value; },
    setPendingCVName() {}, setSavingCV() {}, setCvUploadProgress() {}, addToast() {}, setAppUser() {},
    console: { error() {} }, setTimeout() {},
  });
  await save();
  assert.equal(state.url, 'old-cv');
  assert.equal(state.pending?.name, 'cv.pdf');
});

const uploads = await loadModule('src/lib/services/directUpload.ts');
const options = { bucket: 'profiles', path: 'test-user/avatar.jpg', contentType: 'image/jpeg', timeoutMs: 30 };

test('a stalled device read aborts and does not block the next file', async () => {
  globalThis.FileReader = class {
    readAsArrayBuffer(file) {
      if (file.name === 'stalled.jpg') return;
      file.arrayBuffer().then(result => { this.result = result; this.onload(); });
    }
    abort() { this.onabort(); }
  };
  await assert.rejects(uploads.readUploadFile(new File(['image'], 'stalled.jpg'), 15), /مهلة/);
  const file = await uploads.readUploadFile(new File(['cover'], 'cover.jpg'), 15);
  assert.equal(await file.text(), 'cover');
});

const { cvService } = await loadModule('src/lib/services/cvService.ts');
test('CV upload validates contents and uses authenticated resumes storage', async () => {
  globalThis.FileReader = class {
    readAsArrayBuffer(file) {
      file.arrayBuffer().then(result => { this.result = result; this.onload(); });
    }
    abort() { this.onabort(); }
  };
  globalThis.localStorage = session();
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, init }); return new Response('{}'); };
  for (const [name, body] of [['wrong.pdf', '<html>not a CV</html>'], ['archive.docx', 'PK\x03\x04not a Word archive']]) {
    const result = await cvService.uploadCV('user-1', new File([body], name));
    assert.equal(result.data, null);
    assert.match(result.error?.message || '', /محتوى الملف/);
  }
  assert.equal(requests.length, 0);
  const result = await cvService.uploadCV('user-1', new File(['%PDF-1.4\n%%EOF'], 'resume.PDF', { type: '' }));
  assert.equal(result.error, null);
  assert.match(requests[0].url, /\/storage\/v1\/object\/resumes\/user-1\/cv-.*\.pdf$/);
  assert.equal(requests[0].init.headers.Authorization, 'Bearer test-user-token');
  assert.equal(requests[0].init.headers['Content-Type'], 'application/pdf');
});

const { mobileUploadService } = await loadModule('src/lib/services/mobileUploadService.ts');
test('mobile files accept extension fallback, reject unsupported images, and keep video bytes', async () => {
  globalThis.localStorage = session();
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, init }); return new Response('{}'); };
  for (const [name, type, category, expectedMime, contents] of [
    ['photo.JPG', '', 'avatar', 'image/jpeg', 'image bytes'],
    ['clip.mov', 'video/quicktime', 'post-video', 'video/quicktime', 'video bytes'],
  ]) {
    const { preview, uploadPromise } = await mobileUploadService.uploadFile(new File([contents], name, { type }), category, 'user-1');
    try { await uploadPromise; } finally { if (preview) URL.revokeObjectURL(preview); }
    const { init } = requests.at(-1);
    assert.equal(init.headers['Content-Type'], expectedMime);
    assert.equal(await init.body.text(), contents);
  }
  await assert.rejects(mobileUploadService.uploadFile(new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }), 'cover', 'user-1'));
  assert.equal(requests.length, 2);
});

const { prefetchServices } = await loadModule('src/components/features/services/ServicesView.tsx');
test('marketplace prefetch reuses fresh rows and isolates viewers', async () => {
  let requests = 0;
  globalThis.testDatabase = { from: () => {
    requests++;
    const query = new Proxy({}, { get: (_, key) => key === 'then'
      ? resolve => resolve({ data: [{ id: 'provider-1', name: 'اختبار', role: 'freelancer' }], error: null, count: 1 })
      : () => query });
    return query;
  } };
  await prefetchServices('viewer-1', new AbortController().signal);
  await prefetchServices('viewer-1', new AbortController().signal);
  assert.equal(requests, 1);
  await prefetchServices('viewer-2', new AbortController().signal);
  assert.equal(requests, 2);
});

function session() {
  return { getItem: () => JSON.stringify({ access_token: 'test-user-token', expires_at: Date.now() / 1000 + 3600 }) };
}

test('uploads reject a missing session instead of falling back to anonymous writes', async () => {
  globalThis.localStorage = { getItem: () => null };
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('{}'); };
  await assert.rejects(uploads.uploadToStorageDirect(new Blob(['image']), options));
  assert.equal(requests, 0);
});

test('a stalled avatar aborts without blocking cover or subsequent uploads', async () => {
  globalThis.localStorage = session();
  let avatarSignal;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-user-token');
    if (url.includes('avatar')) {
      avatarSignal = init.signal;
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }
    return new Response('{}');
  };
  const avatar = assert.rejects(uploads.uploadToStorageDirect(new Blob(['image']), options), /مهلة/);
  const cover = await uploads.uploadToStorageDirect(new Blob(['cover']), { ...options, path: 'test-user/cover.jpg' });
  assert.match(cover, /cover\.jpg$/);
  await avatar;
  assert.equal(avatarSignal.aborted, true);
  const cv = await uploads.uploadToStorageDirect(new Blob(['pdf']), { ...options, bucket: 'resumes', path: 'test-user/cv.pdf' });
  assert.match(cv, /cv\.pdf$/);
});

test('a permission error is not retried with anonymous credentials', async () => {
  globalThis.localStorage = session();
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('{}', { status: 403 }); };
  await assert.rejects(uploads.uploadToStorageDirect(new Blob(['image']), options), /403/);
  assert.equal(requests, 1);
});

test('an expired token after the tab was hidden is refreshed instead of failing the upload', async () => {
  globalThis.localStorage = { getItem: () => JSON.stringify({ access_token: 'stale-token', expires_at: Date.now() / 1000 - 60 }) };
  globalThis.testDatabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'fresh-token' } } }) } };
  let authorization;
  globalThis.fetch = async (_, init) => { authorization = init.headers.Authorization; return new Response('{}'); };
  try {
    await uploads.uploadToStorageDirect(new Blob(['image']), options);
  } finally {
    delete globalThis.testDatabase;
  }
  assert.equal(authorization, 'Bearer fresh-token');
});

test('migration lets the post author or an admin delete posts', () => {
  const sql = readFileSync('supabase/SECURITY_HARDENING_MIGRATION.sql', 'utf8').split('-- 13. ')[1]?.split('-- 14. ')[0];
  assert.ok(sql);
  assert.match(sql, /cmd = 'DELETE'/);
  assert.match(sql, /FOR DELETE TO authenticated\s+USING \(author_id = auth\.uid\(\) OR public\.prolink_is_admin\(\)\)/);
});

test('migration keeps built CVs private unless published and writable only by their owner', () => {
  const file = readFileSync('supabase/SECURITY_HARDENING_MIGRATION.sql', 'utf8');
  const sql = file.split('-- 14. ')[1];
  assert.ok(sql);
  assert.ok(file.indexOf('-- 14. ') > file.indexOf('-- 3. storage'), '§14 must run after §3 drops storage policies');
  assert.match(sql, /is_public boolean NOT NULL DEFAULT false/);
  assert.match(sql, /REVOKE ALL ON public\.cv_profiles FROM anon/);
  assert.match(sql, /FOR SELECT TO authenticated\s+USING \(user_id = auth\.uid\(\) OR is_public OR public\.prolink_is_admin\(\)\)/);
  assert.match(sql, /FOR INSERT TO authenticated\s+WITH CHECK \(user_id = auth\.uid\(\)\)/);
  assert.match(sql, /FOR UPDATE TO authenticated\s+USING \(user_id = auth\.uid\(\)\) WITH CHECK \(user_id = auth\.uid\(\)\)/);
});

test('migration lets only admins upload CV files until the admin opens cv_upload_enabled', () => {
  const file = readFileSync('supabase/SECURITY_HARDENING_MIGRATION.sql', 'utf8');
  const sql = file.split('-- 14. ')[1];
  const gate = /bucket_id NOT IN \('resumes','applications'\)\s+OR public\.prolink_is_admin\(\)\s+OR public\.prolink_feature_open\('cv_upload_enabled'\)/;
  for (const cmd of ['INSERT', 'UPDATE']) {
    const policy = sql.split(`AS RESTRICTIVE FOR ${cmd} TO authenticated`)[1]?.split('CREATE POLICY')[0];
    assert.ok(policy, `restrictive ${cmd} gate exists`);
    assert.match(policy, gate);
  }
  assert.doesNotMatch(sql, /RESTRICTIVE FOR (DELETE|SELECT|ALL)/, 'earlier uploads stay readable and deletable');
  const settings = file.split('-- 4. platform_settings')[1].split('-- 5. ')[0];
  assert.match(settings, /key IN \([^)]*'cv_upload_enabled'[^)]*\)/);
  assert.match(settings, /\('cv_upload_enabled', 'false', NOW\(\)\)/);
});
