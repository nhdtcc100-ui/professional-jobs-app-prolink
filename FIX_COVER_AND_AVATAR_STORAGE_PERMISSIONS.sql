-- ==============================================================================
-- 🚀 ProLink: حل جذري لصلاحيات رفع صور الغلاف والأفاتار والسير الذاتية
-- ==============================================================================
-- الخطوات:
-- 1. افتح لوحة تحكم Supabase Dashboard الخاصة بمشروعك
-- 2. اذهب إلى: SQL Editor -> New Query
-- 3. الصق هذا الكود واضغط Run (تشغيل)
-- ==============================================================================

-- 1. التأكد من وجود البكتات وجعلها عامة (Public) وتحديد أقصى حجم (50MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('profiles',     'profiles',     true, 52428800, NULL),
  ('images',       'images',       true, 52428800, NULL),
  ('resumes',      'resumes',      true, 52428800, NULL),
  ('applications', 'applications', true, 52428800, NULL),
  ('job-images',   'job-images',   true, 52428800, NULL),
  ('posts',        'posts',        true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- 2. تنظيف أي سياسات سابقة قد تمنع الرفع من الموبايل
DROP POLICY IF EXISTS "Prolink Public View Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Insert Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Update Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Delete Policy" ON storage.objects;
DROP POLICY IF EXISTS "prolink_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "prolink_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "prolink_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "prolink_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "Public View Profiles" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert Profiles" ON storage.objects;

-- 3. تفعيل سياسة القراءة العامة (لكي تظهر الصور وصور الغلاف لجميع المستخدمين والزوار)
CREATE POLICY "prolink_storage_select"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images', 'posts')
);

-- 4. تفعيل سياسة الرفع الشاملة (للمسجلين وطلبات الموبايل)
CREATE POLICY "prolink_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images', 'posts')
);

-- 5. تفعيل سياسة التعديل والاستبدال
CREATE POLICY "prolink_storage_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images', 'posts')
)
WITH CHECK (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images', 'posts')
);

-- 6. تفعيل سياسة الحذف
CREATE POLICY "prolink_storage_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images', 'posts')
);

-- 7. التأكد من أن جدول profiles يحتوي على عمود cover_url
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'cover_url'
    ) THEN 
        ALTER TABLE public.profiles ADD COLUMN cover_url TEXT; 
    END IF; 
END $$;

-- 8. التأكد من صلاحيات تحديث الملف الشخصي
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (true);

-- تأكيد النجاح
SELECT '✅ تم تطبيق جميع الصلاحيات بنجاح لرفع صور الغلاف والأفاتار والسير الذاتية!' AS status;
