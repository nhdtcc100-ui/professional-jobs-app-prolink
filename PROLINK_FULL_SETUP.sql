-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ProLink FULL SETUP — انسخ هذا الملف بالكامل والصقه في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
-- الترتيب مهم — نفِّذ من الأعلى للأسفل دفعة واحدة

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: إضافة عمود is_admin لجدول profiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: إعداد RLS لجدول comments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all"  ON comments;
DROP POLICY IF EXISTS "comments_insert_own"  ON comments;
DROP POLICY IF EXISTS "comments_update_own"  ON comments;
DROP POLICY IF EXISTS "comments_delete_own"  ON comments;
DROP POLICY IF EXISTS "comments_admin_all"   ON comments;
DROP POLICY IF EXISTS "comments_admin_delete" ON comments;

CREATE POLICY "comments_select_all"
  ON comments FOR SELECT USING (true);

CREATE POLICY "comments_insert_own"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);

CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "comments_admin_delete"
  ON comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: RLS لجدول profiles (حماية is_admin من التعديل من العميل)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND is_admin = FALSE);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: جدول Rate Limiting
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   TEXT NOT NULL,
  ip_address   TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time
  ON login_attempts(identifier, attempted_at DESC);

CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: Auth Trigger — إنشاء profile تلقائياً عند التسجيل
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_name    TEXT;
  v_email   TEXT;
  v_phone   TEXT;
  v_avatar  TEXT;
BEGIN
  v_name   := COALESCE(
                TRIM(NEW.raw_user_meta_data->>'full_name'),
                TRIM(NEW.raw_user_meta_data->>'name'),
                SPLIT_PART(NEW.email, '@', 1),
                'مستخدم جديد'
              );
  v_email  := COALESCE(NEW.email, '');
  v_phone  := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL);

  INSERT INTO public.profiles (id, name, email, phone, avatar_url, role, is_pro, is_admin, bio)
  VALUES (NEW.id, v_name, v_email, v_phone, v_avatar, '', FALSE, FALSE, '')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT INSERT ON public.profiles TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6: ✅ منح صلاحية الأدمن لـ nhdtcc100@gmail.com
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE profiles
SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'nhdtcc100@gmail.com');

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 7: التحقق من النتائج
-- ─────────────────────────────────────────────────────────────────────────────

-- تحقق من RLS
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('comments', 'profiles', 'login_attempts');

-- تحقق من Trigger
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- تحقق من الأدمن  
SELECT p.email, p.name, p.is_admin
FROM profiles p
INNER JOIN auth.users u ON p.id = u.id
WHERE u.email = 'nhdtcc100@gmail.com';
