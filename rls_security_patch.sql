-- ═══════════════════════════════════════════════════════════════════════════
-- 🔒 ProLink — Security Patch: RLS for Missing Tables
-- [SECURITY FIX MED-1] — انسخ هذا الملف والصقه في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: جدول jobs (الوظائف)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_read_all"        ON jobs;
DROP POLICY IF EXISTS "jobs_insert_employer" ON jobs;
DROP POLICY IF EXISTS "jobs_update_own"      ON jobs;
DROP POLICY IF EXISTS "jobs_delete_own"      ON jobs;
DROP POLICY IF EXISTS "jobs_admin_all"       ON jobs;

-- أي مستخدم موثق يقرأ الوظائف
CREATE POLICY "jobs_read_all"
  ON jobs FOR SELECT USING (true);

-- صاحب العمل فقط يُضيف وظيفة باسمه
CREATE POLICY "jobs_insert_employer"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = employer_id);

-- صاحب العمل فقط يُعدّل وظيفته
CREATE POLICY "jobs_update_own"
  ON jobs FOR UPDATE
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);

-- صاحب العمل أو الأدمن يحذف الوظيفة
CREATE POLICY "jobs_delete_own"
  ON jobs FOR DELETE
  USING (
    auth.uid() = employer_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: جدول job_applications (طلبات التوظيف)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_read_parties"  ON job_applications;
DROP POLICY IF EXISTS "apps_insert_own"    ON job_applications;
DROP POLICY IF EXISTS "apps_update_status" ON job_applications;
DROP POLICY IF EXISTS "apps_admin_all"     ON job_applications;

-- المتقدم وصاحب العمل المعني فقط يقرؤون الطلب
CREATE POLICY "apps_read_parties"
  ON job_applications FOR SELECT
  USING (
    applicant_id = auth.uid() OR
    employer_id  = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- المتقدم فقط يُرسل طلباً باسمه
CREATE POLICY "apps_insert_own"
  ON job_applications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = applicant_id);

-- صاحب العمل يُحدّث الحالة فقط (مثلاً: قَبول/رفض)
CREATE POLICY "apps_update_status"
  ON job_applications FOR UPDATE
  USING (auth.uid() = employer_id)
  WITH CHECK (auth.uid() = employer_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: جدول messages (الرسائل)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_parties"  ON messages;
DROP POLICY IF EXISTS "messages_insert_own"    ON messages;
DROP POLICY IF EXISTS "messages_admin_all"     ON messages;

-- المُرسِل والمُستقبِل فقط يقرؤون الرسالة
CREATE POLICY "messages_read_parties"
  ON messages FOR SELECT
  USING (
    sender_id   = auth.uid() OR
    receiver_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- المرسِل فقط يُضيف رسالة باسمه
CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: جدول employees (الموظفون)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_read_employer_or_self" ON employees;
DROP POLICY IF EXISTS "employees_insert_employer"       ON employees;
DROP POLICY IF EXISTS "employees_update_employer"       ON employees;
DROP POLICY IF EXISTS "employees_delete_employer"       ON employees;

-- صاحب العمل والموظف نفسه يقرؤان السجل
CREATE POLICY "employees_read_employer_or_self"
  ON employees FOR SELECT
  USING (
    employer_id = auth.uid() OR
    user_id     = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- صاحب العمل فقط يوظّف
CREATE POLICY "employees_insert_employer"
  ON employees FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = employer_id);

-- صاحب العمل فقط يُحدّث بيانات الموظف
CREATE POLICY "employees_update_employer"
  ON employees FOR UPDATE
  USING (auth.uid() = employer_id);

-- صاحب العمل فقط يُنهي التوظيف
CREATE POLICY "employees_delete_employer"
  ON employees FOR DELETE
  USING (auth.uid() = employer_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: جدول attendance (الحضور)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_read_own_or_employer" ON attendance;
DROP POLICY IF EXISTS "attendance_insert_own"           ON attendance;
DROP POLICY IF EXISTS "attendance_update_own"           ON attendance;

-- الموظف أو صاحب عمله يقرأ سجل الحضور
CREATE POLICY "attendance_read_own_or_employer"
  ON attendance FOR SELECT
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = attendance.employee_id
        AND e.employer_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- الموظف فقط يُسجل حضوره
CREATE POLICY "attendance_insert_own"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = employee_id);

-- الموظف يُسجل انصرافه (update على سجله)
CREATE POLICY "attendance_update_own"
  ON attendance FOR UPDATE
  USING (auth.uid() = employee_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6: التحقق من النتائج
-- ─────────────────────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('jobs', 'job_applications', 'messages', 'employees', 'attendance', 'comments', 'profiles')
ORDER BY tablename;
