import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/lib/services/cvProfileService.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'cv-database-boundary', setup(builder) {
    builder.onResolve({ filter: /\/supabase$/ }, () => ({ path: 'supabase', namespace: 'cv-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'cv-test' }, () => ({ contents: 'export const supabase={from:(...args)=>globalThis.cvTestDatabase.from(...args)};' }));
  } }],
});
const { cvProfileService } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const data = { version: 1, personal: { fullName: 'Test applicant', phone: '07701234567' }, summary: 'Experienced developer', settings: { language: 'ar' } };
function setup(response, stored = new Map()) {
  globalThis.localStorage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const calls = [];
  globalThis.cvTestDatabase = { from(table) {
    calls.push(['from', table]);
    const query = {
      select(...args) { calls.push(['select', ...args]); return query; },
      eq(...args) { calls.push(['eq', ...args]); return query; },
      abortSignal() { return query; },
      maybeSingle() { return Promise.resolve(response); },
      upsert(...args) { calls.push(['upsert', ...args]); return query; },
      then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
    };
    return query;
  } };
  return { calls, stored };
}

test('public lookup requires publication and never reads a local private draft', async () => {
  const { calls } = setup({ data: null, error: null });
  cvProfileService.writeDraft('owner', data, false);
  assert.equal(await cvProfileService.loadPublic('owner'), null);
  assert.deepEqual(calls.filter(c => c[0] === 'eq'), [['eq', 'user_id', 'owner'], ['eq', 'is_public', true]]);
});

test('missing CV table uses only the requested owner draft and cannot publish it', async () => {
  setup({ data: null, error: { code: '42P01' } });
  cvProfileService.writeDraft('owner', data, false);
  const own = await cvProfileService.loadOwn('owner');
  assert.equal(own.storage, 'local');
  assert.equal(own.isPublic, false);
  assert.equal(await cvProfileService.loadOwn('other'), null);
  assert.equal(await cvProfileService.loadPublic('owner'), null);
  const saved = await cvProfileService.save('owner', data, true);
  assert.equal(saved.storage, 'local');
});

test('save keeps ownership, normalized data, public choice and the exact synchronized timestamp', async () => {
  const { calls } = setup({ data: null, error: null });
  const saved = await cvProfileService.save('owner', data, false);
  const payload = calls.find(c => c[0] === 'upsert')[1];
  assert.equal(payload.user_id, 'owner');
  assert.equal(payload.is_public, false);
  assert.equal(saved.storage, 'database');
  assert.equal(cvProfileService.readDraft('owner').updatedAt, saved.updatedAt);
  assert.equal(payload.data.personal.fullName, 'Test applicant');
});

test('permission failures are not disguised as local save or upload success', async () => {
  const { stored } = setup({ data: null, error: { code: '42501' } });
  await assert.rejects(cvProfileService.save('owner', data, false));
  await assert.rejects(cvProfileService.loadOwn('owner'));
  assert.equal(stored.size, 0);
});

test('newer local drafts win over cloud records without leaking drafts to public lookup', async () => {
  setup({ data: { data, is_public: true, updated_at: '2020-01-01T00:00:00Z' }, error: null });
  cvProfileService.writeDraft('owner', { ...data, summary: 'New private draft' }, false);
  assert.equal((await cvProfileService.loadOwn('owner')).data.summary, 'New private draft');
  assert.equal((await cvProfileService.loadPublic('owner')).data.summary, 'Experienced developer');
});

test('malformed local drafts do not crash the editor', () => {
  const { stored } = setup({ data: null, error: null });
  stored.set('prolink:cv-draft:v1:owner', '{bad json');
  assert.equal(cvProfileService.readDraft('owner'), null);
});

test('a saved cloud CV still succeeds if local storage is unavailable', async () => {
  setup({ data: null, error: null });
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  const saved = await cvProfileService.save('owner', data, false);
  assert.equal(saved.storage, 'database');
});

test('local-only saving reports storage failure instead of pretending it persisted', async () => {
  setup({ data: null, error: { code: 'PGRST205' } });
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(cvProfileService.save('owner', data, false), /QuotaExceededError/);
});
