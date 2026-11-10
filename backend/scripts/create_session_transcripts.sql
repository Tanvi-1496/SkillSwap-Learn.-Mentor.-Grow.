-- ==============================================================================
-- SkillSwap Database Migration: Session Transcripts Table
-- Module: Session Management & AI-Powered Session Transcription using Gnani.ai
-- Integrates with existing bookings table (Single Source of Truth)
-- ==============================================================================

-- 1. Create session_transcripts table linked to bookings with Two-Party Consent
CREATE TABLE IF NOT EXISTS public.session_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
    transcript_text TEXT,
    language VARCHAR(50) DEFAULT 'en',
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,
    audio_filename VARCHAR(255),
    audio_mimetype VARCHAR(100),
    audio_size_bytes INTEGER,
    audio_duration_seconds NUMERIC(6, 2),
    
    -- Two-Party Consent tracking: Both student and mentor must explicitly consent
    student_consent BOOLEAN NOT NULL DEFAULT FALSE,
    student_consent_at TIMESTAMPTZ,
    mentor_consent BOOLEAN NOT NULL DEFAULT FALSE,
    mentor_consent_at TIMESTAMPTZ,
    consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast lookups by booking_id and status
CREATE INDEX IF NOT EXISTS idx_session_transcripts_booking_id 
ON public.session_transcripts(booking_id);

CREATE INDEX IF NOT EXISTS idx_session_transcripts_status 
ON public.session_transcripts(status);

-- 3. Row-Level Security (RLS) policies
-- Transcripts can only be read by:
-- - The student who booked the session
-- - The mentor of the session
-- - An administrator
-- - Tanvi's safety moderation service (via backend service role or authorized token)
ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to allow clean re-runs
DROP POLICY IF EXISTS "Allow participants and admin to read session transcripts" ON public.session_transcripts;

CREATE POLICY "Allow participants and admin to read session transcripts"
ON public.session_transcripts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = session_transcripts.booking_id
          AND (
              b.student_id = auth.uid() 
              OR b.mentor_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.users u 
                  WHERE u.id = auth.uid() AND u.role = 'admin'
              )
          )
    )
);
