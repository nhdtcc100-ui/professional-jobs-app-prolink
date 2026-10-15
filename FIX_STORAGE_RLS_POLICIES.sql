-- ==============================================================================
-- ProLink: اصلاح شامل لسياسات Storage RLS + تفعيل Buckets
-- ==============================================================================
-- شغّل هذا الكود في: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. انشاء/تحديث Buckets وجعلها عامة
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('profiles',     'profiles',     true, 52428800, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif','image/bmp','application/pdf']),
  ('resumes',      'resumes',      true, 52428800, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('applications', 'applications', true, 52428800, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('job-images',   'job-images',   true, 52428800, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('images',       'images',       true, 52428800, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('posts',        'posts',        true, 104857600, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. حذف جميع السياسات القديمة المتعارضة
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- 3. انشاء السياسات مباشرة (RLS مفعّل مسبقاً على storage.objects في Supabase)

-- 4. سياسة المشاهدة/التنزيل - متاح للجميع
CREATE POLICY "prolink_storage_select"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('profiles', 'resumes', 'applications', 'job-images', 'images', 'posts')
);

-- 5. سياسة الرفع - للمستخدمين المسجلين فقط
CREATE POLICY "prolink_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('profiles', 'resumes', 'applications', 'job-images', 'images', 'posts')
  AND auth.role() = 'authenticated'
);

-- 6. سياسة التحديث
CREATE POLICY "prolink_storage_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id IN ('profiles', 'resumes', 'applications', 'job-images', 'images', 'posts')
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id IN ('profiles', 'resumes', 'applications', 'job-images', 'images', 'posts')
  AND auth.role() = 'authenticated'
);

-- 7. سياسة الحذف
CREATE POLICY "prolink_storage_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('profiles', 'resumes', 'applications', 'job-images', 'images', 'posts')
  AND auth.role() = 'authenticated'
);

-- 8. اصلاح سياسات جدول profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- 9. للتحقق
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects')
   OR (schemaname = 'public' AND tablename = 'profiles')
ORDER BY schemaname, tablename, policyname;
