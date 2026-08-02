/**
 * 🌱 سكربت توليد البيانات الضخمة (Advanced Seeding Script)
 * =========================================================
 * يضخ 1000 وظيفة + 1000 منشور في Supabase الإنتاجية
 * يستخدم ANON KEY (قراءة/كتابة حسب RLS) أو SERVICE_ROLE_KEY للكتابة الضخمة
 *
 * 🚀 كيفية التشغيل:
 *   node tests/load/seed-data.js
 *   أو: node tests/load/seed-data.js --dry-run   (معاينة بدون حفظ)
 *   أو: node tests/load/seed-data.js --clean      (حذف بيانات الاختبار أولاً)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────
// ⚙️  الإعدادات — غيّر SERVICE_ROLE_KEY إذا توفر
// ──────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL     || 'https://fwqeadonwddzvlyooeee.supabase.co';
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY  || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wTlOrKPwifHxBk_53Bk0BA__P6bJCPi';

const DRY_RUN = process.argv.includes('--dry-run');
const CLEAN   = process.argv.includes('--clean');

// ──────────────────────────────────────────────────────────
// 📊  ضبط الكميات
// ──────────────────────────────────────────────────────────
const JOBS_COUNT  = 1000;
const POSTS_COUNT = 1000;
const BATCH_SIZE  = 100;   // إدراج 100 سجل في كل مرة

// ──────────────────────────────────────────────────────────
// 🎲  بيانات التوليد
// ──────────────────────────────────────────────────────────
const JOB_TITLES = [
  'مهندس برمجيات أول','مطور واجهات أمامية','مطور خلفي','مهندس DevOps',
  'محلل أنظمة','مصمم UI/UX','مدير مشاريع تقنية','محلل بيانات',
  'مهندس شبكات','متخصص أمن معلومات','محاسب قانوني','مدير مالي',
  'أخصائي موارد بشرية','مستشار قانوني','مدير تسويق رقمي','أخصائي SEO',
  'مصمم جرافيك','مصوّر احترافي','مدرّس رياضيات','طبيب عام',
  'مهندس ميكانيكي','مهندس كهربائي','مهندس مدني','معماري',
];

const COMPANIES = [
  'شركة التقنية العراقية','مجموعة الإبداع الرقمي','شركة المستقبل للحلول',
  'النخبة للتجارة والاستثمار','الريادة المهنية','دار الكفاءات',
  'تك سوليوشنز العراق','بيت البرمجيات','مؤسسة الابتكار العربي',
  'الشركة العالمية للتقنية','مجموعة الأفق للأعمال','إنوفيت العراق',
];

const LOCATIONS = ['بغداد','البصرة','أربيل','الموصل','النجف','كربلاء','السليمانية','الديوانية','بابل','الرمادي'];

const JOB_TYPES = ['دوام كامل','دوام جزئي','عن بعد','هجين','مؤقت'];

const SKILLS = ['JavaScript','React','Node.js','Python','SQL','Docker','AWS','TypeScript','PHP','Laravel'];

const POST_THEMES = [
  'البرمجة والتطوير','التسويق الرقمي','إدارة الأعمال','ريادة الأعمال',
  'التعلم الآلي والذكاء الاصطناعي','التصميم الإبداعي','الموارد البشرية',
  'المحاسبة والمالية','الهندسة','القانون والتشريع',
];

const AUTHORS = [
  'أحمد محمد الشمري','سارة علي العبيدي','محمد حسن الكريمي',
  'فاطمة يوسف المحمودي','علي عبد الله الحسيني','زينب كريم العزاوي',
  'عمر خالد الجبوري','مريم سعد القيسي','حسين ناصر الطائي',
  'رنا قاسم البياتي','تامر إبراهيم الدليمي','نور الهدى الزبيدي',
];

// ──────────────────────────────────────────────────────────
// 🛠️  دوال مساعدة
// ──────────────────────────────────────────────────────────
const pick      = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand      = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randSalary = () => `${rand(300, 3000).toLocaleString('en-US')}$`;

function generateJob(index) {
  const skills = Array.from({ length: rand(2, 4) }, () => pick(SKILLS));
  return {
    title:       pick(JOB_TITLES),
    company:     `${pick(COMPANIES)} (${index + 1})`,
    description: `نبحث عن ${pick(JOB_TITLES)} موهوب للانضمام إلى فريقنا. ` +
                 `يُشترط الإلمام بـ ${skills.join('، ')}. ` +
                 `الخبرة المطلوبة: ${rand(1, 8)} سنوات. ` +
                 `بيئة عمل محترفة وراتب تنافسي.`,
    location:    pick(LOCATIONS),
    salary:      randSalary(),
    job_type:    pick(JOB_TYPES),
    is_active:   Math.random() > 0.1, // 90% نشطة
  };
}

function generatePost(index) {
  const theme = pick(POST_THEMES);
  return {
    content: `📢 مشاركة مهنية #${index + 1}\n\n` +
             `اليوم نتحدث عن مجال ${theme}. ` +
             `بعد ${rand(2, 15)} سنوات من الخبرة في هذا القطاع، وصلنا إلى استنتاج مهم: ` +
             `النجاح يتطلب الالتزام والتطوير المستمر. ` +
             `هل لديكم تجارب مشابهة؟ شاركونا في التعليقات! 💬\n\n` +
             `#العراق #${theme.replace(/ /g,'')} #ProLink`,
    author_name: pick(AUTHORS),
    likes_count: rand(0, 500),
  };
}

// ──────────────────────────────────────────────────────────
// 🔄  دالة الإدراج المجمّع
// ──────────────────────────────────────────────────────────
async function insertBatches(supabase, table, records, label) {
  let inserted = 0;
  const total  = records.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    if (DRY_RUN) {
      inserted += batch.length;
      process.stdout.write(`\r   [DRY-RUN] ${label}: ${inserted}/${total}`);
      continue;
    }

    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      console.error(`\n   ❌ خطأ في الدُفعة ${i / BATCH_SIZE + 1}: ${error.message}`);
      // نستمر رغم الخطأ لعدم إيقاف الجلسة بأكملها
    } else {
      inserted += batch.length;
    }

    process.stdout.write(`\r   ✅ ${label}: ${inserted}/${total}`);
    // تأخير صغير لتجنب rate-limiting
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(''); // سطر جديد
  return inserted;
}

// ──────────────────────────────────────────────────────────
// 🧹  دالة تنظيف بيانات الاختبار
// ──────────────────────────────────────────────────────────
async function cleanTestData(supabase) {
  console.log('\n🧹 تنظيف بيانات الاختبار القديمة...');

  const { error: je } = await supabase.from('jobs').delete().ilike('company', '%(%)');
  const { error: pe } = await supabase.from('posts').delete().ilike('content', '%#%');

  if (je) console.log(`   ⚠️  jobs: ${je.message}`);
  else     console.log('   ✅ تم حذف وظائف الاختبار');

  if (pe) console.log(`   ⚠️  posts: ${pe.message}`);
  else     console.log('   ✅ تم حذف منشورات الاختبار');
}

// ──────────────────────────────────────────────────────────
// 🚀  الدالة الرئيسية
// ──────────────────────────────────────────────────────────
async function main() {
  console.log(`
╔════════════════════════════════════════════════════╗
║   🌱 ProLink — سكربت حقن بيانات الاختبار          ║
╠════════════════════════════════════════════════════╣
║  الوجهة : ${SUPABASE_URL.slice(0, 40).padEnd(40)}║
║  الوضع  : ${(DRY_RUN ? '🔍 معاينة فقط (Dry Run)' : CLEAN ? '🧹 تنظيف ثم ضخ' : '💾 ضخ حقيقي').padEnd(40)}║
║  وظائف  : ${String(JOBS_COUNT).padEnd(40)}║
║  منشورات: ${String(POSTS_COUNT).padEnd(40)}║
║  دُفعات : ${String(BATCH_SIZE + ' سجل/دفعة').padEnd(40)}║
╚════════════════════════════════════════════════════╝
`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // اختبار الاتصال أولاً
  console.log('🔌 اختبار الاتصال بـ Supabase...');
  const { data: test, error: connErr } = await supabase.from('jobs').select('count').limit(1);
  if (connErr) {
    console.error(`\n❌ فشل الاتصال: ${connErr.message}`);
    console.log(`\n💡 تأكد من: 
   1. صحة VITE_SUPABASE_URL في ملف .env
   2. أن SUPABASE_KEY صحيح (ANON أو SERVICE_ROLE)
   3. أن جداول jobs و posts موجودة في قاعدة البيانات\n`);
    process.exit(1);
  }
  console.log('   ✅ الاتصال ناجح!\n');

  // تنظيف إذا طُلب
  if (CLEAN && !DRY_RUN) {
    await cleanTestData(supabase);
    console.log('');
  }

  const startTime = Date.now();

  // ── توليد الوظائف ──
  console.log(`📋 توليد ${JOBS_COUNT} وظيفة...`);
  const jobs  = Array.from({ length: JOBS_COUNT }, (_, i) => generateJob(i));
  const doneJobs = await insertBatches(supabase, 'jobs', jobs, 'وظائف');

  // ── توليد المنشورات ──
  console.log(`📝 توليد ${POSTS_COUNT} منشور...`);
  const posts = Array.from({ length: POSTS_COUNT }, (_, i) => generatePost(i));
  const donePosts = await insertBatches(supabase, 'posts', posts, 'منشورات');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── التقرير النهائي ──
  console.log(`
╔════════════════════════════════════════════════════╗
║   📊 تقرير الحقن النهائي                           ║
╠════════════════════════════════════════════════════╣
║  وظائف مُضافة  : ${String(doneJobs + ' / ' + JOBS_COUNT).padEnd(31)} ║
║  منشورات مُضافة: ${String(donePosts + ' / ' + POSTS_COUNT).padEnd(31)} ║
║  إجمالي السجلات: ${String(doneJobs + donePosts).padEnd(31)} ║
║  الوقت المستغرق: ${String(elapsed + ' ثانية').padEnd(31)} ║
╠════════════════════════════════════════════════════╣
║  ${DRY_RUN ? '🔍 Dry Run — لم يُحفظ أي شيء فعلياً          ' : '✅ البيانات جاهزة — ابدأ اختبار k6 الآن!      '} ║
╚════════════════════════════════════════════════════╝

🚀 الخطوة التالية:
   k6 run tests/load/smoke-test.js
   k6 run tests/load/load-test.js
   k6 run tests/load/stress-test.js
`);
}

main().catch((err) => {
  console.error('\n💥 خطأ غير متوقع:', err.message);
  process.exit(1);
});
