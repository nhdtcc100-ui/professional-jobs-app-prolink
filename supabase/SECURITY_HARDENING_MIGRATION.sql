-- ============================================================================
-- SECURITY_HARDENING_MIGRATION.sql  (ProLink)
-- ============================================================================
-- شغّل هذا الملف في Supabase → SQL Editor AFTER all previous SQL files.
-- It supersedes the permissive policies in:
--   00_PROLINK_ALL_IN_ONE_MASTER.sql, 01_STORAGE_AND_MEDIA.sql,
--   FIX_ALL_ISSUES.sql, FIX_STORAGE_RLS_POLICIES.sql,
--   FIX_COVER_AND_AVATAR_STORAGE_PERMISSIONS.sql,
--   CREATE_STORAGE_BUCKETS_AND_POLICIES.sql, 07_TELEGRAM_SUPPORT_INTEGRATION.sql
--
-- Fixes:
--   C3: profiles writable by anyone + admin escalation via INSERT
--   H1: public CV buckets + unrestricted storage writes
--   H2: group membership takeover (OR auth.uid() IS NOT NULL)
--   H3: missing login_attempts table (now RPC-based, fail-closed)
--   C1: platform_settings secrets readable by anon
--   M3: security_logs table with attributable, owner-scoped inserts
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 0. Admin helper (SECURITY DEFINER avoids RLS recursion on profiles)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prolink_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin = true OR p.role IN ('admin','superadmin')
       FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. profiles: ownership-based RLS + role lock on INSERT and UPDATE
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Public profiles are readable by design (network/feed).
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND COALESCE(is_admin, false) = false
    AND (role IS NULL OR role IN ('seeker','employer','freelancer'))
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.prolink_is_admin())
  WITH CHECK (id = auth.uid() OR public.prolink_is_admin());

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid() OR public.prolink_is_admin());

-- Role lock for UPDATE (kept compatible with 01_lock_roles.sql)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service_role / dashboard
  END IF;

  SELECT COALESCE(p.is_admin, false) OR p.role IN ('admin','superadmin')
    INTO caller_is_admin
    FROM public.profiles p WHERE p.id = auth.uid();

  IF COALESCE(caller_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    NEW.is_admin := OLD.is_admin;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF (OLD.role IS NULL OR OLD.role = '') AND NEW.role IN ('seeker','employer','freelancer') THEN
      RETURN NEW; -- first role selection at signup
    END IF;
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- NEW: role lock for INSERT (closes the is_admin=true insert bypass)
CREATE OR REPLACE FUNCTION public.protect_profile_role_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service_role / dashboard
  END IF;

  IF public.prolink_is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot create a profile for another user';
  END IF;

  NEW.is_admin := false;
  IF NEW.role IS NOT NULL AND NEW.role NOT IN ('seeker','employer','freelancer') THEN
    NEW.role := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_role_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_insert();

-- ─────────────────────────────────────────────────────────────
-- 1b. One-time owner promotion (replaces the removed client-side
--     email backdoor). Edit the list to YOUR owner accounts only.
-- ─────────────────────────────────────────────────────────────
UPDATE public.profiles
   SET is_admin = true
 WHERE lower(email) IN ('nhdtcc100@gmail.com','nhd0770@gmail.com','admin@prolink.com');

-- ─────────────────────────────────────────────────────────────
-- 2. group_members: no more "OR auth.uid() IS NOT NULL" takeover
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='group_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_members', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "members_select" ON public.group_members
  FOR SELECT TO authenticated USING (true);

-- Self-join only as 'member'; group owner/admin may add others.
CREATE POLICY "members_insert_auth" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.prolink_is_admin()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
    OR (user_id = auth.uid() AND COALESCE(role, 'member') = 'member')
  );

CREATE POLICY "members_update_owner" ON public.group_members
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.prolink_is_admin()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );

CREATE POLICY "members_delete_auth" ON public.group_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.prolink_is_admin()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );

-- Non-owners may change only their own status (accept/leave), never role/identity.
CREATE OR REPLACE FUNCTION public.protect_group_member_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.prolink_is_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.groups g WHERE g.id = OLD.group_id AND g.created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  NEW.user_id := OLD.user_id;
  NEW.group_id := OLD.group_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_group_member_row ON public.group_members;
CREATE TRIGGER trg_protect_group_member_row
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_group_member_row();

-- ─────────────────────────────────────────────────────────────
-- 3. storage: private CV buckets + owner-scoped writes
--    Upload paths in the app are always `${userId}/${filename}`.
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('images', 'images', true, 52428800),
  ('profiles', 'profiles', true, 52428800),
  ('job-images', 'job-images', true, 52428800),
  ('profills', 'profills', true, 52428800),
  ('applications', 'applications', false, 52428800),
  ('resumes', 'resumes', false, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Public media buckets: world-readable (avatars, covers, post/job images).
CREATE POLICY "prolink_storage_public_read" ON storage.objects
  FOR SELECT USING (bucket_id IN ('images','profiles','job-images','profills'));

-- Private CV buckets: owner, admin, or a user who can see the related
-- job_applications row (applicant / employer — enforced by that table's RLS).
CREATE POLICY "prolink_storage_private_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('resumes','applications')
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR owner = auth.uid()
      OR public.prolink_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.job_applications ja
        WHERE ja.cv_url LIKE '%' || name || '%'
      )
    )
  );

CREATE POLICY "prolink_storage_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('images','profiles','job-images','profills','resumes','applications')
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.prolink_is_admin())
  );

CREATE POLICY "prolink_storage_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('images','profiles','job-images','profills','resumes','applications')
    AND ((storage.foldername(name))[1] = auth.uid()::text OR owner = auth.uid() OR public.prolink_is_admin())
  )
  WITH CHECK (
    (storage.foldername(name))[1] = auth.uid()::text OR public.prolink_is_admin()
  );

CREATE POLICY "prolink_storage_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('images','profiles','job-images','profills','resumes','applications')
    AND ((storage.foldername(name))[1] = auth.uid()::text OR owner = auth.uid() OR public.prolink_is_admin())
  );

-- ─────────────────────────────────────────────────────────────
-- 4. platform_settings: secrets no longer readable by anon
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.platform_settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "platform_settings_public_keys" ON public.platform_settings
  FOR SELECT USING (
    key IN ('telegram_support_handle','mock_data_enabled','news_sources_config','support_whatsapp_number','messaging_enabled','support_chat_enabled','groups_enabled','network_enabled','account_switch_enabled','nav_style','khaki_theme_enabled')
    OR public.prolink_is_admin()
  );

CREATE POLICY "platform_settings_admin_insert" ON public.platform_settings
  FOR INSERT TO authenticated WITH CHECK (public.prolink_is_admin());

CREATE POLICY "platform_settings_admin_update" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.prolink_is_admin()) WITH CHECK (public.prolink_is_admin());

CREATE POLICY "platform_settings_admin_delete" ON public.platform_settings
  FOR DELETE TO authenticated USING (public.prolink_is_admin());

-- Remove any previously leaked token stored in settings (re-set it from the
-- Admin Dashboard, which now writes through the telegram-support edge function).
UPDATE public.platform_settings SET value = '' WHERE key = 'telegram_bot_token';

-- Public support contacts + global messaging gate (admin-editable from the dashboard)
INSERT INTO public.platform_settings (key, value, updated_at) VALUES
  ('support_whatsapp_number', '07724053748', NOW()),
  ('messaging_enabled', 'false', NOW()),
  ('support_chat_enabled', 'false', NOW()),
  ('groups_enabled', 'false', NOW()),
  ('network_enabled', 'false', NOW()),
  ('account_switch_enabled', 'false', NOW()),
  ('khaki_theme_enabled', 'false', NOW()),
  ('nav_style', 'dock', NOW()),
  ('telegram_support_handle', '@keko4444', NOW())
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5. login_attempts: real brute-force protection via RPC (fail-closed)
--    Direct table access is denied; only the two RPCs below touch it.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time
  ON public.login_attempts (identifier, attempted_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no direct access (service_role bypasses).

CREATE OR REPLACE FUNCTION public.check_login_lockout(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_id text := lower(trim(p_identifier));
  failed_count int;
  last_attempt timestamptz;
  remaining int;
BEGIN
  SELECT count(*) INTO failed_count
    FROM public.login_attempts
   WHERE identifier = clean_id AND success = false
     AND attempted_at >= now() - interval '30 minutes';

  IF failed_count >= 5 THEN
    SELECT max(attempted_at) INTO last_attempt
      FROM public.login_attempts
     WHERE identifier = clean_id AND success = false;

    remaining := CEIL(EXTRACT(EPOCH FROM (last_attempt + interval '15 minutes' - now())) / 60);
    IF remaining > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'remainingMinutes', remaining);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(p_identifier text, p_success boolean, p_ip text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_identifier IS NULL OR char_length(trim(p_identifier)) = 0 OR char_length(p_identifier) > 255 THEN
    RETURN;
  END IF;

  INSERT INTO public.login_attempts (identifier, success, ip_address)
  VALUES (lower(trim(p_identifier)), COALESCE(p_success, false), p_ip);

  -- Keep the table small (24h retention).
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.check_login_lockout(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_login_attempt(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. security_logs: attributable inserts, admin-readable
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_email text,
  ip_address text,
  attack_type text,
  severity text,
  endpoint text,
  payload_sample text,
  created_at timestamptz NOT NULL DEFAULT now(),
  target_node text,
  next_predicted_vector text,
  target_port integer
);

CREATE INDEX IF NOT EXISTS idx_security_logs_created ON public.security_logs (created_at DESC);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='security_logs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.security_logs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "security_logs_select" ON public.security_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.prolink_is_admin());

CREATE POLICY "security_logs_insert_own" ON public.security_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "security_logs_admin_delete" ON public.security_logs
  FOR DELETE TO authenticated USING (public.prolink_is_admin());

-- ─────────────────────────────────────────────────────────────
-- 7. Verification queries (run manually after applying)
-- ─────────────────────────────────────────────────────────────
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--  WHERE tablename IN ('profiles','group_members','platform_settings','login_attempts','security_logs')
--     OR (schemaname='storage' AND tablename='objects');
-- SELECT id, public FROM storage.buckets;

-- ─────────────────────────────────────────────────────────────
-- 8. Messaging gate: DMs are admin-only until messaging_enabled='true'
--    Conversations involving an admin always work (support flows).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prolink_feature_open(p_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.platform_settings WHERE key = p_key), false);
$$;

CREATE OR REPLACE FUNCTION public.prolink_messaging_open()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.prolink_feature_open('messaging_enabled');
$$;

CREATE OR REPLACE FUNCTION public.prolink_is_admin_id(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_id AND (is_admin = true OR role IN ('admin','superadmin'))
  );
$$;

REVOKE ALL ON FUNCTION public.prolink_messaging_open() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prolink_is_admin_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prolink_feature_open(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prolink_messaging_open() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prolink_is_admin_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prolink_feature_open(text) TO anon, authenticated;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND (
      public.prolink_messaging_open()
      OR public.prolink_is_admin()
      OR public.prolink_is_admin_id(sender_id)
      OR public.prolink_is_admin_id(receiver_id)
    )
  );

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = sender_id
    AND (
      public.prolink_messaging_open()
      OR public.prolink_is_admin()
      OR public.prolink_is_admin_id(receiver_id)
    )
  );

CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND (
      public.prolink_messaging_open()
      OR public.prolink_is_admin()
      OR public.prolink_is_admin_id(sender_id)
      OR public.prolink_is_admin_id(receiver_id)
    )
  )
  WITH CHECK (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND (
      public.prolink_messaging_open()
      OR public.prolink_is_admin()
      OR public.prolink_is_admin_id(sender_id)
      OR public.prolink_is_admin_id(receiver_id)
    )
  );

CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  USING (
    auth.uid() = sender_id
    AND (
      public.prolink_messaging_open()
      OR public.prolink_is_admin()
      OR public.prolink_is_admin_id(receiver_id)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 9. Feature gates: groups / network / in-app support chat are
--    admin-only until the matching platform_settings key = 'true'.
--    Admins always retain full access.
-- ─────────────────────────────────────────────────────────────

-- 9a. groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='groups' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.groups', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "groups_select_gated" ON public.groups FOR SELECT
  USING (
    public.prolink_is_admin()
    OR (
      public.prolink_feature_open('groups_enabled')
      AND (
        is_private = false
        OR created_by = auth.uid()
        OR id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "groups_insert_gated" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (public.prolink_is_admin() OR public.prolink_feature_open('groups_enabled'))
  );

CREATE POLICY "groups_update_gated" ON public.groups FOR UPDATE TO authenticated
  USING (public.prolink_is_admin() OR (public.prolink_feature_open('groups_enabled') AND created_by = auth.uid()))
  WITH CHECK (public.prolink_is_admin() OR (public.prolink_feature_open('groups_enabled') AND created_by = auth.uid()));

CREATE POLICY "groups_delete_gated" ON public.groups FOR DELETE TO authenticated
  USING (public.prolink_is_admin() OR (public.prolink_feature_open('groups_enabled') AND created_by = auth.uid()));

-- 9b. group_members (ownership rules from section 2 + feature gate)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='group_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_members', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "members_select_gated" ON public.group_members FOR SELECT TO authenticated
  USING (public.prolink_is_admin() OR public.prolink_feature_open('groups_enabled'));

CREATE POLICY "members_insert_gated" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    (public.prolink_is_admin() OR public.prolink_feature_open('groups_enabled'))
    AND (
      public.prolink_is_admin()
      OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
      OR (user_id = auth.uid() AND COALESCE(role, 'member') = 'member')
    )
  );

CREATE POLICY "members_update_gated" ON public.group_members FOR UPDATE TO authenticated
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('groups_enabled') AND (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
    ))
  );

CREATE POLICY "members_delete_gated" ON public.group_members FOR DELETE TO authenticated
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('groups_enabled') AND (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
    ))
  );

-- 9c. connections (شبكتي المهنية)
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='connections' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.connections', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "connections_select_gated" ON public.connections FOR SELECT
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('network_enabled') AND (requester_id = auth.uid() OR recipient_id = auth.uid()))
  );

CREATE POLICY "connections_insert_gated" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND (public.prolink_is_admin() OR public.prolink_feature_open('network_enabled'))
  );

CREATE POLICY "connections_update_gated" ON public.connections FOR UPDATE TO authenticated
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('network_enabled') AND (requester_id = auth.uid() OR recipient_id = auth.uid()))
  )
  WITH CHECK (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('network_enabled') AND (requester_id = auth.uid() OR recipient_id = auth.uid()))
  );

CREATE POLICY "connections_delete_gated" ON public.connections FOR DELETE TO authenticated
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('network_enabled') AND (requester_id = auth.uid() OR recipient_id = auth.uid()))
  );

-- 9d. support_messages (in-app support chat): admin-only until opened.
--     Telegram replies still arrive via receive_telegram_reply (SECURITY DEFINER).
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='support_messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "support_messages_select_gated" ON public.support_messages FOR SELECT TO authenticated
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('support_chat_enabled') AND (sender_id = auth.uid() OR receiver_id = auth.uid()))
  );

CREATE POLICY "support_messages_insert_gated" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (public.prolink_is_admin() OR public.prolink_feature_open('support_chat_enabled'))
  );

CREATE POLICY "support_messages_update_gated" ON public.support_messages FOR UPDATE TO authenticated
  USING (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('support_chat_enabled') AND (sender_id = auth.uid() OR receiver_id = auth.uid()))
  )
  WITH CHECK (
    public.prolink_is_admin()
    OR (public.prolink_feature_open('support_chat_enabled') AND (sender_id = auth.uid() OR receiver_id = auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────
-- 10. notifications: expand schema to match the client payload
--     (fixes POST/PATCH 400 Bad Request on missing columns)
--     Defensive: legacy tables may lack 'message' or use 'content'.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_name TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_avatar TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id TEXT;

-- If a legacy 'content' column exists, relax its NOT NULL and backfill 'message'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'content'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ALTER COLUMN content DROP NOT NULL';
    EXECUTE 'UPDATE public.notifications SET message = content WHERE message IS NULL AND content IS NOT NULL';
  END IF;
END $$;

ALTER TABLE public.notifications ALTER COLUMN message SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (type);
