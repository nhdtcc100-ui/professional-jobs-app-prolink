-- ==============================================================================
-- 📁 Supabase Query Name: 02_PROFILES_AND_ROLES
-- 🚀 ProLink: الملفات الشخصية، الأدوار، العمل الحر، والأدمن (Profiles & Roles)
-- ==============================================================================

-- 1. إضافة كافة الأعمدة المحدثة لجدول profiles
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS display_title TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS freelancer_type TEXT; -- 'technician' | 'client'
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS specialty TEXT;       -- تخصص الفني
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS service_request TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS company_bio TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS has_erp_access BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS has_support_access BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS has_calls_access BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- 2. تحديث قيد الأدوار role ليشمل العمل الحر (freelancer)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('seeker', 'employer', 'freelancer', 'admin', ''));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. فهارس السرعة
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_freelancer_type ON public.profiles(freelancer_type);
CREATE INDEX IF NOT EXISTS idx_profiles_specialty ON public.profiles(specialty);
CREATE INDEX IF NOT EXISTS idx_profiles_is_available ON public.profiles(is_available);

-- 4. جدول طلبات تغيير نوع الحساب (role_change_requests)
CREATE TABLE IF NOT EXISTS public.role_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT,
    user_avatar TEXT,
    current_role TEXT NOT NULL,
    requested_role TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.role_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_req_select" ON public.role_change_requests;
DROP POLICY IF EXISTS "role_req_insert" ON public.role_change_requests;
DROP POLICY IF EXISTS "role_req_update" ON public.role_change_requests;

CREATE POLICY "role_req_select" ON public.role_change_requests
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "role_req_insert" ON public.role_change_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "role_req_update" ON public.role_change_requests
  FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 5. تفعيل صلاحيات الأدمن على حساب الإدارة
UPDATE public.profiles
SET 
  is_admin = TRUE,
  has_erp_access = TRUE,
  has_support_access = TRUE,
  has_calls_access = TRUE,
  is_pro = TRUE
WHERE email ILIKE '%nhdtcc100@gmail.com%';

-- 6. تريجر إنشاء الحسابات الجديدة
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_name      TEXT;
  v_email     TEXT;
  v_phone     TEXT;
  v_avatar    TEXT;
  v_is_admin  BOOLEAN;
BEGIN
  v_email  := COALESCE(NEW.email, '');
  v_name   := COALESCE(
                TRIM(NEW.raw_user_meta_data->>'full_name'),
                TRIM(NEW.raw_user_meta_data->>'name'),
                SPLIT_PART(v_email, '@', 1),
                'مستخدم جديد'
              );
  v_phone  := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL);
  
  IF LOWER(v_email) = 'nhdtcc100@gmail.com' THEN
    v_is_admin := TRUE;
  ELSE
    v_is_admin := FALSE;
  END IF;

  INSERT INTO public.profiles (
    id, name, email, phone, avatar_url, role, 
    is_pro, is_admin, is_active, has_calls_access, 
    has_erp_access, has_support_access, bio
  )
  VALUES (
    NEW.id, v_name, v_email, v_phone, v_avatar, 'seeker', 
    v_is_admin, v_is_admin, TRUE, TRUE, 
    v_is_admin, v_is_admin, ''
  )
  ON CONFLICT (id) DO UPDATE SET
    is_admin = EXCLUDED.is_admin,
    has_erp_access = EXCLUDED.has_erp_access,
    has_support_access = EXCLUDED.has_support_access,
    is_pro = EXCLUDED.is_pro;

  RETURN NEW;
END;
$$;
