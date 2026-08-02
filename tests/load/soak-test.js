/**
 * 🕐 Soak Test — اختبار الديمومة (6 ساعات)
 * الهدف: كشف تسرب الذاكرة وتدهور الأداء مع الوقت
 * كيف تشغله: k6 run tests/load/soak-test.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const SUPABASE_URL = 'https://fwqeadonwddzvlyooeee.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wTlOrKPwifHxBk_53Bk0BA__P6bJCPi';

// نتابع الأداء على مدار الزمن
const responseOverTime = new Trend('response_over_time');
const errorOverTime    = new Rate('error_over_time');

export const options = {
  stages: [
    { duration: '5m',   target: 200 },   // ارتفاع
    { duration: '6h',   target: 200 },   // تثبيت 6 ساعات ← هنا تكشف المشاكل
    { duration: '5m',   target: 0   },   // هبوط
  ],
  thresholds: {
    http_req_duration:  ['p(95)<3000'],
    http_req_failed:    ['rate<0.01'],
    response_over_time: ['p(95)<3000'],
  },
};

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

export default function () {
  // دورة تصفح كاملة
  const jobsRes = http.get(
    `${SUPABASE_URL}/rest/v1/jobs?select=id,title,company&limit=10`,
    { headers: HEADERS }
  );
  const ok = check(jobsRes, { 'OK': (r) => r.status === 200 });
  responseOverTime.add(jobsRes.timings.duration);
  errorOverTime.add(!ok);

  sleep(3);

  const postsRes = http.get(
    `${SUPABASE_URL}/rest/v1/posts?select=id,content&limit=10`,
    { headers: HEADERS }
  );
  check(postsRes, { 'Posts OK': (r) => r.status === 200 });

  sleep(5 + Math.random() * 5); // يقرأ لمدة 5-10 ثواني
}

export function handleSummary(data) {
  return {
    'tests/load/reports/soak-test-report.json': JSON.stringify(data, null, 2),
  };
}
