-- ==============================================================================
-- 📁 Supabase Query Name: 00_PROLINK_ALL_IN_ONE_MASTER
-- 🚀 ProLink: السكريبت الماستر الشامل والنهائي لكافة جداول وتخزين وبث التطبيق
-- ==============================================================================
-- هذا السكريبت يجمع كافة الأقسام (01 إلى 06) في ملف واحد مرتب ومتناسق،
-- خالي من أي تعارضات أو استعلامات دائرية، ويصلح كل مشاكل الرفع والبث اللحظي.
-- ==============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. مستودعات التخزين والصور والسير الذاتية (Storage & Media)
-- ══════════════════════════════════════════════════════════════════════════════
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

CREATE POLICY "Prolink Public View Policy" ON storage.objects FOR SELECT
USING (bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images'));

CREATE POLICY "Prolink Insert Policy" ON storage.objects FOR INSERT
WITH CHECK (bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images'));

CREATE POLICY "Prolink Update Policy" ON storage.objects FOR UPDATE
USING (bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images'));

CREATE POLICY "Prolink Delete Policy" ON storage.objects FOR DELETE
USING (bucket_id IN ('profiles', 'images', 'resumes', 'applications', 'job-images'));


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. الملفات الشخصية، الأدوار، العمل الحر، والأدمن (Profiles & Roles)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS display_title TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS freelancer_type TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS specialty TEXT;
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('seeker', 'employer', 'freelancer', 'admin', ''));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_freelancer_type ON public.profiles(freelancer_type);
CREATE INDEX IF NOT EXISTS idx_profiles_specialty ON public.profiles(specialty);
CREATE INDEX IF NOT EXISTS idx_profiles_is_available ON public.profiles(is_available);

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Profiles Select" ON public.profiles;
CREATE POLICY "Public Profiles Select" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles Update Policy" ON public.profiles;
CREATE POLICY "Profiles Update Policy" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
CREATE POLICY "Profiles Insert Policy" ON public.profiles FOR INSERT WITH CHECK (true);

-- جدول طلبات تغيير نوع الحساب
CREATE TABLE IF NOT EXISTS public.role_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT,
    user_avatar TEXT,
    from_role TEXT NOT NULL,
    requested_role TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.role_change_requests ADD COLUMN IF NOT EXISTS from_role TEXT;
ALTER TABLE IF EXISTS public.role_change_requests ADD COLUMN IF NOT EXISTS requested_role TEXT;

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

-- تفعيل صلاحيات الأدمن على حساب الإدارة
UPDATE public.profiles
SET is_admin = TRUE, has_erp_access = TRUE, has_support_access = TRUE, has_calls_access = TRUE, is_pro = TRUE
WHERE email ILIKE '%nhdtcc100@gmail.com%';


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. المحادثات، الدعم الفني، المزامنة، والمكالمات
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id) WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (auth.uid() = sender_id);

-- رسائل الدعم الفني
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    message_type TEXT NOT NULL DEFAULT 'text',
    metadata JSONB DEFAULT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_messages_read" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_update" ON public.support_messages;

CREATE POLICY "support_messages_read" ON public.support_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "support_messages_insert" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "support_messages_update" ON public.support_messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id OR auth.uid() = sender_id) WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- طلبات الصداقة والمزامنة
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'connections' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.connections', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "connections_select" ON public.connections FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY "connections_insert" ON public.connections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = requester_id);
CREATE POLICY "connections_update" ON public.connections FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = recipient_id) WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY "connections_delete" ON public.connections FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- المكالمات
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'voice',
    status TEXT DEFAULT 'ringing',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'calls' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.calls', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "calls_select" ON public.calls FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
CREATE POLICY "calls_insert" ON public.calls FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = caller_id);
CREATE POLICY "calls_update" ON public.calls FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = receiver_id) WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);
CREATE POLICY "calls_delete" ON public.calls FOR DELETE USING (auth.uid() = caller_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. المنشورات والوظائف والتقديم (Posts & Jobs)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name TEXT,
    author_avatar TEXT,
    author_title TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    video_url TEXT,
    likes_count INT DEFAULT 0,
    dislikes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.posts ADD COLUMN IF NOT EXISTS dislikes_count INT DEFAULT 0;
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);
CREATE POLICY "posts_update" ON public.posts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "posts_delete" ON public.posts FOR DELETE USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- الوظائف والتقديم
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    category TEXT,
    salary_range TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "jobs_select" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = employer_id);
CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE USING (auth.uid() = employer_id);
CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE USING (auth.uid() = employer_id);

CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cv_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_applications ADD COLUMN IF NOT EXISTS employer_id UUID;
ALTER TABLE IF EXISTS public.job_applications ADD COLUMN IF NOT EXISTS cv_url TEXT;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_applications' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.job_applications', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "apps_select" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_id OR (employer_id IS NOT NULL AND auth.uid() = employer_id) OR EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid()));
CREATE POLICY "apps_insert" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = applicant_id);
CREATE POLICY "apps_update" ON public.job_applications FOR UPDATE USING (auth.uid() = applicant_id OR (employer_id IS NOT NULL AND auth.uid() = employer_id) OR EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid()));
CREATE POLICY "apps_delete" ON public.job_applications FOR DELETE USING (auth.uid() = applicant_id OR (employer_id IS NOT NULL AND auth.uid() = employer_id) OR EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid()));


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. المجموعات والتنبيهات (Groups & Notifications)
-- ══════════════════════════════════════════════════════════════════════════════
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

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'accepted',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'group_members_group_id_fkey') THEN
    ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
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

-- سياسات المجموعات النظيفة لمنع 500
CREATE POLICY "members_select" ON public.group_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "members_insert_auth" ON public.group_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "members_update_owner" ON public.group_members FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);
CREATE POLICY "members_delete_auth" ON public.group_members FOR DELETE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "groups_select_all" ON public.groups FOR SELECT USING (is_private = false OR created_by = auth.uid() OR id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid()));
CREATE POLICY "groups_insert_auth" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_update_owner" ON public.groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "groups_delete_owner" ON public.groups FOR DELETE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- جدول التنبيهات
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

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)) WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id OR auth.uid() = from_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. تفعيل البث اللحظي المباشر لكافة الجداول (Realtime WebSockets)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.calls REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.groups REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.group_members REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.role_change_requests REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'messages', 
        'support_messages', 
        'connections', 
        'notifications', 
        'calls', 
        'posts', 
        'profiles', 
        'job_applications', 
        'jobs',
        'groups',
        'group_members',
        'role_change_requests'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        END IF;
    END LOOP;
END $$;

-- التحقق والتأكيد النهائي
SELECT pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
