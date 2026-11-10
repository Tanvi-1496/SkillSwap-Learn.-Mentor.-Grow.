-- ==============================================================================
-- SkillSwap Database Migration: AI Learning Companion & Session Intelligence
-- Tables: chat_messages, session_insights
-- Integrates with existing users, bookings, and session_transcripts tables
-- Idempotent, safe for repeated execution, with strict constraints & RLS policies
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CREATE chat_messages TABLE
-- Stores student conversation history with the AI Learning Companion
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'roadmap', 'project', 'interview', 'session_insight')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Index for retrieving user conversation history in chronological order
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
ON public.chat_messages (user_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 2. CREATE session_insights TABLE
-- Caches structured post-session learning takeaways generated from verified transcripts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
    summary TEXT NOT NULL,
    key_discussion_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    learning_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
    action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    follow_up_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    model VARCHAR(100) NOT NULL DEFAULT 'gnani/gnani-evon-v3.3-30B-A3B',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Index for session insights lookup
CREATE INDEX IF NOT EXISTS idx_session_insights_booking_id 
ON public.session_insights (booking_id);

-- ------------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_insights ENABLE ROW LEVEL SECURITY;

-- chat_messages: Users can read only their own chat messages
DROP POLICY IF EXISTS "Users can read own chat messages" ON public.chat_messages;
CREATE POLICY "Users can read own chat messages"
ON public.chat_messages
FOR SELECT
USING (auth.uid() = user_id);

-- chat_messages: Users can insert their own chat messages
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert own chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- chat_messages: Users can delete their own chat history
DROP POLICY IF EXISTS "Users can delete own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete own chat messages"
ON public.chat_messages
FOR DELETE
USING (auth.uid() = user_id);

-- session_insights: Participants (student or mentor) and admins can view session insights
DROP POLICY IF EXISTS "Participants can view session insights" ON public.session_insights;
CREATE POLICY "Participants can view session insights"
ON public.session_insights
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = session_insights.booking_id
          AND (b.student_id = auth.uid() OR b.mentor_id = auth.uid())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
);

-- session_insights: Service role / backend can insert insights
DROP POLICY IF EXISTS "Backend can manage session insights" ON public.session_insights;
CREATE POLICY "Backend can manage session insights"
ON public.session_insights
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;

