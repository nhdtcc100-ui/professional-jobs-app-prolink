-- ==============================================================================
-- 📁 Supabase Query Name: 06_REALTIME_PUBLICATIONS
-- 🚀 ProLink: تفعيل البث اللحظي المباشر WebSockets لكافة الجداول (Realtime Master)
-- ==============================================================================

-- 1. ضبط Replica Identity لضمان إرسال كامل بيانات السطر عند الإضافة والتعديل والحذف
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

-- 2. إضافة كافة الجداول لبث supabase_realtime
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

-- 3. فحص وتأكيد الجداول المربوطة بالبث المباشر
SELECT pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
