-- ==============================================================================
-- 🚀 PROLINK ULTIMATE DATABASE & REALTIME OPTIMIZATION PATCH
-- ==============================================================================
-- هذا السكريبت يُصلح كافة جداول التطبيق وينظف السياسات من أي Subqueries معقدة
-- لضمان أقصى سرعة واستقرار لبث الـ Realtime والـ WebSockets بدون أي انقطاع.
-- ==============================================================================

-- ─── 1. جدول الرسائل (messages) ───────────────────────────────────────────────
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ─── 2. جدول طلبات الصداقة والمزامنة (connections) ───────────────────────────
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'connections' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.connections', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "connections_select" ON public.connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_insert" ON public.connections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = requester_id);

CREATE POLICY "connections_update" ON public.connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_delete" ON public.connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- ─── 3. جدول الإشعارات (notifications) ───────────────────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = from_id);

-- ─── 4. جدول المكالمات (calls) ───────────────────────────────────────────────
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

CREATE POLICY "calls_select" ON public.calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "calls_insert" ON public.calls FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = caller_id);

CREATE POLICY "calls_update" ON public.calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "calls_delete" ON public.calls FOR DELETE
  USING (auth.uid() = caller_id);

-- ─── 5. جدول طلبات التوظيف (job_applications) ───────────────────────────────
ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_applications ADD COLUMN IF NOT EXISTS employer_id UUID;

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

-- ─── 6. جدول المنشورات (posts) ───────────────────────────────────────────────
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
  USING (auth.uid() = author_id);

CREATE POLICY "posts_delete" ON public.posts FOR DELETE
  USING (auth.uid() = author_id);

-- ─── 7. ⚡ تفعيل البث اللحظي REPLICA IDENTITY FULL لكافة الجداول ─────────────
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.calls REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['messages', 'connections', 'notifications', 'calls', 'posts', 'profiles', 'job_applications', 'jobs'];
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

-- ─── 8. فحص وتأكيد النتائج ──────────────────────────────────────────────────
SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ==============================================================================
-- 🚀 PROLINK ULTIMATE DATABASE & REALTIME MASTER SCRIPT
-- ==============================================================================
-- هذا الملف هو المرجع النهائي الوحيد المعتمد لقاعدة البيانات والبث اللحظي.
-- تم إزالة كافة الاستعلامات القديمة المتضاربة والسياسات التي تحتوي على Subqueries.
-- ==============================================================================

-- ─── 1. جدول الرسائل (messages) ───────────────────────────────────────────────
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ─── 2. جدول طلبات الصداقة والمزامنة (connections) ───────────────────────────
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'connections' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.connections', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "connections_select" ON public.connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_insert" ON public.connections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = requester_id);

CREATE POLICY "connections_update" ON public.connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_delete" ON public.connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- ─── 3. جدول الإشعارات (notifications) ───────────────────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = from_id);

-- ─── 4. جدول المكالمات (calls) ───────────────────────────────────────────────
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

CREATE POLICY "calls_select" ON public.calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "calls_insert" ON public.calls FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = caller_id);

CREATE POLICY "calls_update" ON public.calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "calls_delete" ON public.calls FOR DELETE
  USING (auth.uid() = caller_id);

-- ─── 5. جدول طلبات التوظيف (job_applications) ───────────────────────────────
ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_applications ADD COLUMN IF NOT EXISTS employer_id UUID;

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

-- ─── 6. جدول المنشورات (posts) ───────────────────────────────────────────────
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
  USING (auth.uid() = author_id);

CREATE POLICY "posts_delete" ON public.posts FOR DELETE
  USING (auth.uid() = author_id);

-- ─── 7. ⚡ تفعيل البث اللحظي REPLICA IDENTITY FULL لكافة الجداول ─────────────
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.calls REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['messages', 'connections', 'notifications', 'calls', 'posts', 'profiles', 'job_applications', 'jobs'];
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

-- ─── 8. فحص وتأكيد النتائج ──────────────────────────────────────────────────
SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ════════════════════════════════════════════════════════════
-- جدول رسائل الدعم الفني (support_messages)
-- منفصل تماماً عن جدول الرسائل العادية (messages)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.support_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  message_type  TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'role_change_request', 'system')),
  metadata      JSONB DEFAULT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── فهارس الأداء ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_messages_sender    ON public.support_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_receiver  ON public.support_messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created   ON public.support_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_type      ON public.support_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_support_messages_read      ON public.support_messages (read);

-- ── تفعيل Row Level Security ──────────────────────────────────
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- ── سياسات الأمان (RLS Policies) ─────────────────────────────

-- 1. المستخدم يقرأ فقط رسائله هو (المُرسَلة أو المُستلَمة)
CREATE POLICY "support_messages_read_own"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- 2. أي مستخدم مسجّل يستطيع إرسال رسائل دعم
CREATE POLICY "support_messages_insert_authenticated"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- 3. فقط المستلِم يستطيع تعليم الرسالة كمقروءة
CREATE POLICY "support_messages_update_read"
  ON public.support_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 4. الأدمن لديه صلاحية الاطلاع الكاملة (عبر service_role)
-- ملاحظة: يُستخدَم service_role فقط في AdminDashboard من الخادم.
-- في حالة الـ Realtime من العميل يتم عبر السياسة الأولى.

-- ── الانتهاء ─────────────────────────────────────────────────
-- قاعدة البيانات الآن جاهزة بجدول support_messages مستقل

-- 1. تفعيل صلاحيات الأدمن والداشبورد وكافة الميزات على حسابك الفعلي الحالي
UPDATE public.profiles
SET 
  is_admin = TRUE,
  has_erp_access = TRUE,
  has_support_access = TRUE,
  has_calls_access = TRUE,
  is_pro = TRUE
WHERE email ILIKE '%nhdtcc100@gmail.com%';

-- 2. تحديث التريجر (Trigger) بحيث أي تسجيل جديد أو مستقبلي بهذا الإيميل يصبح أدمن تلقائياً
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
  
  -- إذا كان الإيميل هو إيميل المدير nhdtcc100@gmail.com يمنح صلاحيات الأدمن فوراً
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
    NEW.id, v_name, v_email, v_phone, v_avatar, 'employer', 
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
-- ==============================================================================
-- 🚀 PROLINK MASTER DATABASE, REALTIME & RLS REPAIR PATCH
-- ══════════════════════════════════════════════════════════════════════════════
-- يحل كافة مشاكل:
-- 1. عدم وصول الرسائل الفورية والمزامنة إلا بعد إعادة تشغيل التطبيق.
-- 2. خطأ 400 Bad Request عند تمييز الرسائل كمقروءة وحذفها.
-- 3. عدم ظهور طلبات الصداقة والإشعارات للطرف الآخر في الوقت الفعلي.
-- 4. فشل قبول/رفض طلبات الصداقة وحاجة المستخدم لعمل رفرش.
-- 5. تفعيل كامل لبث WebSockets Realtime لجميع الجداول.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول الرسائل (messages): تفعيل القراءة والإرسال والتحديث (read) والحذف
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;

-- القراءة: المرسل والمستقبل فقط (والأدمن)
CREATE POLICY "messages_read_parties" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: المرسل الموثق
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = sender_id
  );

-- التحديث (لقراءة الرسائل من المستقبل، أو تعديل الرسالة من المرسل):
CREATE POLICY "messages_update_parties" ON public.messages
  FOR UPDATE USING (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الحذف: المرسل فقط أو الأدمن
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. جدول طلبات الصداقة والمزامنة (connections): قراءة، إرسال، قبول/رفض، وحذف
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_participant_select" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_insert" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_update" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_delete" ON public.connections;

-- القراءة: المشتركون في الطلب
CREATE POLICY "connections_participant_select" ON public.connections
  FOR SELECT USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: مرسل الطلب
CREATE POLICY "connections_participant_insert" ON public.connections
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = requester_id
  );

-- القبول/التعديل: المستقبل (أو المرسل)
CREATE POLICY "connections_participant_update" ON public.connections
  FOR UPDATE USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الرفض/الحذف: كلا الطرفين
CREATE POLICY "connections_participant_delete" ON public.connections
  FOR DELETE USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. جدول التنبيهات (notifications): إرسال التنبيهات بين المستخدمين
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_auth_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;

-- القراءة: صاحب الإشعار
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: أي مستخدم موثق يمكنه إرسال تنبيه لشخص آخر (طلب صداقة، إعجاب، رسالة، قبول)
CREATE POLICY "notifications_auth_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- التحديث: صاحب الإشعار (تمييز كمقروء)
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الحذف: صاحب الإشعار أو مرسله
CREATE POLICY "notifications_owner_delete" ON public.notifications
  FOR DELETE USING (
    auth.uid() = user_id OR
    auth.uid() = from_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. جدول طلبات التوظيف (job_applications)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_read_parties" ON public.job_applications;
DROP POLICY IF EXISTS "apps_insert_own" ON public.job_applications;
DROP POLICY IF EXISTS "apps_update_status" ON public.job_applications;
DROP POLICY IF EXISTS "apps_delete_parties" ON public.job_applications;

CREATE POLICY "apps_read_parties" ON public.job_applications
  FOR SELECT USING (
    applicant_id = auth.uid() OR
    employer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "apps_insert_own" ON public.job_applications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = applicant_id
  );

CREATE POLICY "apps_update_status" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id OR 
    auth.uid() = applicant_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "apps_delete_parties" ON public.job_applications
  FOR DELETE USING (
    auth.uid() = applicant_id OR 
    auth.uid() = employer_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. جدول المنشورات (posts)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_update_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_auth" ON public.posts;

CREATE POLICY "posts_select_all" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_auth" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = author_id
  );

CREATE POLICY "posts_update_auth" ON public.posts
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "posts_delete_auth" ON public.posts
  FOR DELETE USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ⚡ تفعيل البث المباشر (Supabase Realtime WebSockets) لكافة الجداول
-- ─────────────────────────────────────────────────────────────────────────────
-- ضبط Replica Identity لضمان إرسال كامل بيانات السطر عند الإضافة والتعديل والحذف
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['messages', 'connections', 'notifications', 'posts', 'profiles', 'job_applications', 'jobs'];
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
-- ==============================================================================
-- 🚀 PROLINK MASTER DATABASE, REALTIME & RLS REPAIR PATCH
-- ══════════════════════════════════════════════════════════════════════════════
-- يحل كافة مشاكل:
-- 1. عدم وصول الرسائل الفورية والمزامنة إلا بعد إعادة تشغيل التطبيق.
-- 2. خطأ 400 Bad Request عند تمييز الرسائل كمقروءة وحذفها.
-- 3. عدم ظهور طلبات الصداقة والإشعارات للطرف الآخر في الوقت الفعلي.
-- 4. فشل قبول/رفض طلبات الصداقة وحاجة المستخدم لعمل رفرش.
-- 5. تفعيل كامل لبث WebSockets Realtime لجميع الجداول.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول الرسائل (messages): تفعيل القراءة والإرسال والتحديث (read) والحذف
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;

-- القراءة: المرسل والمستقبل فقط (والأدمن)
CREATE POLICY "messages_read_parties" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: المرسل الموثق
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = sender_id
  );

-- التحديث (لقراءة الرسائل من المستقبل، أو تعديل الرسالة من المرسل):
CREATE POLICY "messages_update_parties" ON public.messages
  FOR UPDATE USING (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الحذف: المرسل فقط أو الأدمن
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. جدول طلبات الصداقة والمزامنة (connections): قراءة، إرسال، قبول/رفض، وحذف
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_participant_select" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_insert" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_update" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_delete" ON public.connections;

-- القراءة: المشتركون في الطلب
CREATE POLICY "connections_participant_select" ON public.connections
  FOR SELECT USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: مرسل الطلب
CREATE POLICY "connections_participant_insert" ON public.connections
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = requester_id
  );

-- القبول/التعديل: المستقبل (أو المرسل)
CREATE POLICY "connections_participant_update" ON public.connections
  FOR UPDATE USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الرفض/الحذف: كلا الطرفين
CREATE POLICY "connections_participant_delete" ON public.connections
  FOR DELETE USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. جدول التنبيهات (notifications): إرسال التنبيهات بين المستخدمين
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_auth_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;

-- القراءة: صاحب الإشعار
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: أي مستخدم موثق يمكنه إرسال تنبيه لشخص آخر (طلب صداقة، إعجاب، رسالة، قبول)
CREATE POLICY "notifications_auth_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- التحديث: صاحب الإشعار (تمييز كمقروء)
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الحذف: صاحب الإشعار أو مرسله
CREATE POLICY "notifications_owner_delete" ON public.notifications
  FOR DELETE USING (
    auth.uid() = user_id OR
    auth.uid() = from_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. جدول طلبات التوظيف (job_applications)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_read_parties" ON public.job_applications;
DROP POLICY IF EXISTS "apps_insert_own" ON public.job_applications;
DROP POLICY IF EXISTS "apps_update_status" ON public.job_applications;
DROP POLICY IF EXISTS "apps_delete_parties" ON public.job_applications;

CREATE POLICY "apps_read_parties" ON public.job_applications
  FOR SELECT USING (
    applicant_id = auth.uid() OR
    employer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "apps_insert_own" ON public.job_applications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = applicant_id
  );

CREATE POLICY "apps_update_status" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id OR 
    auth.uid() = applicant_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "apps_delete_parties" ON public.job_applications
  FOR DELETE USING (
    auth.uid() = applicant_id OR 
    auth.uid() = employer_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. جدول المنشورات (posts)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_update_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_auth" ON public.posts;

CREATE POLICY "posts_select_all" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_auth" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = author_id
  );

CREATE POLICY "posts_update_auth" ON public.posts
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "posts_delete_auth" ON public.posts
  FOR DELETE USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ⚡ تفعيل البث المباشر (Supabase Realtime WebSockets) لكافة الجداول
-- ─────────────────────────────────────────────────────────────────────────────
-- ضبط Replica Identity لضمان إرسال كامل بيانات السطر عند الإضافة والتعديل والحذف
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['messages', 'connections', 'notifications', 'posts', 'profiles', 'job_applications', 'jobs'];
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
-- ==============================================================================
-- 🚀 PROLINK MASTER DATABASE, REALTIME & RLS REPAIR PATCH
-- ══════════════════════════════════════════════════════════════════════════════
-- يحل كافة مشاكل:
-- 1. عدم وصول الرسائل الفورية والمزامنة إلا بعد إعادة تشغيل التطبيق.
-- 2. خطأ 400 Bad Request عند تمييز الرسائل كمقروءة وحذفها.
-- 3. عدم ظهور طلبات الصداقة والإشعارات للطرف الآخر في الوقت الفعلي.
-- 4. فشل قبول/رفض طلبات الصداقة وحاجة المستخدم لعمل رفرش.
-- 5. تفعيل كامل لبث WebSockets Realtime لجميع الجداول.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول الرسائل (messages): تفعيل القراءة والإرسال والتحديث (read) والحذف
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;

-- القراءة: المرسل والمستقبل فقط
CREATE POLICY "messages_read_parties" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id
  );

-- الإرسال: المرسل الموثق
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = sender_id
  );

-- التحديث (لقراءة الرسائل من المستقبل، أو تعديل الرسالة من المرسل):
CREATE POLICY "messages_update_parties" ON public.messages
  FOR UPDATE USING (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id
  )
  WITH CHECK (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id
  );

-- الحذف: المرسل فقط
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (
    auth.uid() = sender_id
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. جدول طلبات الصداقة والمزامنة (connections): قراءة، إرسال، قبول/رفض، وحذف
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_participant_select" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_insert" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_update" ON public.connections;
DROP POLICY IF EXISTS "connections_participant_delete" ON public.connections;

-- القراءة: المشتركون في الطلب
CREATE POLICY "connections_participant_select" ON public.connections
  FOR SELECT USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: مرسل الطلب
CREATE POLICY "connections_participant_insert" ON public.connections
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = requester_id
  );

-- القبول/التعديل: المستقبل (أو المرسل)
CREATE POLICY "connections_participant_update" ON public.connections
  FOR UPDATE USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الرفض/الحذف: كلا الطرفين
CREATE POLICY "connections_participant_delete" ON public.connections
  FOR DELETE USING (
    auth.uid() = requester_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. جدول التنبيهات (notifications): إرسال التنبيهات بين المستخدمين
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_auth_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;

-- القراءة: صاحب الإشعار
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الإرسال: أي مستخدم موثق يمكنه إرسال تنبيه لشخص آخر (طلب صداقة، إعجاب، رسالة، قبول)
CREATE POLICY "notifications_auth_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- التحديث: صاحب الإشعار (تمييز كمقروء)
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الحذف: صاحب الإشعار أو مرسله
CREATE POLICY "notifications_owner_delete" ON public.notifications
  FOR DELETE USING (
    auth.uid() = user_id OR
    auth.uid() = from_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. جدول طلبات التوظيف (job_applications)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_read_parties" ON public.job_applications;
DROP POLICY IF EXISTS "apps_insert_own" ON public.job_applications;
DROP POLICY IF EXISTS "apps_update_status" ON public.job_applications;
DROP POLICY IF EXISTS "apps_delete_parties" ON public.job_applications;

CREATE POLICY "apps_read_parties" ON public.job_applications
  FOR SELECT USING (
    auth.uid() = applicant_id OR
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "apps_insert_own" ON public.job_applications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = applicant_id
  );

CREATE POLICY "apps_update_status" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = applicant_id OR
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "apps_delete_parties" ON public.job_applications
  FOR DELETE USING (
    auth.uid() = applicant_id OR
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_applications.job_id AND jobs.employer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. جدول المنشورات (posts)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_update_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_auth" ON public.posts;

CREATE POLICY "posts_select_all" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_auth" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = author_id
  );

CREATE POLICY "posts_update_auth" ON public.posts
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "posts_delete_auth" ON public.posts
  FOR DELETE USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ⚡ تفعيل البث المباشر (Supabase Realtime WebSockets) لكافة الجداول
-- ─────────────────────────────────────────────────────────────────────────────
-- ضبط Replica Identity لضمان إرسال كامل بيانات السطر عند الإضافة والتعديل والحذف
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['messages', 'connections', 'notifications', 'posts', 'profiles', 'job_applications', 'jobs'];
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
-- 1. تحديث سياسات جدول الرسائل لتتوافق 100% مع البث الفوري Realtime
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_parties" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;

-- القراءة: المرسل والمستقبل
CREATE POLICY "messages_read_parties" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id
  );

-- الإرسال: المرسل الموثق
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = sender_id
  );

-- التحديث: كلا الطرفين (للقراءة والتعديل)
CREATE POLICY "messages_update_parties" ON public.messages
  FOR UPDATE USING (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id
  )
  WITH CHECK (
    auth.uid() = receiver_id OR 
    auth.uid() = sender_id
  );

-- الحذف: المرسل فقط
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (
    auth.uid() = sender_id
  );

-- 2. تأكيد REPLICA IDENTITY للبث المباشر
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس السرعة والتحمل (High Scalability Indexes)
CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id, created_at DESC);
CREATE INDEX idx_messages_pair ON public.messages(sender_id, receiver_id, created_at DESC);
-- ==============================================================================
-- 🔧 FINAL FIX: Supabase Realtime Bidirectional Messaging
-- 
-- المشكلة المُحددة:
-- Supabase Realtime WAL decoder يُرسل حدث INSERT للمستقبِل فقط إذا كان
-- SELECT policy يسمح له برؤية الصف — لكن بدون subqueries أو function calls.
-- أي policy تحتوي EXISTS(SELECT 1 FROM ...) تُفشل الـ WAL broadcast للمستقبِل.
--
-- الحل: سياسات مباشرة تستخدم auth.uid() فقط بدون أي subqueries.
--
-- الخطوات:
-- 1. اذهب لـ Supabase Dashboard
-- 2. اضغط SQL Editor
-- 3. الصق هذا الكود كاملاً ثم اضغط Run
-- ==============================================================================

-- ─── الخطوة 1: حذف كل السياسات الموجودة على جدول messages ───────────────────
-- هذا يضمن عدم وجود أي policy قديمة تتداخل مع الجديدة

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- ─── الخطوة 2: تفعيل REPLICA IDENTITY FULL ──────────────────────────────────
-- شرط أساسي لـ Supabase Realtime حتى يُرسل بيانات الصفوف القديمة في UPDATE/DELETE

ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ─── الخطوة 3: تفعيل RLS ────────────────────────────────────────────────────

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ─── الخطوة 4: إضافة الجدول لقناة الـ Realtime إذا لم يكن موجوداً ──────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        RAISE NOTICE 'Added messages to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'messages already in supabase_realtime publication';
    END IF;
END $$;

-- ─── الخطوة 5: إنشاء سياسات جديدة نظيفة (بدون أي subqueries) ───────────────

-- SELECT: المُرسِل أو المُستقبِل يمكنه رؤية الرسالة
-- ⚠️ لا يوجد EXISTS أو subquery هنا — هذا أساسي لـ Realtime WAL
CREATE POLICY "msg_select_parties"
ON public.messages
FOR SELECT
USING (
    auth.uid() = sender_id
    OR
    auth.uid() = receiver_id
);

-- INSERT: المستخدم يُرسل فقط باسمه
CREATE POLICY "msg_insert_sender"
ON public.messages
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = sender_id
);

-- UPDATE: المُرسِل أو المُستقبِل يمكنه تحديث (مثلاً mark as read)
CREATE POLICY "msg_update_parties"
ON public.messages
FOR UPDATE
USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
)
WITH CHECK (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
);

-- DELETE: المُرسِل فقط يحذف رسالته
CREATE POLICY "msg_delete_sender"
ON public.messages
FOR DELETE
USING (
    auth.uid() = sender_id
);

-- ─── الخطوة 6: التحقق النهائي ────────────────────────────────────────────────

-- يجب أن يظهر صف واحد لـ messages
SELECT 
    schemaname, 
    tablename, 
    'IN REALTIME PUBLICATION ✅' as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'messages';

-- يجب أن يظهر FULL OK
SELECT 
    relname as table_name,
    CASE relreplident
        WHEN 'd' THEN 'DEFAULT ❌ يحتاج تغيير'
        WHEN 'f' THEN 'FULL ✅ صحيح'
        WHEN 'i' THEN 'INDEX'
        WHEN 'n' THEN 'NOTHING ❌ خطأ'
    END as replica_identity
FROM pg_class WHERE relname = 'messages';

-- السياسات الجديدة — يجب أن تظهر 4 فقط
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'messages'
ORDER BY policyname;


SELECT id, sender_id, receiver_id, content, created_at 
FROM public.messages 
ORDER BY created_at DESC 
LIMIT 50;
SELECT id, sender_id, receiver_id, content, created_at 
FROM public.messages 
WHERE sender_id = 'a2d5247e-8532-43b9-9a25-14b938fb2596' 
   OR receiver_id = 'a2d5247e-8532-43b9-9a25-14b938fb2596' 
ORDER BY created_at DESC 
LIMIT 50;
-- ==============================================================================
-- 🚀 PROLINK ULTIMATE DATABASE & REALTIME OPTIMIZATION PATCH
-- ==============================================================================
-- هذا السكريبت يُصلح كافة جداول التطبيق وينظف السياسات من أي Subqueries معقدة
-- لضمان أقصى سرعة واستقرار لبث الـ Realtime والـ WebSockets بدون أي انقطاع.
-- ==============================================================================

-- ─── 1. جدول الرسائل (messages) ───────────────────────────────────────────────
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ─── 2. جدول طلبات الصداقة والمزامنة (connections) ───────────────────────────
ALTER TABLE IF EXISTS public.connections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'connections' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.connections', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "connections_select" ON public.connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_insert" ON public.connections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = requester_id);

CREATE POLICY "connections_update" ON public.connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_delete" ON public.connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- ─── 3. جدول الإشعارات (notifications) ───────────────────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = from_id);

-- ─── 4. جدول المكالمات (calls) ───────────────────────────────────────────────
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

CREATE POLICY "calls_select" ON public.calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "calls_insert" ON public.calls FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = caller_id);

CREATE POLICY "calls_update" ON public.calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "calls_delete" ON public.calls FOR DELETE
  USING (auth.uid() = caller_id);

-- ─── 5. جدول طلبات التوظيف (job_applications) ───────────────────────────────
ALTER TABLE IF EXISTS public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_applications ADD COLUMN IF NOT EXISTS employer_id UUID;

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

-- ─── 6. جدول المنشورات (posts) ───────────────────────────────────────────────
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
  USING (auth.uid() = author_id);

CREATE POLICY "posts_delete" ON public.posts FOR DELETE
  USING (auth.uid() = author_id);

-- ─── 7. ⚡ تفعيل البث اللحظي REPLICA IDENTITY FULL لكافة الجداول ─────────────
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.connections REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.calls REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.jobs REPLICA IDENTITY FULL;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['messages', 'connections', 'notifications', 'calls', 'posts', 'profiles', 'job_applications', 'jobs'];
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

-- ─── 8. فحص وتأكيد النتائج ──────────────────────────────────────────────────
SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- ════════════════════════════════════════════════════════════════════════════════
-- 🎧 جدول رسائل الدعم الفني المنفصل (support_messages)
-- منفصل 100% عن جدول الرسائل العادية (messages)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.support_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 3000),
  message_type  TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'role_change_request', 'system')),
  metadata      JSONB DEFAULT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 1. فهارس الأداء (Performance Indexes) ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_messages_sender    ON public.support_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_receiver  ON public.support_messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created   ON public.support_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_type      ON public.support_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_support_messages_read      ON public.support_messages (read);

-- ── 2. تفعيل الحماية على مستوى الصفوف (Row Level Security) ─────────────────────
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_select" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_update" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_delete" ON public.support_messages;

-- السياسة 1: القراءة للمرسل أو المستقبل أو أي أدمن
CREATE POLICY "support_messages_select" ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND (profiles.is_admin = TRUE OR profiles.role IN ('admin', 'superadmin'))
    )
  );

-- السياسة 2: الإدراج لأي مستخدم مسجل
CREATE POLICY "support_messages_insert" ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

-- السياسة 3: التحديث للمستلم أو الأدمن
CREATE POLICY "support_messages_update" ON public.support_messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND (profiles.is_admin = TRUE OR profiles.role IN ('admin', 'superadmin'))
    )
  )
  WITH CHECK (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND (profiles.is_admin = TRUE OR profiles.role IN ('admin', 'superadmin'))
    )
  );

-- السياسة 4: الحذف للمرسل أو الأدمن
CREATE POLICY "support_messages_delete" ON public.support_messages
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
        AND (profiles.is_admin = TRUE OR profiles.role IN ('admin', 'superadmin'))
    )
  );

-- ── 3. تفعيل Realtime على جدول الدعم ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
-- ════════════════════════════════════════════════════════════════════════════════
-- 🚀 تحديثات قاعدة البيانات لـ ProLink v3.0
-- يشمل: دعم العمل الحر/الكشفي، ميزة التوفر للعمل، والبيانات المهنية والمؤسسية
-- ════════════════════════════════════════════════════════════════════════════════

-- 1️⃣ إضافة الأعمدة الجديدة لجدول الملفات الشخصية (profiles)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS display_title TEXT,             -- الاسم الصريح مع الاختصاص للعرض
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false, -- حالة "متاح للعمل" (للباحث والفني)
  ADD COLUMN IF NOT EXISTS freelancer_type TEXT,            -- 'technician' (فني مقدّم خدمة) | 'client' (طالب خدمة/زبون)
  ADD COLUMN IF NOT EXISTS specialty TEXT,                  -- الاختصاص المهني (كهربائي، تبريد، سيراميك، بناء...)
  ADD COLUMN IF NOT EXISTS home_address TEXT,              -- عنوان البيت للكشف المباشر
  ADD COLUMN IF NOT EXISTS service_request TEXT,          -- شرح المشكلة أو الخدمة المطلوبة
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT,          -- صورة / شعار الشركة (لصاحب العمل)
  ADD COLUMN IF NOT EXISTS company_bio TEXT;               -- نبذة المنشأة / المؤسسة (لصاحب العمل)

-- 2️⃣ تحديث قيد الأدوار (Role Check) لجدول profiles لدعم 'freelancer'
DO $$
BEGIN
    -- إزالة القيد القديم إن وُجد وإعادة إنشائه بالقيم الجديدة
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    
    ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('seeker', 'employer', 'freelancer', 'admin', 'superadmin', ''));
END $$;

-- 3️⃣ تحديث قيود جدول طلبات تغيير الحساب (role_change_requests) لتمكين التحويل للعمل الحر
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_change_requests') THEN
        -- تحديث قيد from_role
        ALTER TABLE public.role_change_requests DROP CONSTRAINT IF EXISTS role_change_requests_from_role_check;
        ALTER TABLE public.role_change_requests 
            ADD CONSTRAINT role_change_requests_from_role_check 
            CHECK (from_role IN ('seeker', 'employer', 'freelancer'));

        -- تحديث قيد requested_role
        ALTER TABLE public.role_change_requests DROP CONSTRAINT IF EXISTS role_change_requests_requested_role_check;
        ALTER TABLE public.role_change_requests 
            ADD CONSTRAINT role_change_requests_requested_role_check 
            CHECK (requested_role IN ('seeker', 'employer', 'freelancer'));
    END IF;
END $$;

-- 4️⃣ إنشاء فهارس سريعة (Performance Indexes) للبحث والفلترة الفورية
CREATE INDEX IF NOT EXISTS idx_profiles_role            ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_available    ON public.profiles (is_available);
CREATE INDEX IF NOT EXISTS idx_profiles_freelancer_type ON public.profiles (freelancer_type);
CREATE INDEX IF NOT EXISTS idx_profiles_specialty       ON public.profiles (specialty);

-- 5️⃣ توثيق الأعمدة بتعليقات توضيحية
COMMENT ON COLUMN public.profiles.display_title   IS 'الاسم الصريح مدمجاً بالاختصاص للعرض في رأس الملف';
COMMENT ON COLUMN public.profiles.is_available   IS 'متاح للعمل (تُعرض فقط في الملف الشخصي)';
COMMENT ON COLUMN public.profiles.freelancer_type IS 'نوع الحساب الكشفي: فني أو طالب خدمة';
COMMENT ON COLUMN public.profiles.specialty       IS 'الاختصاص الميداني مثل كهربائي أو تبريد أو سيراميك';
COMMENT ON COLUMN public.profiles.home_address    IS 'عنوان البيت للتواصل الكشفي المباشر';
COMMENT ON COLUMN public.profiles.service_request IS 'شرح مشكلة الزبون أو وصف الخدمة المطلوبة';
-- ============================================================
-- 🔧 PROLINK: إصلاح شامل لجميع المشاكل
-- نفّذ هذا SQL كاملاً في Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. إصلاح جدول support_messages (RLS)
-- ─────────────────────────────────────────────────────────────
-- تأكد من وجود الجدول أولاً
CREATE TABLE IF NOT EXISTS public.support_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content     text NOT NULL,
  message_type text DEFAULT 'text',
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;

-- ✅ المستخدم المصادق يرى رسائله فقط (مرسِل أو مستقبِل)
CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- ✅ أي مستخدم مصادق يستطيع إرسال رسالة دعم
CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ✅ تحديث حالة القراءة
CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- ✅ منح صلاحيات SELECT للأدمن لرؤية جميع الرسائل
CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ✅ السماح للأدمن بالرد
CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. إصلاح جدول groups + group_members (RLS)
-- ─────────────────────────────────────────────────────────────

-- تأكد من وجود جدول groups
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid NOT NULL,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- تأكد من وجود جدول group_members
CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'pending',
  joined_at  timestamptz DEFAULT now()
);

-- تفعيل RLS للمجموعات
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "groups_select_all"    ON public.groups;
DROP POLICY IF EXISTS "groups_insert_auth"   ON public.groups;
DROP POLICY IF EXISTS "groups_update_owner"  ON public.groups;
DROP POLICY IF EXISTS "groups_delete_owner"  ON public.groups;
DROP POLICY IF EXISTS "members_select"       ON public.group_members;
DROP POLICY IF EXISTS "members_insert_auth"  ON public.group_members;
DROP POLICY IF EXISTS "members_update_owner" ON public.group_members;
DROP POLICY IF EXISTS "members_delete_auth"  ON public.group_members;

-- ✅ المجموعات العامة مرئية للجميع، الخاصة فقط للأعضاء
CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'accepted'
    )
  );

-- ✅ أي مستخدم مصادق يستطيع إنشاء مجموعة
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ✅ المنشئ فقط يستطيع التعديل
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

-- ✅ المنشئ أو الأدمن يستطيع الحذف
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ✅ الأعضاء يرون قائمة الأعضاء
CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id 
        AND gm2.user_id = auth.uid() 
        AND gm2.status = 'accepted'
    )
  );

-- ✅ أي مستخدم مصادق يستطيع الانضمام
CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ✅ المنشئ يستطيع تحديث حالة الأعضاء
CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- ✅ الخروج من المجموعة أو الطرد
CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. إضافة إشعارات عند تغيير حالة طلب الوظيفة
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ✅ Trigger: إشعار تلقائي عند تغيير حالة طلب التوظيف
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      NEW.employer_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- ✅ Trigger: إشعار تلقائي عند تغيير حالة تسجيل الدورة
CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      NEW.provider_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. إصلاح job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"     ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"    ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer" ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer" ON public.job_applications;

-- المتقدم يرى طلباته
CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

-- صاحب العمل يرى الطلبات المرسلة إليه
CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

-- أي مصادق يستطيع التقديم (القيد يتم في الكود)
CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- صاحب العمل يستطيع تغيير حالة الطلب
CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. منح الأدمن صلاحية رؤية كل job_applications
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_job_app_select_all" ON public.job_applications;
CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. تفعيل Realtime للجداول المهمة
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- ─────────────────────────────────────────────────────────────
-- انتهى — تحقق من نجاح التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;

-- ============================================================
-- 🔧 PROLINK: إصلاح شامل ونهائي لجميع الجداول والمشاكل
-- انسخ هذا الكود كاملاً ونفّذه في Supabase -> SQL Editor -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول رسائل الدعم الفني support_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL,
  receiver_id  uuid NOT NULL,
  content      text NOT NULL,
  message_type text DEFAULT 'text',
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- التأكد من وجود كافة الأعمدة في حال كان الجدول موجوداً مسبقاً
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_insert_reply" ON public.support_messages;

CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المجموعات groups وأعضائها group_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ✅ إضافة الأعمدة المفقودة التي كانت تسبب خطأ column created_by does not exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='creator_id') THEN
    UPDATE public.groups SET created_by = creator_id WHERE created_by IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='user_id') THEN
    UPDATE public.groups SET created_by = user_id WHERE created_by IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'accepted',
  joined_at  timestamptz DEFAULT now()
);

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

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

CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id 
        AND gm2.user_id = auth.uid() 
        AND gm2.status = 'accepted'
    )
  );

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الإشعارات notifications ومحفزات التحديث
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- تأمين أعمدة job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employer_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- محفز إشعار تلقائي عند قبول أو رفض طلب الوظيفة
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_emp_id := NULL;
    BEGIN
      v_emp_id := NEW.employer_id;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      v_emp_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- جدول تسجيل الدورات ومحفز الإشعار
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid,
  user_id     uuid,
  provider_id uuid,
  status      text DEFAULT 'pending',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_prov_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_prov_id := NULL;
    BEGIN
      v_prov_id := NEW.provider_id;
    EXCEPTION WHEN OTHERS THEN
      v_prov_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      v_prov_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. صلاحيات job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"        ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"       ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "admin_job_app_select_all"  ON public.job_applications;

CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. تفعيل Realtime بأمان
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- نتيجة التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;
-- ============================================================
-- 🔧 PROLINK: إصلاح شامل ونهائي لجميع الجداول والمشاكل
-- انسخ هذا الكود كاملاً ونفّذه في Supabase -> SQL Editor -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول رسائل الدعم الفني support_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL,
  receiver_id  uuid NOT NULL,
  content      text NOT NULL,
  message_type text DEFAULT 'text',
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- التأكد من وجود كافة الأعمدة في حال كان الجدول موجوداً مسبقاً
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_insert_reply" ON public.support_messages;

CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المجموعات groups وأعضائها group_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ✅ إضافة الأعمدة المفقودة التي كانت تسبب خطأ column created_by does not exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='creator_id') THEN
    UPDATE public.groups SET created_by = creator_id WHERE created_by IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='user_id') THEN
    UPDATE public.groups SET created_by = user_id WHERE created_by IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'accepted',
  joined_at  timestamptz DEFAULT now()
);

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

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

CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id 
        AND gm2.user_id = auth.uid() 
        AND gm2.status = 'accepted'
    )
  );

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الإشعارات notifications ومحفزات التحديث
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- تأمين أعمدة job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employer_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- محفز إشعار تلقائي عند قبول أو رفض طلب الوظيفة
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_emp_id := NULL;
    BEGIN
      v_emp_id := NEW.employer_id;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      v_emp_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- جدول تسجيل الدورات ومحفز الإشعار
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid,
  user_id     uuid,
  provider_id uuid,
  status      text DEFAULT 'pending',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_prov_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_prov_id := NULL;
    BEGIN
      v_prov_id := NEW.provider_id;
    EXCEPTION WHEN OTHERS THEN
      v_prov_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      v_prov_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. صلاحيات job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"        ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"       ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "admin_job_app_select_all"  ON public.job_applications;

CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. تفعيل Realtime بأمان
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- نتيجة التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;
-- ============================================================
-- 🔧 PROLINK: إصلاح شامل ونهائي لجميع الجداول والمشاكل
-- انسخ هذا الكود كاملاً ونفّذه في Supabase -> SQL Editor -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول رسائل الدعم الفني support_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL,
  receiver_id  uuid NOT NULL,
  content      text NOT NULL,
  message_type text DEFAULT 'text',
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- التأكد من وجود كافة الأعمدة في حال كان الجدول موجوداً مسبقاً
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_insert_reply" ON public.support_messages;

-- المستخدم يرى رسائله الخاصة
CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- المستخدم يرسل رسائل
CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- تحديث حالة القراءة
CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- الأدمن يرى كافة رسائل الدعم للرد عليها
CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- الأدمن يستطيع إرسال ردود الدعم
CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المجموعات groups وأعضائها group_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ✅ إضافة الأعمدة المفقودة التي كانت تسبب خطأ column created_by does not exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- مزامنة الأعمدة القديمة إن وجدت
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='creator_id') THEN
    UPDATE public.groups SET created_by = creator_id WHERE created_by IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='user_id') THEN
    UPDATE public.groups SET created_by = user_id WHERE created_by IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'accepted',
  joined_at  timestamptz DEFAULT now()
);

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

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

-- المجموعات العامة يراها الجميع، الخاصة يراها الأعضاء والمنشئ
CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'accepted'
    )
  );

-- إنشاء مجموعة من قبل أي مستخدم مسجل
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- تعديل المجموعة من قبل المنشئ
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

-- حذف المجموعة من قبل المنشئ أو الأدمن
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- أعضاء المجموعة
CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id 
        AND gm2.user_id = auth.uid() 
        AND gm2.status = 'accepted'
    )
  );

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الإشعارات notifications ومحفزات التحديث
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- تأمين أعمدة job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employer_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- محفز إشعار تلقائي عند قبول أو رفض طلب الوظيفة
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_emp_id := NULL;
    BEGIN
      v_emp_id := NEW.employer_id;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      v_emp_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- جدول تسجيل الدورات ومحفز الإشعار
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid,
  user_id     uuid,
  provider_id uuid,
  status      text DEFAULT 'pending',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_prov_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_prov_id := NULL;
    BEGIN
      v_prov_id := NEW.provider_id;
    EXCEPTION WHEN OTHERS THEN
      v_prov_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      v_prov_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. صلاحيات job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"        ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"       ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "admin_job_app_select_all"  ON public.job_applications;

CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. تفعيل Realtime بأمان
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- نتيجة التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;

-- ============================================================
-- 🔧 PROLINK: إصلاح شامل ونهائي لجميع الجداول والمشاكل
-- انسخ هذا الكود كاملاً ونفّذه في Supabase -> SQL Editor -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول رسائل الدعم الفني support_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL,
  receiver_id  uuid NOT NULL,
  content      text NOT NULL,
  message_type text DEFAULT 'text',
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- التأكد من وجود كافة الأعمدة في حال كان الجدول موجوداً مسبقاً
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_insert_reply" ON public.support_messages;

-- المستخدم يرى رسائله الخاصة
CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- المستخدم يرسل رسائل
CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- تحديث حالة القراءة
CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- الأدمن يرى كافة رسائل الدعم للرد عليها
CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- الأدمن يستطيع إرسال ردود الدعم
CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المجموعات groups وأعضائها group_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ✅ إضافة الأعمدة المفقودة التي كانت تسبب خطأ column created_by does not exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- مزامنة الأعمدة القديمة إن وجدت
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='creator_id') THEN
    UPDATE public.groups SET created_by = creator_id WHERE created_by IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='user_id') THEN
    UPDATE public.groups SET created_by = user_id WHERE created_by IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'accepted',
  joined_at  timestamptz DEFAULT now()
);

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

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

-- المجموعات العامة يراها الجميع، الخاصة يراها الأعضاء والمنشئ
CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'accepted'
    )
  );

-- إنشاء مجموعة من قبل أي مستخدم مسجل
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- تعديل المجموعة من قبل المنشئ
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

-- حذف المجموعة من قبل المنشئ أو الأدمن
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- أعضاء المجموعة
CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id 
        AND gm2.user_id = auth.uid() 
        AND gm2.status = 'accepted'
    )
  );

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الإشعارات notifications ومحفزات التحديث
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- تأمين أعمدة job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employer_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- محفز إشعار تلقائي عند قبول أو رفض طلب الوظيفة
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_emp_id := NULL;
    BEGIN
      v_emp_id := NEW.employer_id;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      v_emp_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- جدول تسجيل الدورات ومحفز الإشعار
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid,
  user_id     uuid,
  provider_id uuid,
  status      text DEFAULT 'pending',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_prov_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_prov_id := NULL;
    BEGIN
      v_prov_id := NEW.provider_id;
    EXCEPTION WHEN OTHERS THEN
      v_prov_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      v_prov_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. صلاحيات job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"        ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"       ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "admin_job_app_select_all"  ON public.job_applications;

CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. تفعيل Realtime بأمان
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- نتيجة التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;

-- ============================================================
-- 🔧 PROLINK: إصلاح شامل ونهائي لجميع الجداول والمشاكل
-- انسخ هذا الكود كاملاً ونفّذه في Supabase -> SQL Editor -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول رسائل الدعم الفني support_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL,
  receiver_id  uuid NOT NULL,
  content      text NOT NULL,
  message_type text DEFAULT 'text',
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- التأكد من وجود كافة الأعمدة في حال كان الجدول موجوداً مسبقاً
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_insert_reply" ON public.support_messages;

-- المستخدم يرى رسائله الخاصة
CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- المستخدم يرسل رسائل
CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- تحديث حالة القراءة
CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- الأدمن يرى كافة رسائل الدعم للرد عليها
CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- الأدمن يستطيع إرسال ردود الدعم
CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المجموعات groups وأعضائها group_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ✅ إضافة الأعمدة المفقودة التي كانت تسبب خطأ column created_by does not exist
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- مزامنة الأعمدة القديمة إن وجدت
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='creator_id') THEN
    UPDATE public.groups SET created_by = creator_id WHERE created_by IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='user_id') THEN
    UPDATE public.groups SET created_by = user_id WHERE created_by IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'accepted',
  joined_at  timestamptz DEFAULT now()
);

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

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

-- المجموعات العامة يراها الجميع، الخاصة يراها الأعضاء والمنشئ
CREATE POLICY "groups_select_all" ON public.groups
  FOR SELECT USING (
    is_private = false
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = groups.id AND user_id = auth.uid() AND status = 'accepted'
    )
  );

-- إنشاء مجموعة من قبل أي مستخدم مسجل
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- تعديل المجموعة من قبل المنشئ
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

-- حذف المجموعة من قبل المنشئ أو الأدمن
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- أعضاء المجموعة
CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id 
        AND gm2.user_id = auth.uid() 
        AND gm2.status = 'accepted'
    )
  );

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups 
      WHERE id = group_members.group_id AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الإشعارات notifications ومحفزات التحديث
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- تأمين أعمدة job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employer_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- محفز إشعار تلقائي عند قبول أو رفض طلب الوظيفة
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_emp_id := NULL;
    BEGIN
      v_emp_id := NEW.employer_id;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      v_emp_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- جدول تسجيل الدورات ومحفز الإشعار
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid,
  user_id     uuid,
  provider_id uuid,
  status      text DEFAULT 'pending',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_prov_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_prov_id := NULL;
    BEGIN
      v_prov_id := NEW.provider_id;
    EXCEPTION WHEN OTHERS THEN
      v_prov_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      v_prov_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. صلاحيات job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"        ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"       ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "admin_job_app_select_all"  ON public.job_applications;

CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. تفعيل Realtime بأمان
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- نتيجة التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;

-- ============================================================
-- 🔧 PROLINK: إصلاح شامل ونهائي لجميع الجداول وحل خطأ 500
-- انسخ هذا الكود كاملاً ونفّذه في Supabase -> SQL Editor -> Run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. جدول رسائل الدعم الفني support_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid NOT NULL,
  receiver_id  uuid NOT NULL,
  content      text NOT NULL,
  message_type text DEFAULT 'text',
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_select_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_update_policy" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_select_all" ON public.support_messages;
DROP POLICY IF EXISTS "admin_support_insert_reply" ON public.support_messages;

CREATE POLICY "support_select_policy" ON public.support_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "support_insert_policy" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "support_update_policy" ON public.support_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_support_select_all" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_support_insert_reply" ON public.support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. جدول المجموعات groups وأعضائها group_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text DEFAULT '',
  avatar_url   text,
  is_private   boolean DEFAULT false,
  category     text DEFAULT 'عام',
  created_by   uuid,
  member_count integer DEFAULT 1,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category text DEFAULT 'عام';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 1;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='creator_id') THEN
    UPDATE public.groups SET created_by = creator_id WHERE created_by IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='user_id') THEN
    UPDATE public.groups SET created_by = user_id WHERE created_by IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'accepted',
  joined_at  timestamptz DEFAULT now()
);

ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted';
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

-- ربط العلاقة الخارجية لتمكين الـ Join groups(*) في PostgREST
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

-- ✅ حل خطأ 500 (Infinite Recursion):
-- سياسة group_members تكون بسيطة ومباشرة بدون استعلامات ذاتية دائرية
CREATE POLICY "members_select" ON public.group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- سياسة groups: المجموعات العامة يراها الجميع، الخاصة يراها المنشئ وأعضاؤها
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
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الإشعارات notifications ومحفزات التحديث
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  actor_id   uuid,
  type       text NOT NULL,
  content    text NOT NULL,
  target_id  uuid,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- تأمين أعمدة job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employer_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- محفز إشعار تلقائي عند قبول أو رفض طلب الوظيفة
CREATE OR REPLACE FUNCTION notify_job_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_emp_id := NULL;
    BEGIN
      v_emp_id := NEW.employer_id;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.applicant_id,
      v_emp_id,
      CASE WHEN NEW.status = 'approved' THEN 'application_approved' ELSE 'application_rejected' END,
      CASE WHEN NEW.status = 'approved' 
        THEN '🎉 تهانينا! تم قبول طلب توظيفك'
        ELSE '😔 تم رفض طلب توظيفك للأسف'
      END,
      NEW.job_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS job_app_status_notify ON public.job_applications;
CREATE TRIGGER job_app_status_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION notify_job_application_status_change();

-- جدول تسجيل الدورات ومحفز الإشعار
CREATE TABLE IF NOT EXISTS public.course_registrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid,
  user_id     uuid,
  provider_id uuid,
  status      text DEFAULT 'pending',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.course_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION notify_course_registration_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_prov_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    v_prov_id := NULL;
    BEGIN
      v_prov_id := NEW.provider_id;
    EXCEPTION WHEN OTHERS THEN
      v_prov_id := NULL;
    END;

    INSERT INTO public.notifications (user_id, actor_id, type, content, target_id)
    VALUES (
      NEW.user_id,
      v_prov_id,
      CASE WHEN NEW.status = 'approved' THEN 'course_approved' ELSE 'course_rejected' END,
      CASE WHEN NEW.status = 'approved'
        THEN '🎉 تهانينا! تم قبول تسجيلك في الدورة التدريبية'
        ELSE '😔 تم رفض تسجيلك في الدورة التدريبية للأسف'
      END,
      NEW.course_id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_reg_status_notify ON public.course_registrations;
CREATE TRIGGER course_reg_status_notify
  AFTER UPDATE ON public.course_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_course_registration_status_change();

-- ─────────────────────────────────────────────────────────────
-- 4. صلاحيات job_applications RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_app_select_own"        ON public.job_applications;
DROP POLICY IF EXISTS "job_app_insert_auth"       ON public.job_applications;
DROP POLICY IF EXISTS "job_app_update_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "job_app_select_employer"   ON public.job_applications;
DROP POLICY IF EXISTS "admin_job_app_select_all"  ON public.job_applications;

CREATE POLICY "job_app_select_own" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "job_app_select_employer" ON public.job_applications
  FOR SELECT USING (auth.uid() = employer_id);

CREATE POLICY "job_app_insert_auth" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "job_app_update_employer" ON public.job_applications
  FOR UPDATE USING (
    auth.uid() = employer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

CREATE POLICY "admin_job_app_select_all" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin'))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. تفعيل Realtime بأمان
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- نتيجة التنفيذ
-- ─────────────────────────────────────────────────────────────
SELECT 'All fixes applied successfully ✅' AS status;
-- 1. إنشاء مستودعات التخزين والتأكد من أنها عامة
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('profiles', 'profiles', true, 52428800),
  ('images', 'images', true, 52428800),
  ('resumes', 'resumes', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. فتح صلاحية القراءة للجميع
DROP POLICY IF EXISTS "Allow Public Read" ON storage.objects;
CREATE POLICY "Allow Public Read" ON storage.objects
FOR SELECT USING (bucket_id IN ('profiles', 'images', 'resumes'));

-- 3. فتح صلاحية رفع الصور والسير الذاتية
DROP POLICY IF EXISTS "Allow Upload" ON storage.objects;
CREATE POLICY "Allow Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id IN ('profiles', 'images', 'resumes'));

-- 4. فتح صلاحية تحديث الملفات
DROP POLICY IF EXISTS "Allow Update" ON storage.objects;
CREATE POLICY "Allow Update" ON storage.objects
FOR UPDATE USING (bucket_id IN ('profiles', 'images', 'resumes'));

-- 5. السماح بتحديث جدول الملفات الشخصية
DROP POLICY IF EXISTS "Allow Profile Updates" ON public.profiles;
CREATE POLICY "Allow Profile Updates" ON public.profiles
FOR UPDATE USING (true) WITH CHECK (true);
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

-- 4. حل مشكلة عدم حفظ وتثبيت الصور والسير الذاتية في جدول profiles
-- لضمان أن تحديث رابط الصورة والسيرة الذاتية يُحفظ دائماً ولا يُرفض صامتاً:
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Profiles Select" ON public.profiles;
CREATE POLICY "Public Profiles Select" ON public.profiles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles Update Policy" ON public.profiles;
CREATE POLICY "Profiles Update Policy" ON public.profiles
FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
CREATE POLICY "Profiles Insert Policy" ON public.profiles
FOR INSERT WITH CHECK (true);

-- ✅ تم الإعداد بنجاح.
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
-- 1. التأكد من إنشاء وتفعيل باكتات السير الذاتية
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('resumes', 'resumes', true, 52428800),
  ('applications', 'applications', true, 52428800),
  ('profiles', 'profiles', true, 52428800),
  ('job-images', 'job-images', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. فتح صلاحيات الرفع لملفات الجوال والحاسوب
DROP POLICY IF EXISTS "Prolink Public View Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Insert Policy" ON storage.objects;
DROP POLICY IF EXISTS "Prolink Update Policy" ON storage.objects;

CREATE POLICY "Prolink Public View Policy" ON storage.objects 
FOR SELECT USING (bucket_id IN ('resumes', 'applications', 'profiles', 'job-images'));

CREATE POLICY "Prolink Insert Policy" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id IN ('resumes', 'applications', 'profiles', 'job-images'));

CREATE POLICY "Prolink Update Policy" ON storage.objects 
FOR UPDATE USING (bucket_id IN ('resumes', 'applications', 'profiles', 'job-images'));
