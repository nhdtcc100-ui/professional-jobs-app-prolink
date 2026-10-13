-- ==============================================================================
-- 🚀 ProLink: حل مشكلة رفع السيرة الذاتية والصور في Supabase Storage
-- ==============================================================================
-- قم بنسخ هذا الكود بالكامل وتشغيله في:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. التأكد من إنشاء مستودعات التخزين (Buckets) وجعلها عامة للقراءة
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('resumes', 'resumes', true, 52428800),
  ('applications', 'applications', true, 52428800),
  ('profiles', 'profiles', true, 52428800),
  ('job-images', 'job-images', true, 52428800),
  ('images', 'images', true, 52428800)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800;

-- 2. إزالة السياسات القديمة المتعارضة
DROP POLICY IF EXISTS "Public View Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Public View Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Insert Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Update Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Delete Policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Insert Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Select Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Update Resumes" ON storage.objects;

-- 3. تفعيل سياسات الوصول الشاملة (RLS) للسماح برفع السير الذاتية من الحاسوب والجوال

-- سياسة المشاهدة والتحميل (SELECT): متاحة للجميع
CREATE POLICY "Prolink Public View Policy"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('resumes', 'applications', 'profiles', 'job-images', 'images')
);

-- سياسة الرفع (INSERT): متاحة لجميع المستخدمين (المصادقين والضيوف)
CREATE POLICY "Prolink Insert Policy"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('resumes', 'applications', 'profiles', 'job-images', 'images')
);

-- سياسة التحديث (UPDATE)
CREATE POLICY "Prolink Update Policy"
ON storage.objects FOR UPDATE
USING (
  bucket_id IN ('resumes', 'applications', 'profiles', 'job-images', 'images')
);

-- سياسة الحذف (DELETE)
CREATE POLICY "Prolink Delete Policy"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('resumes', 'applications', 'profiles', 'job-images', 'images')
);

-- ✅ تم الإعداد بنجاح.
