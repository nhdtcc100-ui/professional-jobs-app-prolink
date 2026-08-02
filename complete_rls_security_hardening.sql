-- ============================================================================
-- ProLink - Full Database Security & Tenant Isolation Patch (RLS)
-- ============================================================================

-- 1. Enable RLS on All Application Tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS course_registrations ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Security & Privilege Protection
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND is_admin = FALSE);

-- 3. Tenant Isolation & Data Access Rules for Notifications
DROP POLICY IF EXISTS "notifications_owner_select" ON notifications;
DROP POLICY IF EXISTS "notifications_owner_update" ON notifications;

CREATE POLICY "notifications_owner_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_owner_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Connections Isolation Rules
DROP POLICY IF EXISTS "connections_participant_select" ON connections;
DROP POLICY IF EXISTS "connections_participant_insert" ON connections;

CREATE POLICY "connections_participant_select" ON connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_participant_insert" ON connections
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- 5. Course Registrations Protection
DROP POLICY IF EXISTS "registrations_owner_or_provider_select" ON course_registrations;
CREATE POLICY "registrations_owner_or_provider_select" ON course_registrations
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM courses WHERE id = course_registrations.course_id AND provider_id = auth.uid())
  );

-- 6. Login Attempt Tracking Table for Server-Side Rate Limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   TEXT NOT NULL,
  ip_address   TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time ON login_attempts(identifier, attempted_at DESC);
