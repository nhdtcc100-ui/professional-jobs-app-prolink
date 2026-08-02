/**
 * 🏋️ Load Test — 1,000 مستخدم متزامن
 * الهدف: محاكاة الحمل الطبيعي اليومي
 * كيف تشغله: k6 run tests/load/load-test.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const applyJobDuration = new Trend('apply_job_duration');
const successfulApplications = new Counter('successful_applications');

const SUPABASE_URL = 'https://fwqeadonwddzvlyooeee.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wTlOrKPwifHxBk_53Bk0BA__P6bJCPi';

export const options = {
  stages: [
    { duration: '2m', target: 100  },   // ارتفاع تدريجي → 100
    { duration: '3m', target: 500  },   // ارتفاع → 500
    { duration: '5m', target: 1000 },   // الذروة → 1000
    { duration: '3m', target: 1000 },   // تثبيت عند 1000
    { duration: '2m', target: 0    },   // هبوط تدريجي
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.01'],
    errors:            ['rate<0.01'],
  },
};

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

// ───── سيناريوهات المستخدمين ─────────────────────────────────────

function browseFeed() {
  group('📰 تصفح الصفحة الرئيسية', () => {
    const postsRes = http.get(
      `${SUPABASE_URL}/rest/v1/posts?select=*&limit=10&order=created_at.desc`,
      { headers: HEADERS, tags: { name: 'get-posts' } }
    );
    check(postsRes, { 'Posts 200': (r) => r.status === 200 });
    sleep(2 + Math.random() * 3); // يقرأ لمدة 2-5 ثواني
  });
}

function browseJobs() {
  group('💼 تصفح الوظائف', () => {
    const jobsRes = http.get(
      `${SUPABASE_URL}/rest/v1/jobs?select=*&is_active=eq.true&limit=20&order=created_at.desc`,
      { headers: HEADERS, tags: { name: 'get-jobs' } }
    );
    check(jobsRes, { 'Jobs 200': (r) => r.status === 200 });

    if (jobsRes.status === 200) {
      const jobs = JSON.parse(jobsRes.body);
      if (jobs.length > 0) {
        // يفتح تفاصيل وظيفة عشوائية
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        sleep(1);
        const detailRes = http.get(
          `${SUPABASE_URL}/rest/v1/jobs?id=eq.${job.id}&select=*`,
          { headers: HEADERS, tags: { name: 'get-job-detail' } }
        );
        check(detailRes, { 'Job detail 200': (r) => r.status === 200 });
      }
    }
    sleep(1 + Math.random() * 2);
  });
}

function viewProfile() {
  group('👤 عرض ملف شخصي', () => {
    const profilesRes = http.get(
      `${SUPABASE_URL}/rest/v1/profiles?select=*&limit=5`,
      { headers: HEADERS, tags: { name: 'get-profiles' } }
    );
    check(profilesRes, { 'Profiles 200': (r) => r.status === 200 });
    sleep(1 + Math.random() * 2);
  });
}

function searchContent() {
  group('🔍 البحث', () => {
    const terms = ['مهندس', 'محاسب', 'مطور', 'مدير', 'معلم', 'بغداد', 'أربيل'];
    const term = terms[Math.floor(Math.random() * terms.length)];

    const searchRes = http.get(
      `${SUPABASE_URL}/rest/v1/jobs?title=ilike.*${encodeURIComponent(term)}*&select=id,title,company,location`,
      { headers: HEADERS, tags: { name: 'search' } }
    );
    check(searchRes, { 'Search 200': (r) => r.status === 200 });
    sleep(1);
  });
}

// ───── الدالة الرئيسية ─────────────────────────────────────────────
export default function () {
  const rand = Math.random();

  if (rand < 0.40) {
    // 40% — يتصفح المنشورات
    browseFeed();
  } else if (rand < 0.65) {
    // 25% — يتصفح الوظائف
    browseJobs();
  } else if (rand < 0.80) {
    // 15% — يفتح ملف شخصي
    viewProfile();
  } else if (rand < 0.95) {
    // 15% — يبحث
    searchContent();
  } else {
    // 5% — يتصفح مزيجاً
    browseFeed();
    browseJobs();
  }
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const errorPct = (data.metrics.http_req_failed?.values?.rate || 0) * 100;

  console.log(`\n📊 ملخص اختبار الحمل:`);
  console.log(`   زمن الاستجابة p95: ${p95.toFixed(0)}ms`);
  console.log(`   معدل الأخطاء: ${errorPct.toFixed(2)}%`);
  console.log(`   إجمالي الطلبات: ${data.metrics.http_reqs?.values?.count || 0}`);

  return {
    'tests/load/reports/load-test-report.json': JSON.stringify(data, null, 2),
  };
}
