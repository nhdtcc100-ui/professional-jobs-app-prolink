-- ==============================================================================
-- 📁 Supabase Query Name: 01_STORAGE_AND_MEDIA
-- 🚀 ProLink: إعداد التخزين وحل مشكلة رفع الصور والسيرة الذاتية (Storage & RLS)
-- ==============================================================================
-- تشغيل هذا الملف في Supabase:
-- Dashboard -> SQL Editor -> New Query -> الصق الكود هنا -> اضغط RUN
-- ==============================================================================

-- 1. التأكد من إنشاء مستودعات التخزين (Buckets) وجعلها عامة (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('profiles', 'profiles', true, 52428800, NULL),
  ('images', 'images', true, 52428800, NULL),
  ('resumes', 'resumes', true, 52428800, NULL),
  ('applications', 'applications', true, 52428800, NULL),
  ('job-images', 'job-images', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800;

-- 2. إزالة أي سياسات قديمة متعارضة على storage.objects
DROP POLICY IF EXISTS "Public View Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Public View Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Insert Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Update Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Delete Policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Insert Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Select Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Update Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update" ON storage.objects;

-- 3. تفعيل سياسات الوصول الشاملة لجميع مجلدات التخزين
-- القراءة والتحميل (SELECT)
CREATE POLICY "Prolink Public View Policy"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images')
);

-- الرفع (INSERT)
CREATE POLICY "Prolink Insert Policy"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images')
);

-- التحديث (UPDATE)
CREATE POLICY "Prolink Update Policy"
ON storage.objects FOR UPDATE
USING (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images')
);

-- الحذف (DELETE)
CREATE POLICY "Prolink Delete Policy"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images')
);

-- 4. التأكد من سماح جدول profiles بتحديث الصور والسير الذاتية
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Profiles Select" ON public.profiles;
CREATE POLICY "Public Profiles Select" ON public.profiles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles Update Policy" ON public.profiles;
CREATE POLICY "Profiles Update Policy" ON public.profiles
FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
CREATE POLICY "Profiles Insert Policy" ON public.profiles
FOR INSERT WITH CHECK (true);
