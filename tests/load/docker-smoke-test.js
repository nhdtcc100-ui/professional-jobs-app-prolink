/**
 * 🏆 Professional Docker Load Test — ProLink Platform
 * =================================================
 * نظام محاكاة احترافي يشمل توزيع الأحمال وفحص البيانات
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 📊 المقاييس المخصصة
const errorRate = new Rate('errors');
const jobsTrend = new Trend('api_jobs_duration');
const postsTrend = new Trend('api_posts_duration');
const profilesTrend = new Trend('api_profiles_duration');

// ⚙️ الإعدادات
const BASE_URL = 'http://rest:3000';
const HEADERS = { 'Content-Type': 'application/json' };

export const options = {
  stages: [
    { duration: '1m',  target: 100  }, // صعود تدريجي لـ 100 مستخدم
    { duration: '2m',  target: 500  }, // صعود لـ 500
    { duration: '5m',  target: 1000 }, // ثبات عند 1000 مستخدم (Peak Load)
    { duration: '2m',  target: 0    }, // نزول تدريجي
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500'], // 95% من الطلبات يجب أن تكون أسرع من 1.5 ثانية
    'errors': ['rate<0.05'],            // معدل الأخطاء أقل من 5%
  },
};

// 🏠 السيناريو الأساسي
export default function () {
  const prob = Math.random();

  if (prob < 0.5) {
    // 1️⃣ تصفح الوظائف (50% من المستخدمين)
    group('Browse Jobs', function () {
      const res = http.get(`${BASE_URL}/jobs?select=id,title,company,location&is_active=eq.true&limit=20&order=created_at.desc`, { headers: HEADERS });
      const ok = check(res, {
        'jobs status is 200': (r) => r.status === 200,
        'jobs list not empty': (r) => JSON.parse(r.body).length > 0,
      });
      errorRate.add(!ok);
      jobsTrend.add(res.timings.duration);
    });
  } 
  else if (prob < 0.8) {
    // 2️⃣ قراءة المنشورات (30% من المستخدمين)
    group('Read Social Feed', function () {
      const res = http.get(`${BASE_URL}/posts?select=id,content,author_name&limit=15&order=created_at.desc`, { headers: HEADERS });
      const ok = check(res, {
        'posts status is 200': (r) => r.status === 200,
      });
      errorRate.add(!ok);
      postsTrend.add(res.timings.duration);
    });
  } 
  else {
    // 3️⃣ البحث في الملفات الشخصية (20% من المستخدمين)
    group('Search Profiles', function () {
      const res = http.get(`${BASE_URL}/profiles?select=id,name,role&limit=10`, { headers: HEADERS });
      const ok = check(res, {
        'profiles status is 200': (r) => r.status === 200,
      });
      errorRate.add(!ok);
      profilesTrend.add(res.timings.duration);
    });
  }

  // وقت تفكير عشوائي بين 1.5 و 3 ثواني
  sleep(1.5 + Math.random() * 1.5);
}

// 📦 تصدير التقرير النهائي
export function handleSummary(data) {
  return {
    '/reports/docker-smoke-report.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// دالة مساعدة لتوليد ملخص نصي في stdout (تعمل تلقائياً في k6)
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
