/**
 * 📊 محلل نتائج اختبار الحمل — ProLink Performance Analyzer
 * ===========================================================
 * متوافق مع Node.js ESM (type: "module" في package.json)
 *
 * 🚀 الاستخدام:
 *   node tests/load/analyze-results.js tests/load/reports/smoke-test-report.json
 *   node tests/load/analyze-results.js tests/load/reports/*.json   (مقارنة متعددة)
 *   node tests/load/analyze-results.js --all                       (كل التقارير)
 */

import fs   from 'fs';
import path from 'path';

// ──────────────────────────────────────────────────────────
// 🔍  قراءة الملفات المطلوبة
// ──────────────────────────────────────────────────────────
const REPORTS_DIR = 'tests/load/reports';

let files = process.argv.slice(2);

if (files.includes('--all') || files.length === 0) {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.error(`\n❌ مجلد التقارير غير موجود: ${REPORTS_DIR}`);
    console.error('   قم بتشغيل الاختبار أولاً:\n   k6 run tests/load/smoke-test.js\n');
    process.exit(1);
  }
  files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(REPORTS_DIR, f));
}

if (files.length === 0) {
  console.error(`\n❌ لا توجد تقارير JSON في: ${REPORTS_DIR}`);
  console.error('   شغّل أحد الاختبارات أولاً، مثلاً:\n   k6 run tests/load/smoke-test.js\n');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────
// 🧮  استخراج مقاييس الأداء
// ──────────────────────────────────────────────────────────
function extractMetrics(filePath) {
  if (!fs.existsSync(filePath)) return null;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }

  const m    = raw.metrics || {};
  const name = path.basename(filePath, '.json').replace(/-report$/, '');

  return {
    name,
    file:   filePath,
    p50:    m.http_req_duration?.values?.['p(50)']  ?? 0,
    p95:    m.http_req_duration?.values?.['p(95)']  ?? 0,
    p99:    m.http_req_duration?.values?.['p(99)']  ?? 0,
    avg:    m.http_req_duration?.values?.avg         ?? 0,
    min:    m.http_req_duration?.values?.min         ?? 0,
    max:    m.http_req_duration?.values?.max         ?? 0,
    errs:   (m.http_req_failed?.values?.rate         ?? 0) * 100,
    reqs:   m.http_reqs?.values?.count               ?? 0,
    rps:    m.http_reqs?.values?.rate                ?? 0,
    vus:    m.vus_max?.values?.max                   ?? 0,
    dur:    raw.state?.testRunDurationMs             ?? 0,
  };
}

// ──────────────────────────────────────────────────────────
// 🏆  الحكم والتقييم
// ──────────────────────────────────────────────────────────
function getVerdict(m) {
  if (m.errs > 5  || m.p99 > 10000) return { icon: '🔴', label: 'فشل كبير',      color: 'FAIL',  score: 0 };
  if (m.errs > 1  || m.p95 > 5000 ) return { icon: '🟡', label: 'مقبول مع ملاحظات', color: 'WARN',  score: 1 };
  if (m.p95  > 2000              ) return { icon: '🟠', label: 'جيد — قابل للتحسين', color: 'OK',    score: 2 };
  if (m.p95  > 1000              ) return { icon: '🟢', label: 'جيد جداً',       color: 'GOOD',  score: 3 };
  return                                   { icon: '✨', label: 'ممتاز — جاهز للإطلاق!', color: 'PASS', score: 4 };
}

// ──────────────────────────────────────────────────────────
// 💡  توليد التوصيات
// ──────────────────────────────────────────────────────────
function getRecommendations(m) {
  const recs = [];
  if (m.errs > 0)    recs.push('• ارفع خطة Supabase أو فعّل Connection Pooling (PgBouncer)');
  if (m.p95  > 2000) recs.push('• أضف طبقة Cache (Redis) للاستعلامات المتكررة');
  if (m.p95  > 5000) recs.push('• استخدم Supabase Edge Functions لتقليل الضغط على DB');
  if (m.rps  < 50)   recs.push('• استخدم CDN (Cloudflare) لتخزين الملفات الثابتة');
  if (m.max  > 30000) recs.push('• فعّل Query Timeout في Supabase لمنع الطلبات المعلّقة');
  if (m.vus  > 500 && m.errs > 1) recs.push('• فكّر في Horizontal Scaling أو قاعدة بيانات Read Replica');
  return recs;
}

// ──────────────────────────────────────────────────────────
// 🎨  دوال الطباعة
// ──────────────────────────────────────────────────────────
const W = 57; // عرض الجدول

function line(content = '', pad = ' ') {
  const inner = content.substring(0, W - 2);
  const spacer = pad.repeat(Math.max(0, W - 2 - visLen(inner)));
  return `║ ${inner}${spacer} ║`;
}

// احسب الطول المرئي (مع تجاهل رموز emoji التي تأخذ 2 مسافة)
function visLen(str) {
  return [...str].reduce((n, c) => n + (c.codePointAt(0) > 0xFFFF ? 2 : 1), 0);
}

function sep(char = '═') { return `╠${'═'.repeat(W - 0)}╣`; }
function top()           { return `╔${'═'.repeat(W - 0)}╗`; }
function bot()           { return `╚${'═'.repeat(W - 0)}╝`; }
function mid(char)       { return `╠${'═'.repeat(W - 0)}╣`; }

function fmtRow(label, value) {
  const lbl = `  ${label}`;
  const val = String(value);
  const spaces = Math.max(1, W - 2 - visLen(lbl) - visLen(val));
  return `║${lbl}${' '.repeat(spaces)}${val}║`;
}

function printReport(m) {
  const v = getVerdict(m);
  const recs = getRecommendations(m);
  const testName = m.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const dur = m.dur ? `${(m.dur / 60000).toFixed(1)} دقيقة` : 'غير محدد';

  console.log('\n' + top());
  console.log(line(`  📊 تقرير أداء ProLink — ${testName}`));
  console.log(sep());
  console.log(fmtRow('الملف       :', path.basename(m.file)));
  console.log(fmtRow('المستخدمون  :', `${m.vus.toLocaleString('en-US')} VU`));
  console.log(fmtRow('مدة الاختبار:', dur));
  console.log(sep());
  console.log(fmtRow(`${v.icon} الحكم النهائي:`, v.label));
  console.log(sep());
  console.log(line('  📈 إحصائيات الطلبات:'));
  console.log(fmtRow('  إجمالي الطلبات:', m.reqs.toLocaleString('en-US') + ' طلب'));
  console.log(fmtRow('  معدل RPS       :', m.rps.toFixed(1) + ' req/s'));
  console.log(fmtRow('  معدل الأخطاء   :', m.errs.toFixed(3) + '%'));
  console.log(sep());
  console.log(line('  ⏱️  زمن الاستجابة (Response Time):'));
  console.log(fmtRow('  الأدنى  (min):', m.min.toFixed(0) + 'ms'));
  console.log(fmtRow('  متوسط   (avg):', m.avg.toFixed(0) + 'ms'));
  console.log(fmtRow('  p50          :', m.p50.toFixed(0) + 'ms'));
  console.log(fmtRow('  p95 (الأهم) :', m.p95.toFixed(0) + 'ms'));
  console.log(fmtRow('  p99          :', m.p99.toFixed(0) + 'ms'));
  console.log(fmtRow('  الأقصى  (max):', m.max.toFixed(0) + 'ms'));
  console.log(bot());

  if (recs.length > 0) {
    console.log('\n💡 التوصيات:');
    recs.forEach(r => console.log('  ' + r));
  } else {
    console.log('\n✅ لا توصيات — الأداء مثالي!');
  }
}

// ──────────────────────────────────────────────────────────
// 📋  جدول مقارنة متعدد التقارير
// ──────────────────────────────────────────────────────────
function printComparison(metrics) {
  console.log('\n' + '═'.repeat(W + 2));
  console.log(' 🏆 مقارنة نتائج جميع الاختبارات');
  console.log('═'.repeat(W + 2));

  const header = 'الاختبار            أخطاء %   p95(ms)   RPS      الحكم';
  console.log(header);
  console.log('─'.repeat(W + 2));

  metrics
    .sort((a, b) => getVerdict(b).score - getVerdict(a).score)
    .forEach(m => {
      const v    = getVerdict(m);
      const name = m.name.padEnd(20).slice(0, 20);
      const errs = m.errs.toFixed(2).padStart(8);
      const p95  = m.p95.toFixed(0).padStart(9);
      const rps  = m.rps.toFixed(0).padStart(8);
      console.log(`${name}  ${errs}  ${p95}  ${rps}   ${v.icon} ${v.label}`);
    });

  console.log('═'.repeat(W + 2) + '\n');
}

// ──────────────────────────────────────────────────────────
// ▶️  التشغيل الرئيسي
// ──────────────────────────────────────────────────────────
const metrics = files
  .map(f => extractMetrics(f))
  .filter(Boolean);

if (metrics.length === 0) {
  console.error('\n❌ لم يتم العثور على تقارير صالحة.');
  console.error('   تأكد أن ملفات JSON موجودة وصحيحة.\n');
  process.exit(1);
}

// طباعة تقرير لكل ملف
metrics.forEach(m => printReport(m));

// طباعة مقارنة جماعية إذا كان هناك أكثر من تقرير
if (metrics.length > 1) {
  printComparison(metrics);
}

console.log(`📁 التقارير محفوظة في: ${REPORTS_DIR}/\n`);
