-- ==============================================================================
-- SkillSwap Database Migration: Batch Transcription & Diarization Support
-- Module: Gnani Batch Jobs Long-Session Transcription
-- Idempotent & Non-Destructive: Safe to run multiple times without data loss
-- ==============================================================================

-- 1. Ensure columns exist on session_transcripts
ALTER TABLE IF EXISTS public.session_transcripts 
    ADD COLUMN IF NOT EXISTS provider_job_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS diarization JSONB,
    ADD COLUMN IF NOT EXISTS finalization_lock BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS insights_generated_at TIMESTAMPTZ;

-- 2. Create index on provider_job_id for fast webhook and poller lookups
CREATE INDEX IF NOT EXISTS idx_session_transcripts_provider_job_id 
    ON public.session_transcripts(provider_job_id);

-- 3. Explicit grants ensuring backend service_role can write and authenticated can read
GRANT SELECT ON public.session_transcripts TO authenticated;
GRANT ALL ON public.session_transcripts TO service_role;

