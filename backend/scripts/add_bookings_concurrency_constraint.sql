-- ==============================================================================
-- SkillSwap Database Migration: Atomic Concurrent Booking Protection
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/<your-project-id>/sql)
-- ==============================================================================

-- 1. Create a partial unique index on bookings table
-- This guarantees at the database level that no mentor can ever have more than one
-- active ('pending' or 'confirmed') booking for the exact same date and time slot,
-- even under concurrent load or network race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_mentor_date_time_active
ON public.bookings (mentor_id, date, "time")
WHERE status IN ('pending', 'confirmed');

-- 2. Optional: Index for rapid student conflict lookups
CREATE INDEX IF NOT EXISTS idx_bookings_student_date_time_active
ON public.bookings (student_id, date, "time")
WHERE status IN ('pending', 'confirmed');

-- ==============================================================================
-- Verification Query:
-- Run to confirm indexes are present on the bookings table:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings';
-- ==============================================================================

