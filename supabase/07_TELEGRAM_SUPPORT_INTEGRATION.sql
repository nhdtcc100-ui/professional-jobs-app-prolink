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

-- 2. Seed Default Telegram Support Handle
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('telegram_support_handle', '@keko4444', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value
WHERE platform_settings.value IS NULL;

-- 3. Enhance support_messages with Telegram Tracking Columns
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT DEFAULT NULL;

-- 4. Enable Row Level Security (RLS)
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

-- 5. Add to Realtime Publication
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
