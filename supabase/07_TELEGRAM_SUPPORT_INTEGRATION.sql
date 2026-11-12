-- ============================================================================
-- 07_TELEGRAM_SUPPORT_INTEGRATION.sql
-- ProLink Platform: Telegram Support Integration & Dynamic Platform Settings
-- ============================================================================

-- 1. Create Platform Settings Table (Key-Value Store)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    metadata JSONB DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed Default Telegram Support Settings
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES 
    ('telegram_support_handle', '@prolink1357_support_bot', NOW()),
    ('telegram_bot_token', '9259272344:AAGkb7hGss2Hy9gdUPamHEg5mwLvOAe8Vw0', NOW()),
    ('telegram_chat_id', '207207781', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value
WHERE platform_settings.value IS NULL OR platform_settings.value = '';

-- 3. Enhance support_messages: Drop strict foreign key constraint on receiver_id and add telegram tracking
ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_receiver_id_fkey;
ALTER TABLE public.support_messages ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT DEFAULT NULL;

-- 4. Enable Row Level Security (RLS) on platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read platform settings (for client rendering)
DROP POLICY IF EXISTS "platform_settings_read_all" ON public.platform_settings;
CREATE POLICY "platform_settings_read_all"
    ON public.platform_settings FOR SELECT
    TO authenticated, anon
    USING (true);

-- Policy: Only Admins can modify platform settings
DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write"
    ON public.platform_settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.role = 'admin' OR profiles.role = 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.role = 'admin' OR profiles.role = 'superadmin')
        )
    );

-- 5. Fix Support Messages RLS Policy so Admins and Support staff can see ALL support threads
DROP POLICY IF EXISTS "support_messages_read" ON public.support_messages;
CREATE POLICY "support_messages_read" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.is_admin = true OR profiles.role = 'admin' OR profiles.role = 'superadmin' OR profiles.has_support_access = true)
    )
  );

DROP POLICY IF EXISTS "support_messages_insert" ON public.support_messages;
CREATE POLICY "support_messages_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "support_messages_update" ON public.support_messages;
CREATE POLICY "support_messages_update" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = receiver_id 
    OR auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.is_admin = true OR profiles.role = 'admin' OR profiles.role = 'superadmin' OR profiles.has_support_access = true)
    )
  );

-- 6. Add to Realtime Publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

-- 7. Secure Telegram Support Reply Function (SECURITY DEFINER)
-- Allows inserting verified support replies without RLS restriction
CREATE OR REPLACE FUNCTION public.receive_telegram_reply(
    p_user_id UUID,
    p_content TEXT,
    p_telegram_from TEXT DEFAULT 'Telegram Support',
    p_telegram_message_id BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_new_id UUID;
BEGIN
    -- Resolve first admin profile
    SELECT id INTO v_admin_id 
    FROM public.profiles 
    WHERE is_admin = true OR role = 'admin' OR role = 'superadmin'
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        v_admin_id := p_user_id;
    END IF;

    INSERT INTO public.support_messages (
        sender_id,
        receiver_id,
        content,
        message_type,
        metadata
    ) VALUES (
        v_admin_id,
        p_user_id,
        p_content,
        'text',
        jsonb_build_object(
            'source', 'telegram',
            'telegram_from', p_telegram_from,
            'telegram_message_id', p_telegram_message_id
        )
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_telegram_reply TO anon, authenticated;
