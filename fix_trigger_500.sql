-- ═══════════════════════════════════════════════════════════════
-- 🔧 FIX: تشخيص وإصلاح مشكلة 500 عند إنشاء الحساب
-- انسخ هذا الملف كله والصقه في Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── STEP 1: تشخيص — معرفة أعمدة جدول profiles الفعلية ───────
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ─── STEP 2: إصلاح الـ Trigger ليكون آمناً بالكامل ───────────
-- يستخدم EXCEPTION handler لمنعه من تعطيل الـ signup حتى لو فشل الإدراج

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
  -- استخلاص البيانات بشكل آمن
  v_name   := COALESCE(
                NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
                NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
                NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
                'مستخدم'
              );

  v_email  := COALESCE(NEW.email, '');
  v_phone  := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_avatar := NEW.raw_user_meta_data->>'avatar_url';

  -- إدراج آمن مع معالجة كاملة للأخطاء
  BEGIN
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
      '',        -- role فارغ → شاشة اختيار الدور
      FALSE,
      FALSE,
      ''
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- سجّل الخطأ لكن لا تُفشل الـ signup
      RAISE WARNING 'handle_new_user: failed to create profile for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─── STEP 3: إعادة ربط الـ Trigger ───────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── STEP 4: منح الصلاحيات اللازمة ──────────────────────────
GRANT USAGE ON SCHEMA public TO service_role;
GRANT INSERT, SELECT ON public.profiles TO service_role;

-- ─── STEP 5: تحقق من نجاح الإعداد ───────────────────────────
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
