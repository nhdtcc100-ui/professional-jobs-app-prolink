import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Node 24 built-ins only; no database connections or production credentials.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
function database(responses) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from(table) {
      const call = { table, operation: 'select', filters: [] };
      const finish = () => {
        calls.push(call);
        assert.ok(responses.length, `Unexpected ${call.operation} on ${table}`);
        return Promise.resolve(responses.shift());
      };
      return {
        select() { return this; },
        eq(...args) { call.filters.push(['eq', ...args]); return this; },
        or(...args) { call.filters.push(['or', ...args]); return this; },
        update(payload) { call.operation = 'update'; call.payload = payload; return this; },
        insert(payload) { call.operation = 'insert'; call.payload = payload; return this; },
        single: finish,
        maybeSingle: finish,
        then(resolve, reject) { return finish().then(resolve, reject); },
      };
    },
  };
}
const ok = data => ({ data, error: null });
const row = role => ({ id: 'user-1', name: 'Test user', role });
function service(name, db, extras = {}) {
  const source = read(`src/lib/services/${name}.ts`)
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\bexport (?=const |interface )/g, '');
  return vm.runInNewContext(`${stripTypeScriptTypes(source)}\n${name};`, {
    supabase: db, console: quiet, logger: quiet,
    sanitizeInput: value => String(value),
    validateName: () => ({ valid: true }),
    threatEngine: { scanForXSS: () => ({ detected: false }) },
    SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'test-key',
    AUTH_STORAGE_KEY: 'test-auth', LEGACY_AUTH_STORAGE_KEY: 'test-legacy-auth',
    localStorage: { getItem: () => null, setItem() {} },
    ...extras,
  });
}

for (const [existing, requested] of [['seeker', 'employer'], ['employer', 'seeker'], ['freelancer', 'employer'], ['admin', 'employer']]) {
  test(`selectRole preserves established ${existing} instead of ${requested}`, async () => {
    const db = database([ok(row(existing))]);
    const result = await service('authService', db).selectRole('user-1', requested);
    assert.ok(result.error);
    assert.equal(db.calls.length, 1);
  });
}

test('same-role selection is an idempotent read, not another profile write', async () => {
  const db = database([ok(row('employer'))]);
  const result = await service('authService', db).selectRole('user-1', 'employer', { phone: '123' });
  assert.equal(result.error, null);
  assert.equal(result.data.role, 'employer');
  assert.equal(db.calls.length, 1);
});

for (const unassigned of [null, '']) {
  test(`first assignment from ${JSON.stringify(unassigned)} verifies the saved row`, async () => {
    const db = database([ok(row(unassigned)), ok(row('employer'))]);
    const result = await service('authService', db).selectRole('user-1', 'employer');
    assert.equal(result.error, null);
    assert.equal(result.data.role, 'employer');
    assert.equal(db.calls[1].operation, 'update');
    assert.deepEqual(db.calls[1].filters[1], ['or', 'role.is.null,role.eq.']);
  });
}

test('profile lookup errors never fall through to insertion', async () => {
  const db = database([{ data: null, error: { message: 'unavailable' } }]);
  assert.ok((await service('authService', db).selectRole('user-1', 'seeker')).error);
  assert.equal(db.calls.length, 1);
});

for (const saved of [null, row('seeker')]) {
  test(`empty or trigger-reverted first assignments are not reported as successful (${saved?.role ?? 'no row'})`, async () => {
    const db = database([ok(row(null)), ok(saved)]);
    assert.ok((await service('authService', db).selectRole('user-1', 'employer')).error);
  });
}

test('missing profile uses insert-only and verifies returned role', async () => {
  const db = database([ok(null), ok(row('employer'))]);
  const result = await service('authService', db).selectRole('user-1', 'employer');
  assert.equal(result.error, null);
  assert.equal(db.calls[1].operation, 'insert');
});

test('concurrent profile creation produces an error rather than an overwriting upsert', async () => {
  const db = database([ok(null), { data: null, error: { code: '23505' } }]);
  assert.ok((await service('authService', db).selectRole('user-1', 'employer')).error);
  assert.equal(db.calls[1].operation, 'insert');
});

test('runtime role allowlist rejects privilege roles before accessing profiles', async () => {
  const db = database([]);
  assert.ok((await service('authService', db).selectRole('user-1', 'admin')).error);
  assert.equal(db.calls.length, 0);
});

const request = (instance, id = 'user-1', current = 'seeker', desired = 'employer') =>
  instance.sendRoleChangeRequest(id, 'Test user', '', current, desired, 'Reason');

for (const setting of [ok({ value: 'false' }), ok(null), { data: null, error: { message: 'offline' } }]) {
  test(`requests fail closed with setting ${JSON.stringify(setting)}`, async () => {
    const db = database([ok({ role: 'seeker', is_admin: false }), setting]);
    const result = await request(service('profileService', db, {
      // A stale cached open gate must not authorize a request.
      localStorage: { getItem: () => '{"accountSwitchEnabled":true}', setItem() {} },
    }));
    assert.ok(result.error);
    assert.equal(db.calls.some(call => call.operation === 'insert'), false);
  });
}

for (const isAdmin of [false, true]) {
  test(`${isAdmin ? 'admin bypass' : 'fresh open gate'} creates only a pending self request`, async () => {
    const responses = [ok({ role: 'seeker', is_admin: isAdmin })];
    if (!isAdmin) responses.push(ok({ value: 'true' }));
    responses.push(ok({ id: 'request-1', status: 'pending' }), ok([]));
    const db = database(responses);
    assert.equal((await request(service('profileService', db))).error, null);
    const inserted = db.calls.find(call => call.operation === 'insert');
    assert.equal(inserted.table, 'role_change_requests');
    assert.equal(inserted.payload[0].status, 'pending');
    assert.equal(inserted.payload[0].user_id, 'user-1');
    assert.equal(db.calls.some(call => call.operation === 'update'), false);
  });
}

test('requesting a switch for another user is refused before lookup or insertion', async () => {
  const db = database([]);
  assert.ok((await request(service('profileService', db), 'someone-else')).error);
  assert.equal(db.calls.length, 0);
});

test('stale current role does not create a misleading request', async () => {
  const db = database([ok({ role: 'freelancer', is_admin: false }), ok({ value: 'true' })]);
  assert.ok((await request(service('profileService', db))).error);
  assert.equal(db.calls.length, 2);
});

for (const attemptedRole of ['employer', undefined]) {
  test(`ordinary profile saves preserve cached role and legacy aliases against ${attemptedRole}`, async () => {
  const cache = new Map([['prolink_cached_user', JSON.stringify({
    id: 'user-1', role: 'seeker', account_type: 'seeker', accountType: 'seeker', bio: '',
  })]]);
  let payload;
  const instance = service('profileService', database([]), {
    localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) },
    fetch: async (_url, init) => {
      payload = JSON.parse(init.body);
      return { ok: true, json: async () => [row('seeker')] };
    },
  });
  const updates = { role: attemptedRole, account_type: attemptedRole, accountType: attemptedRole, bio: 'Updated' };
  await instance.updateProfile('user-1', updates);
  const cached = JSON.parse(cache.get('prolink_cached_user'));
  for (const field of ['role', 'account_type', 'accountType']) {
    assert.equal(cached[field], 'seeker');
    assert.equal(field in payload, false);
  }
  assert.equal(cached.bio, 'Updated');
  assert.equal(updates.role, attemptedRole, 'caller-owned input is not mutated');
  });
}

function contextSelectRole(overrides = {}) {
  const code = read('src/contexts/AppContext.tsx').match(/  const selectRole = async[\s\S]+?\n  };/)[0];
  return vm.runInNewContext(`${stripTypeScriptTypes(code)}\nselectRole;`, {
    user: { id: 'user-1', user_metadata: {} }, appUser: { role: 'seeker' },
    canUseAccountSwitch: false, addToast() {}, ...overrides,
  });
}

for (const gate of [false, true]) {
  test(`context does not directly switch an established role when gate=${gate}`, async () => {
    let calls = 0;
    let message;
    const select = contextSelectRole({
      canUseAccountSwitch: gate,
      authService: { selectRole: async () => { calls++; return { error: null }; } },
      addToast: text => { message = text; },
    });
    await select('employer');
    assert.equal(calls, 0);
    assert.ok(message);
  });
}

test('context does not finish onboarding without a confirmed matching profile', async () => {
  let finished = false;
  let successToast = false;
  const select = contextSelectRole({
    appUser: null,
    authService: { selectRole: async () => ({ error: null }), getProfile: async () => ok(null) },
    setNeedsRole: () => { finished = true; },
    addToast: (_text, type) => { if (type !== 'error') successToast = true; },
  });
  await select('employer');
  assert.equal(finished, false);
  assert.equal(successToast, false);
});

test('profile role section and modal both require the account-switch gate', () => {
  const source = read('src/components/features/profile/ProfileEditView.tsx');
  assert.match(source, /Section 0:[^\n]+\n\s*\{canUseAccountSwitch && \(/);
  assert.match(source, /\{canUseAccountSwitch && showRoleModal && targetRoleToRequest && \(/);
});

test('migration appends creation-only metadata, legacy role lock and restrictive request insertion', () => {
  const sql = read('supabase/SECURITY_HARDENING_MIGRATION.sql').split('-- 12. Preserve signup roles;')[1]?.split('-- 13. ')[0];
  assert.ok(sql);
  assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM public\.profiles p WHERE p\.id = NEW\.id\)/);
  assert.match(sql, /signup_role IN \('seeker', 'employer', 'freelancer'\)/);
  assert.match(sql, /to_jsonb\(NEW\) \? 'account_type'/);
  assert.match(sql, /NEW\.role := OLD\.role/);
  assert.match(sql, /AS RESTRICTIVE FOR INSERT TO PUBLIC/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /status = 'pending'/);
  assert.match(sql, /public\.prolink_is_admin\(\) OR public\.prolink_feature_open\('account_switch_enabled'\)/);
  assert.doesNotMatch(sql, /UPDATE public\.profiles|FOR UPDATE|DROP POLICY(?! IF EXISTS "role_req_insert_gate")/);
});
