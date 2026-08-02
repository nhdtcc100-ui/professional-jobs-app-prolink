-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 ProLink Auth Trigger — نفِّذ هذا الملف في Supabase SQL Editor
--   Dashboard → SQL Editor → New Query → Paste & Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: دالة إنشاء الـ Profile التلقائي
--   SECURITY DEFINER = تعمل بصلاحيات postgres لتجاوز RLS
--   search_path = 'public' = حماية من Path injection
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
  -- استخلاص البيانات من user_metadata (البيانات التي أرسلها العميل عند التسجيل)
  v_name   := COALESCE(
                TRIM(NEW.raw_user_meta_data->>'full_name'),
                TRIM(NEW.raw_user_meta_data->>'name'),
                SPLIT_PART(NEW.email, '@', 1),
                'مستخدم جديد'
              );

  v_email  := COALESCE(NEW.email, '');
  v_phone  := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL);

  -- إنشاء profile
  -- role = NULL → سيُوجَّه المستخدم لشاشة اختيار الدور بعد تأكيد البريد
  -- is_admin = FALSE → لا يمكن لأي مستخدم أن يُعيِّن نفسه أدمناً
  INSERT INTO public.profiles (
    id,
    name,
    email,
    phone,
    avatar_url,
    role,
    is_pro,
    is_admin,
    bio
  )
  VALUES (
    NEW.id,
    v_name,
    v_email,
    v_phone,
    v_avatar,
    '',         -- ← سلسلة فارغة عمداً → يُظهر شاشة اختيار الدور وطبقاً للتوافقية
    FALSE,
    FALSE,      -- ← is_admin دائماً false عند الإنشاء التلقائي
    ''
  )
  ON CONFLICT (id) DO NOTHING; -- آمن: لا يُعيد الكتابة إذا كان موجوداً

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: ربط الدالة بجدول auth.users
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: منح صلاحيات الكتابة للدالة على جدول profiles
-- ─────────────────────────────────────────────────────────────────────────────
GRANT INSERT ON public.profiles TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: تحديث RLS سياسة الـ profiles_update_own
--   لتسمح بتحديث الـ role (لأن المستخدم سيختار دوره لاحقاً)
--   مع الحفاظ على حماية is_admin
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- ⛔ يمنع تغيير is_admin من العميل
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

-- تأكد من أن الـ insert policy تسمح بـ role = NULL
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND is_admin = FALSE  -- ← لا يمكن التسجيل كأدمن
    -- role يمكن أن يكون NULL (يستكمل لاحقاً) أو أي قيمة مشروعة
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: التحقق من نجاح الإعداد
-- ─────────────────────────────────────────────────────────────────────────────

-- تحقق أن الـ trigger موجود
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- تحقق أن الدالة موجودة
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public';

-- تحقق من سياسات RLS على profiles
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- ملاحظات مهمة:
-- 1. تأكد من تفعيل Email Confirmation في:
--    Authentication → Settings → Email → Confirm email = ON
-- 2. بعد تأكيد البريد، onAuthStateChange يُطلَق تلقائياً
-- 3. getProfile() سيجد الـ profile (role=NULL) → needsRole=true → شاشة الاختيار
-- ─────────────────────────────────────────────────────────────────────────────
