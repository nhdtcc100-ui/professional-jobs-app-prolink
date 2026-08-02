-- ============================================================
-- 🔒 ProLink Security SQL — تنفيذ في Supabase SQL Editor
-- ============================================================
-- الترتيب مهم: تنفيذ من الأعلى للأسفل

-- ─────────────────────────────────────────────────────────────
-- SECTION 1: نظام الأدمن الاحترافي (Admin Role System)
-- ─────────────────────────────────────────────────────────────

-- 1.1 إضافة عمود is_admin إلى جدول profiles (إذا لم يكن موجوداً)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 1.2 منح صلاحية الأدمن لحسابك (استبدل بالـ UUID الصحيح)
-- للحصول على UUID: auth.users → ابحث عن حسابك في Supabase Dashboard
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR-ADMIN-UUID-HERE';

-- 1.3 سياسة RLS: المستخدم لا يمكنه رفع نفسه أدمناً
-- (تضمن نقطة 1.2 هي الطريقة الوحيدة لمنح الصلاحية)


-- ─────────────────────────────────────────────────────────────
-- SECTION 2: RLS للتعليقات (Comments Table Security)
-- ─────────────────────────────────────────────────────────────

-- 2.0 تأكد من وجود عمود author_id في جدول comments
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;

-- 2.1 تفعيل Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 2.2 حذف السياسات القديمة (لتجنب التعارض)
DROP POLICY IF EXISTS "comments_select_all" ON comments;
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
DROP POLICY IF EXISTS "comments_update_own" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
DROP POLICY IF EXISTS "comments_admin_all" ON comments;

-- 2.3 أي مستخدم (حتى غير موثّق) يستطيع قراءة التعليقات
CREATE POLICY "comments_select_all"
  ON comments FOR SELECT
  USING (true);

-- 2.4 فقط المستخدم الموثّق يضيف تعليقاً باسم نفسه
CREATE POLICY "comments_insert_own"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = author_id
  );

-- 2.5 المستخدم يعدّل فقط تعاليقه الخاصة
CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- 2.6 المستخدم يحذف فقط تعاليقه الخاصة
CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  USING (auth.uid() = author_id);

-- 2.7 الأدمن يستطيع حذف أي تعليق (مشرف المحتوى)
CREATE POLICY "comments_admin_delete"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );


-- ─────────────────────────────────────────────────────────────
-- SECTION 3: حماية عمود is_admin من التعديل من العميل
-- ─────────────────────────────────────────────────────────────

-- تأكد من تفعيل RLS على profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- أي شخص يقرأ الملفات الشخصية
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  USING (true);

-- المستخدم يعدّل ملفه الشخصي فقط، لكن لا يستطيع رفع is_admin
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- ⛔  يمنع تغيير is_admin من true→false أو العكس عبر الـ client
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- المستخدم يضيف ملفه الشخصي مرة واحدة، بدون admin
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND is_admin = FALSE  -- لا يمكن التسجيل كأدمن
  );


-- ─────────────────────────────────────────────────────────────
-- SECTION 4: Rate Limiting على مستوى Supabase (PostgreSQL)
-- ─────────────────────────────────────────────────────────────

-- جدول لتتبع محاولات الدخول الفاشلة على مستوى البيكند
CREATE TABLE IF NOT EXISTS login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   TEXT NOT NULL,          -- email أو phone hash
  ip_address   TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success      BOOLEAN NOT NULL DEFAULT FALSE
);

-- index لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time
  ON login_attempts(identifier, attempted_at DESC);

-- تنظيف السجلات القديمة (أكثر من 24 ساعة) تلقائيًا
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- SECTION 5: فحص صحة البيانات
-- ─────────────────────────────────────────────────────────────

-- تحقق من أن RLS مُفعَّل
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('comments', 'profiles', 'login_attempts');

-- تحقق من السياسات المنشأة
SELECT policyname, tablename, cmd, qual
FROM pg_policies
WHERE tablename IN ('comments', 'profiles');

-- ─────────────────────────────────────────────────────────────
-- SECTION 6: منح صلاحية الأدمن (استخدم هذا الأمر)
-- ─────────────────────────────────────────────────────────────
--
-- للعثور على UUID المستخدم:
-- SELECT id, email FROM auth.users WHERE email = 'your@email.com';
--
-- لمنح صلاحية الأدمن:
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'PASTE-UUID-HERE';
--
-- للتحقق:
-- SELECT id, name, email, is_admin FROM profiles WHERE is_admin = TRUE;
--
-- لسحب الصلاحية:
-- UPDATE profiles SET is_admin = FALSE WHERE id = 'PASTE-UUID-HERE';
-- ─────────────────────────────────────────────────────────────
