-- ================================================
-- seed.sql — بيانات اختبار الحمل لمنصة ProLink
-- يتم تنفيذه تلقائياً عند بدء حاوية PostgreSQL
-- ================================================

-- إنشاء جدول الوظائف
CREATE TABLE IF NOT EXISTS public.jobs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  description TEXT,
  location    TEXT,
  salary      TEXT,
  job_type    TEXT DEFAULT 'دوام كامل',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول المنشورات
CREATE TABLE IF NOT EXISTS public.posts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content     TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_id   TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- إنشاء جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'jobseeker',
  location   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- إنشاء Role مجهول للقراءة
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.jobs TO anon;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.profiles TO anon;

-- ================================================
-- ضخ 5,000 وظيفة وهمية
-- ================================================
INSERT INTO public.jobs (title, company, description, location, salary, job_type, is_active)
SELECT
  'وظيفة ' || s || ' - ' || (ARRAY['مهندس برمجيات','محاسب','مدير مشاريع','مصمم جرافيك','محلل بيانات','مطور ويب','مدير موارد بشرية','مستشار قانوني'])[1 + (s % 8)],
  'شركة ' || (ARRAY['التقنية العراقية','الإبداع الرقمي','المستقبل للحلول','النخبة التجارية','الريادة المهنية'])[1 + (s % 5)] || ' ' || s,
  'نبحث عن كفاءات متميزة للانضمام إلى فريقنا المهني. يتطلب الخبرة في المجال ومهارات التواصل الفعّال.',
  (ARRAY['بغداد','البصرة','أربيل','الموصل','النجف','كربلاء','السليمانية'])[1 + (s % 7)],
  (500 + (s * 17 % 2000))::TEXT || '$',
  (ARRAY['دوام كامل','دوام جزئي','عن بعد','هجين'])[1 + (s % 4)],
  (s % 10 != 0) -- 90% نشطة
FROM generate_series(1, 5000) AS s;

-- ================================================
-- ضخ 5,000 منشور وهمي
-- ================================================
INSERT INTO public.posts (content, author_name, author_id, likes_count)
SELECT
  'هذا منشور مهني رقم ' || s || '. نشارككم اليوم تجربتنا في مجال ' ||
  (ARRAY['البرمجة','التسويق الرقمي','إدارة الأعمال','القانون','الطب','الهندسة','التصميم'])[1 + (s % 7)] ||
  '. نأمل أن يستفيد منه الجميع ويساهم في تطوير المجتمع المهني العراقي.',
  (ARRAY['أحمد محمد','سارة علي','محمد حسن','فاطمة يوسف','علي عبد الله','زينب كريم','عمر خالد'])[1 + (s % 7)] || ' ' || s,
  gen_random_uuid()::TEXT,
  (s * 13 % 500)
FROM generate_series(1, 5000) AS s;

-- ================================================
-- ضخ 2,000 ملف شخصي وهمي
-- ================================================
INSERT INTO public.profiles (name, role, location)
SELECT
  (ARRAY['أحمد','محمد','علي','عمر','خالد','يوسف','سعد','كريم','حسن','عبد الله'])[1 + (s % 10)] ||
  ' ' ||
  (ARRAY['الشمري','العبيدي','الكريمي','المحمودي','الحسيني','العزاوي','الجبوري','القيسي'])[1 + (s % 8)],
  (ARRAY['jobseeker','employer'])[1 + (s % 2)],
  (ARRAY['بغداد','البصرة','أربيل','الموصل','النجف'])[1 + (s % 5)]
FROM generate_series(1, 2000) AS s;

-- فهرسة للأداء
CREATE INDEX IF NOT EXISTS idx_jobs_active ON public.jobs (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts (created_at DESC);

SELECT 'تم ضخ البيانات بنجاح! 5000 وظيفة + 5000 منشور + 2000 ملف شخصي' AS status;
