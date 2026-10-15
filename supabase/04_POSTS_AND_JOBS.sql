-- ==============================================================================
-- 📁 Supabase Query Name: 04_POSTS_AND_JOBS
-- 🚀 ProLink: المنشورات، الوظائف، وطلبات التقديم (Posts & Job Applications)
-- ==============================================================================

-- ─── 1. جدول المنشورات (posts) ───────────────────────────────────────────────
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

CREATE POLICY "posts_insert" ON public.posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);

CREATE POLICY "posts_update" ON public.posts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "posts_delete" ON public.posts FOR DELETE
  USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── 2. جدول الوظائف (jobs) ──────────────────────────────────────────────────
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

CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = employer_id);

CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE
  USING (auth.uid() = employer_id);

CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE
  USING (auth.uid() = employer_id);

-- ─── 3. جدول طلبات التقديم للوظائف (job_applications) ───────────────────────
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

CREATE POLICY "apps_select" ON public.job_applications FOR SELECT
  USING (
    auth.uid() = applicant_id OR 
    (employer_id IS NOT NULL AND auth.uid() = employer_id) OR
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid())
  );

CREATE POLICY "apps_insert" ON public.job_applications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = applicant_id);

CREATE POLICY "apps_update" ON public.job_applications FOR UPDATE
  USING (
    auth.uid() = applicant_id OR 
    (employer_id IS NOT NULL AND auth.uid() = employer_id) OR
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid())
  );

CREATE POLICY "apps_delete" ON public.job_applications FOR DELETE
  USING (
    auth.uid() = applicant_id OR 
    (employer_id IS NOT NULL AND auth.uid() = employer_id) OR
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid())
  );
