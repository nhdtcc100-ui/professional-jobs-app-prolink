-- ==============================================================================
-- 📁 Supabase Query Name: 03_MESSAGES_CONNECTIONS_CALLS
-- 🚀 ProLink: المحادثات الفورية، الدعم الفني، طلبات المزامنة، والمكالمات
-- ==============================================================================

-- ─── 1. جدول الرسائل الفورية (messages) ─────────────────────────────────────────
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

CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = sender_id);

CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_delete" ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ─── 2. جدول رسائل الدعم الفني المستقل (support_messages) ──────────────────────
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

CREATE POLICY "support_messages_read" ON public.support_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "support_messages_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "support_messages_update" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- ─── 3. جدول طلبات الصداقة والمزامنة (connections) ───────────────────────────
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

CREATE POLICY "connections_select" ON public.connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_insert" ON public.connections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = requester_id);

CREATE POLICY "connections_update" ON public.connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "connections_delete" ON public.connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

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
