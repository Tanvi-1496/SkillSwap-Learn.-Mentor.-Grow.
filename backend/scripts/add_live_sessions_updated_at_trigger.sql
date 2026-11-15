-- ============================================================================
-- SkillSwap Migration: Idempotent live_sessions updated_at trigger
-- File: backend/scripts/add_live_sessions_updated_at_trigger.sql
-- Purpose: Ensures the updated_at timestamp in public.live_sessions is
--          automatically refreshed to NOW() on every row update.
-- Safety: Fully idempotent, non-destructive, safe to run multiple times.
-- ============================================================================

-- 1. Create or replace the trigger handler function
CREATE OR REPLACE FUNCTION public.handle_live_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing trigger if present, then recreate cleanly
DROP TRIGGER IF EXISTS on_live_sessions_updated ON public.live_sessions;

CREATE TRIGGER on_live_sessions_updated
    BEFORE UPDATE ON public.live_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_live_sessions_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (Run these in Supabase SQL Editor to verify installation)
-- ============================================================================

-- Query A: Verify the trigger exists in the PostgreSQL information schema
-- Expected: Exactly 1 row returned with trigger_name = 'on_live_sessions_updated'
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'live_sessions'
  AND trigger_name = 'on_live_sessions_updated';

-- Query B: Verify the trigger function exists
-- Expected: Exactly 1 row with routine_name = 'handle_live_sessions_updated_at'
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_live_sessions_updated_at';

