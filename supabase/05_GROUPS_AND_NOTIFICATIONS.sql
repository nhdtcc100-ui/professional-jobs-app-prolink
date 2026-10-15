-- ==============================================================================
-- 📁 Supabase Query Name: 05_GROUPS_AND_NOTIFICATIONS
-- 🚀 ProLink: المجموعات، التنبيهات، وحل خطأ 500 المتكرر (Groups & Notifications)
-- ==============================================================================

-- ─── 1. جدول المجموعات (groups) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar_url TEXT,
  is_private BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'عام',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. جدول أعضاء المجموعات (group_members) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'accepted',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ربط العلاقة الخارجية لتمكين الاستعلامات المتداخلة (PostgREST Join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'group_members_group_id_fkey'
  ) THEN
    ALTER TABLE public.group_members
      ADD CONSTRAINT group_members_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_all"    ON public.groups;
DROP POLICY IF EXISTS "groups_insert_auth"   ON public.groups;
DROP POLICY IF EXISTS "groups_update_owner"  ON public.groups;
DROP POLICY IF EXISTS "groups_delete_owner"  ON public.groups;
DROP POLICY IF EXISTS "members_select"       ON public.group_members;
DROP POLICY IF EXISTS "members_insert_auth"  ON public.group_members;
DROP POLICY IF EXISTS "members_update_owner" ON public.group_members;
DROP POLICY IF EXISTS "members_delete_auth"  ON public.group_members;

-- ✅ الحل الجذري لمنع خطأ 500 (Infinite Recursion):
-- السياسة مباشرة وخالية من أي استعلام دائري داخل نفس الجدول
CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── 3. جدول التنبيهات (notifications) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    from_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = from_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
