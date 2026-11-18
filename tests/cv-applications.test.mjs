import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function loadModule(relativePath) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env': '{"PROD":false,"DEV":false,"MODE":"test"}' },
    plugins: [{ name: 'database-boundary', setup(builder) {
      builder.onResolve({ filter: /\/supabase$/ }, () => ({ path: 'supabase', namespace: 'fake' }));
      builder.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: `
        export const SUPABASE_URL = 'https://storage.example.test';
        export const SUPABASE_ANON_KEY = 'public-test-key';
        export const AUTH_STORAGE_KEY = 'test-session';
        export const LEGACY_AUTH_STORAGE_KEY = 'test-legacy-session';
        export const supabase = new Proxy({}, { get: (_, key) => globalThis.applicationDatabase?.[key] });
      ` }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const cv = await loadModule('../src/lib/cv/cvData.ts');
const { jobService } = await loadModule('../src/lib/services/jobService.ts');
const helpers = () => loadModule('../src/lib/cv/cvApplicantExport.ts');
const clone = value => JSON.parse(JSON.stringify(value));

function capturedCv(showContacts = false) {
  const data = cv.createEmptyCvData();
  data.personal = { fullName: 'Captured Name', title: 'Captured Title', location: 'Captured City', phone: '+9647701234567', email: 'captured@example.com', website: 'javascript:alert(1)' };
  data.summary = 'Captured professional summary';
  data.experiences = [{ id: 'exp-1', role: 'Engineer', company: 'Captured Company', location: 'Remote', start: '2020', end: '', current: true, description: 'Captured tasks' }];
  data.education = [{ id: 'edu-1', degree: 'BSc', school: 'Captured School', field: 'Engineering', start: '2016', end: '2020', description: 'Captured education' }];
  data.skills = ['TypeScript', 'TypeScript', 'SQL'];
  data.settings = { language: 'ar', showPhoto: true, showPhone: showContacts, showEmail: showContacts };
  return { version: 1, data, capturedAt: '2026-11-17T12:34:56Z', ignored: 'not CV data' };
}

const FULL_COLUMNS = ['id', 'applicant_id', 'employer_id', 'job_id', 'cover_letter', 'cv_url', 'status', 'experience', 'education', 'skills', 'applicant_data'];
const STANDARD_COLUMNS = FULL_COLUMNS.filter(column => !['experience', 'education', 'skills'].includes(column));
const MIN_COLUMNS = STANDARD_COLUMNS.filter(column => !['employer_id', 'cv_url'].includes(column));

// Schema and uniqueness errors must occur before mutation.
function fakeDatabase({ columns = FULL_COLUMNS, existing = false, hideExisting = false, failure = null, duplicateMessage = 'duplicate key violates unique constraint on applicant_id, job_id' } = {}) {
  const allowed = new Set(columns);
  let row = existing ? { id: 'application-1', applicant_id: 'applicant-1', job_id: 'job-1', status: 'rejected', applicant_data: { name: 'Old' } } : null;
  const writes = [];
  const database = {
    from(table) {
      assert.equal(table, 'job_applications');
      let operation = 'select';
      let payload;
      const filters = {};
      const finish = async () => {
        if (operation === 'select') return { data: hideExisting ? null : clone(row), error: null };
        writes.push({ operation, payload: clone(payload) });
        if (failure) return { data: null, error: failure };
        const missing = Object.keys(payload).find(column => !allowed.has(column));
        if (missing) return { data: null, error: { code: 'PGRST204', message: `Could not find the '${missing}' column of 'job_applications' in the schema cache` } };
        if (operation === 'insert' && row) return { data: null, error: { code: '23505', message: duplicateMessage } };
        if (operation === 'update') {
          assert.ok(row, 'an update must target an existing application');
          for (const [key, value] of Object.entries(filters)) assert.equal(row[key], value);
          row = { ...row, ...clone(payload) };
        } else row = clone(payload);
        return { data: [clone(row)], error: null };
      };
      const query = {
        select() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        maybeSingle: finish,
        insert(rows) { operation = 'insert'; payload = rows[0]; return query; },
        update(value) { operation = 'update'; payload = value; return query; },
        then(resolve, reject) { return finish().then(resolve, reject); },
      };
      return query;
    },
  };
  return { database, writes, row: () => row };
}

function applicationInput(snapshot = capturedCv()) {
  return {
    jobId: 'job-1', cvUrl: 'https://storage.example.test/legacy.pdf', coverLetter: 'Application cover letter',
    experience: 'Application experience', education: 'Application education', skills: ['Application skill'],
    applicantData: { name: 'Current Name', phone: '+9647700000000', email: 'current@example.com', cv: snapshot },
  };
}

for (const [name, options] of [
  ['full insert', {}],
  ['standard insert fallback', { columns: STANDARD_COLUMNS }],
  ['minimal insert fallback', { columns: MIN_COLUMNS }],
  ['existing full update', { existing: true }],
  ['existing fallback update', { existing: true, columns: STANDARD_COLUMNS }],
  ['existing minimal update', { existing: true, columns: MIN_COLUMNS }],
  ['duplicate full update', { existing: true, hideExisting: true }],
  ['duplicate fallback update', { existing: true, hideExisting: true, columns: STANDARD_COLUMNS }],
  ['duplicate minimal update', { existing: true, hideExisting: true, columns: MIN_COLUMNS }],
  ['duplicate update without constraint details', { existing: true, hideExisting: true, duplicateMessage: 'duplicate key' }],
]) {
  test(`${name} retains the captured CV and application metadata without hidden contacts`, async () => {
    const fake = fakeDatabase(options);
    globalThis.applicationDatabase = fake.database;
    const input = applicationInput();
    const before = clone(input);
    const result = await jobService.applyToJob('applicant-1', 'employer-1', input);
    assert.equal(result.error, null);
    const saved = fake.row().applicant_data;
    assert.equal(saved.cv.capturedAt, input.applicantData.cv.capturedAt);
    assert.equal(saved.cv.data.personal.fullName, 'Captured Name');
    assert.equal(saved.cv.data.experiences[0].description, 'Captured tasks');
    assert.equal(saved.cv.data.education[0].school, 'Captured School');
    assert.deepEqual(saved.cv.data.skills, ['TypeScript', 'SQL']);
    assert.equal(saved.cv.data.personal.phone, '');
    assert.equal(saved.cv.data.personal.email, '');
    assert.equal(saved.cv.data.personal.website, '');
    assert.equal(saved.cv.data.settings.showPhoto, false);
    assert.equal(saved.phone, '');
    assert.equal(saved.email, '');
    assert.equal(saved.experience, 'Application experience');
    assert.equal(saved.education, 'Application education');
    assert.deepEqual(saved.skills, ['Application skill']);
    assert.ok(new TextEncoder().encode(JSON.stringify(saved.cv)).length <= cv.CV_LIMITS.maxBytes);
    assert.deepEqual(input, before, 'submission must not mutate the caller CV');
  });
}

test('missing top-level and applicant metadata are derived from the captured CV', async () => {
  const fake = fakeDatabase({ columns: MIN_COLUMNS });
  globalThis.applicationDatabase = fake.database;
  const result = await jobService.applyToJob('applicant-1', 'employer-1', { jobId: 'job-1', applicantData: { cv: capturedCv(true) } });
  assert.equal(result.error, null);
  const saved = fake.row().applicant_data;
  assert.match(saved.experience, /Engineer[\s\S]*Captured tasks/);
  assert.match(saved.education, /BSc[\s\S]*Captured School/);
  assert.deepEqual(saved.skills, ['TypeScript', 'SQL']);
  assert.equal(saved.phone, '+9647701234567');
  assert.equal(saved.email, 'captured@example.com');
});

for (const existing of [false, true]) {
  test(`missing applicant_data column returns a migration error, never CV-less success (${existing ? 'update' : 'insert'})`, async () => {
    const fake = fakeDatabase({ existing, columns: FULL_COLUMNS.filter(column => column !== 'applicant_data') });
    globalThis.applicationDatabase = fake.database;
    const before = clone(fake.row());
    const result = await jobService.applyToJob('applicant-1', 'employer-1', applicationInput());
    assert.ok(result.error);
    assert.match(result.error.message, /applicant_data/);
    assert.match(result.error.message, /ترقية|migration/i);
    assert.deepEqual(fake.row(), before);
    assert.ok(fake.writes.every(write => write.payload.applicant_data?.cv), 'no retry drops a supplied CV');
  });
}

test('PostgreSQL missing-column errors are also reported as CV migration errors', async () => {
  const fake = fakeDatabase({ failure: { code: '42703', message: 'column "applicant_data" of relation "job_applications" does not exist' } });
  globalThis.applicationDatabase = fake.database;
  const result = await jobService.applyToJob('applicant-1', 'employer-1', applicationInput());
  assert.match(result.error?.message || '', /ترقية[\s\S]*applicant_data/);
  assert.equal(fake.row(), null);
});

test('legacy application without a builder CV still preserves submitted metadata in fallback', async () => {
  const fake = fakeDatabase({ columns: MIN_COLUMNS });
  globalThis.applicationDatabase = fake.database;
  const input = applicationInput();
  delete input.applicantData.cv;
  const result = await jobService.applyToJob('applicant-1', 'employer-1', input);
  assert.equal(result.error, null);
  assert.equal(fake.row().applicant_data.experience, input.experience);
  assert.equal(fake.row().applicant_data.education, input.education);
  assert.deepEqual(fake.row().applicant_data.skills, input.skills);
});

test('captured metadata remains complete even when optional text columns need shorter values', async () => {
  const fake = fakeDatabase({ columns: STANDARD_COLUMNS });
  globalThis.applicationDatabase = fake.database;
  const input = applicationInput();
  input.experience = 'Captured experience '.repeat(200);
  input.education = 'Captured education '.repeat(200);
  const result = await jobService.applyToJob('applicant-1', 'employer-1', input);
  assert.equal(result.error, null);
  assert.equal(fake.row().applicant_data.experience, input.experience);
  assert.equal(fake.row().applicant_data.education, input.education);
});

test('resubmitting immediately replaces the submitted snapshot without a refresh', async () => {
  const fake = fakeDatabase({ columns: STANDARD_COLUMNS });
  globalThis.applicationDatabase = fake.database;
  const input = applicationInput();
  assert.equal((await jobService.applyToJob('applicant-1', 'employer-1', input)).error, null);
  input.applicantData.cv.capturedAt = '2026-11-18T12:34:56Z';
  input.applicantData.cv.data.personal.fullName = 'New captured name';
  const result = await jobService.applyToJob('applicant-1', 'employer-1', input);
  assert.equal(result.error, null);
  assert.equal(result.isUpdated, true);
  assert.equal(fake.row().applicant_data.cv.capturedAt, input.applicantData.cv.capturedAt);
  assert.equal(fake.row().applicant_data.cv.data.personal.fullName, 'New captured name');
});

test('fallback retains skills supplied inside legacy applicant metadata', async () => {
  const fake = fakeDatabase({ columns: MIN_COLUMNS });
  globalThis.applicationDatabase = fake.database;
  const result = await jobService.applyToJob('applicant-1', 'employer-1', { jobId: 'job-1', applicantData: { skills: 'TypeScript,SQL' } });
  assert.equal(result.error, null);
  assert.deepEqual(fake.row().applicant_data.skills, ['TypeScript', 'SQL']);
});

test('permission errors do not trigger CV-dropping schema fallbacks', async () => {
  const failure = { code: '42501', message: 'new row violates row-level security policy' };
  const fake = fakeDatabase({ failure });
  globalThis.applicationDatabase = fake.database;
  const result = await jobService.applyToJob('applicant-1', 'employer-1', applicationInput());
  assert.deepEqual(result.error, failure);
  assert.equal(fake.row(), null);
  assert.equal(fake.writes.length, 1);
});

function oversizedSnapshot() {
  const snapshot = capturedCv(true);
  const limits = cv.CV_LIMITS;
  const text = length => '漢'.repeat(length);
  snapshot.data.experiences = Array.from({ length: limits.experiences }, (_, i) => ({ id: `e-${i}`, role: text(limits.role), company: text(limits.company), location: text(limits.location), start: text(limits.date), end: text(limits.date), current: false, description: text(limits.experienceDescription) }));
  snapshot.data.education = Array.from({ length: limits.education }, (_, i) => ({ id: `u-${i}`, degree: text(limits.degree), school: text(limits.school), field: text(limits.field), start: text(limits.date), end: text(limits.date), description: text(limits.educationDescription) }));
  snapshot.data.skills = Array.from({ length: limits.skills }, (_, i) => `${i}${text(limits.skill - 2)}`);
  snapshot.data.summary = text(limits.summary);
  snapshot.data.certifications = Array.from({ length: limits.certifications }, (_, i) => ({ id: `c-${i}`, name: text(limits.certificationName), issuer: text(limits.issuer), year: text(limits.date) }));
  return snapshot;
}

for (const [name, snapshot] of [['malformed', { version: 2, data: {} }], ['oversized', oversizedSnapshot()]]) {
  test(`${name} supplied CV is rejected before any database access`, async () => {
    globalThis.applicationDatabase = { from() { assert.fail('invalid CV must never reach the database'); } };
    const result = await jobService.applyToJob('applicant-1', 'employer-1', applicationInput(snapshot));
    assert.ok(result.error);
    assert.match(result.error.message, /السيرة الذاتية/);
  });
}

test('snapshot reader normalizes, sanitizes privacy, keeps capturedAt and rejects excessive bytes', async () => {
  const { readApplicantCvSnapshot } = await helpers();
  const input = capturedCv();
  const before = clone(input);
  const snapshot = readApplicantCvSnapshot(input);
  assert.equal(snapshot.capturedAt, input.capturedAt);
  assert.equal(snapshot.data.personal.phone, '');
  assert.equal(snapshot.data.personal.email, '');
  assert.equal(snapshot.data.settings.showPhoto, false);
  assert.deepEqual(snapshot.data.skills, ['TypeScript', 'SQL']);
  assert.equal(readApplicantCvSnapshot(oversizedSnapshot()), null);
  assert.equal(readApplicantCvSnapshot({ version: 2, data: input.data }), null);
  assert.deepEqual(input, before);
});

test('applicant details fill missing experience/education/skills from snapshot, never current identity or hidden contacts', async () => {
  const { resolveApplicantCvData } = await helpers();
  const snapshot = capturedCv();
  snapshot.data.personal.location = '';
  const resolved = resolveApplicantCvData({ cv: snapshot, skills: [] }, { name: 'Today', title: 'Today title', location: 'Today city', phone: '+9647700000000', email: 'today@example.com', experience: 'Today experience', education: 'Today education', skills: ['Today skill'] });
  assert.equal(resolved.name, 'Captured Name');
  assert.equal(resolved.title, 'Captured Title');
  assert.equal(resolved.location, '');
  assert.equal(resolved.phone, '');
  assert.equal(resolved.email, '');
  assert.match(resolved.experience, /Captured tasks/);
  assert.match(resolved.education, /Captured School/);
  assert.deepEqual(resolved.skills, ['TypeScript', 'SQL']);
  const explicit = resolveApplicantCvData({ cv: snapshot, experience: 'Submitted experience', education: 'Submitted education', skills: ['Submitted skill'] });
  assert.equal(explicit.experience, 'Submitted experience');
  assert.equal(explicit.education, 'Submitted education');
  assert.deepEqual(explicit.skills, ['Submitted skill']);
});

test('Excel row exports immutable snapshot details and safe contacts, not today profile or storage links', async () => {
  const { applicantExcelRow } = await helpers();
  const app = { id: 'app-1', status: 'pending', created_at: '2026-11-17', applicant_data: { cv: capturedCv(), experience: 'Today metadata', phone: '+9647700000000', email: 'today@example.com' }, cv_url: 'javascript:alert(1)', jobTitle: 'Captured job' };
  const row = applicantExcelRow(app, 0, { name: 'Today profile', phone: '+9647700000000', email: 'today@example.com', experience: 'Today profile experience', cvUrl: 'https://storage.example.test/personal.pdf' });
  assert.match(row, /Captured Name/);
  assert.match(row, /Captured Company/);
  assert.match(row, /Captured School/);
  assert.match(row, /Captured tasks/);
  assert.match(row, /TypeScript/);
  assert.match(row, /سيرة مرفقة بالطلب/);
  assert.doesNotMatch(row, /Today|today@example|7700000000|captured@example|7701234567|href=|javascript:|personal\.pdf/);
  const publicRow = applicantExcelRow({ ...app, applicant_data: { cv: capturedCv(true) } }, 0);
  assert.match(publicRow, /captured@example.com/);
  assert.match(publicRow, /&#39;\+9647701234567/);
});

test('an empty captured summary never falls back to unrelated application or live-profile text in Excel', async () => {
  const { applicantExcelRow } = await helpers();
  const snapshot = capturedCv();
  snapshot.data.summary = '';
  const row = applicantExcelRow({ status: 'pending', created_at: '2026-11-17', applicant_data: { cv: snapshot, experience: 'Unrelated metadata', bio: 'Unrelated bio' } }, 0, { bio: 'Unrelated live bio' });
  assert.doesNotMatch(row, /Unrelated/);
  assert.match(row, /Captured tasks/);
});

test('Excel cells HTML-encode all dynamic values and neutralize leading spreadsheet formulas', async () => {
  const { excelCellText, applicantExcelRow } = await helpers();
  for (const prefix of ['=', '+', '-', '@', ' \t=']) {
    assert.ok(excelCellText(`${prefix}<img src=x onerror="alert(1)">&'`).startsWith('&#39;'));
  }
  assert.equal(excelCellText('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
  const payload = '=<img src=x onerror="alert(1)">&';
  const app = { status: 'pending', created_at: '2026-11-17', jobTitle: payload, cv_url: 'data:text/html,<script>alert(1)</script>', applicant_data: { name: payload, email: payload, phone: payload, location: payload, title: payload, companyName: payload, industry: payload, experience: payload, education: payload, skills: [payload], bio: payload, prevWorks: [{ company: payload, role: payload, salary: payload, tasks: payload }] } };
  const row = applicantExcelRow(app, 0);
  assert.doesNotMatch(row, /<img|<script|href=/);
  assert.ok(row.split('&#39;=&lt;img').length > 10, 'every plain formula-bearing cell is protected');
  assert.match(row, /&amp;/);
});
