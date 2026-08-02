/**
 * 💥 Stress Test — حتى 10,000 مستخدم
 * الهدف: إيجاد نقطة الكسر (Breaking Point)
 * كيف تشغله: k6 run tests/load/stress-test.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const dbResponseTime = new Trend('db_response_time');

const SUPABASE_URL = 'https://fwqeadonwddzvlyooeee.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wTlOrKPwifHxBk_53Bk0BA__P6bJCPi';

export const options = {
  stages: [
    { duration: '2m',  target: 500   },
    { duration: '3m',  target: 1000  },
    { duration: '3m',  target: 2500  },
    { duration: '3m',  target: 5000  },   // ← نقطة الضغط العالية
    { duration: '3m',  target: 7500  },   // ← هل تتحمل؟
    { duration: '5m',  target: 10000 },   // ← الحد الأقصى المطلوب
    { duration: '5m',  target: 10000 },   // تثبيت لفحص الاستقرار
    { duration: '3m',  target: 0     },   // هبوط تدريجي
  ],
  thresholds: {
    // عند 10,000 مستخدم — معايير أكثر مرونة
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
    http_req_failed:   ['rate<0.05'],   // أقل من 5% أخطاء
    errors:            ['rate<0.10'],   // أقل من 10% (هامش الاختبار الشديد)
  },
};

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export default function () {
  // محاكاة مبسّطة لتحقيق أقصى عدد من الطلبات المتزامنة
  const endpoints = [
    `${SUPABASE_URL}/rest/v1/jobs?select=id,title,company&limit=10&is_active=eq.true`,
    `${SUPABASE_URL}/rest/v1/posts?select=id,content,author_name&limit=10`,
    `${SUPABASE_URL}/rest/v1/profiles?select=id,name,role&limit=10`,
  ];

  // كل مستخدم يطلب endpoint عشوائي
  const url = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(url, {
    headers: HEADERS,
    tags: { stress: 'true' },
  });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'no timeout': (r) => r.timings.duration < 10000,
  });

  dbResponseTime.add(res.timings.duration);
  errorRate.add(!ok);

  // تأخير قصير جداً = أقصى ضغط
  sleep(0.1 + Math.random() * 0.5);
}

export function handleSummary(data) {
  const p95   = data.metrics.http_req_duration?.values?.['p(95)']  || 0;
  const p99   = data.metrics.http_req_duration?.values?.['p(99)']  || 0;
  const errs  = (data.metrics.http_req_failed?.values?.rate || 0) * 100;
  const reqs  = data.metrics.http_reqs?.values?.count || 0;
  const rps   = data.metrics.http_reqs?.values?.rate  || 0;

  const verdict = errs < 1
    ? '🟢 ممتاز — التطبيق يتحمل الضغط'
    : errs < 5
    ? '🟡 مقبول — يحتاج تحسينات'
    : '🔴 فشل — يحتاج ترقية فورية';

  console.log(`\n════════════════════════════════════`);
  console.log(`  📊 تقرير اختبار الضغط`);
  console.log(`════════════════════════════════════`);
  console.log(`  الحكم: ${verdict}`);
  console.log(`  إجمالي الطلبات: ${reqs.toLocaleString()}`);
  console.log(`  معدل الطلبات/ثانية: ${rps.toFixed(0)} RPS`);
  console.log(`  زمن الاستجابة p95: ${p95.toFixed(0)}ms`);
  console.log(`  زمن الاستجابة p99: ${p99.toFixed(0)}ms`);
  console.log(`  معدل الأخطاء: ${errs.toFixed(2)}%`);
  console.log(`════════════════════════════════════\n`);

  return {
    'tests/load/reports/stress-test-report.json': JSON.stringify(data, null, 2),
  };
}
