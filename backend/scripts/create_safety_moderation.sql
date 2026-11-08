-- ==============================================================================
-- SkillSwap Database Migration: AI Safety & Moderation Module
-- Tables: safety_flags, moderation_actions
-- Integrates with existing bookings, users, and session_transcripts tables
-- Idempotent, safe for repeated execution, with strict constraints & RLS policies
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TRUSTED ROLE ENFORCEMENT ON public.users
-- Ensures public.users has a trusted role column with valid role domain
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
    ALTER TABLE public.users ADD CONSTRAINT chk_users_role CHECK (role IN ('student', 'mentor', 'admin'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREATE safety_flags TABLE
-- Stores AI-detected safety violations for human-in-the-loop admin review
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.safety_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    mentor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    excerpt TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'warned', 'escalated', 'reviewed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Deduplication Constraint:
-- Enforces that the same category cannot be duplicate-flagged for the same booking
CREATE UNIQUE INDEX IF NOT EXISTS uq_safety_flags_booking_category
ON public.safety_flags (booking_id, category);

-- Performance Indexes for Admin Filtering and Queries
CREATE INDEX IF NOT EXISTS idx_safety_flags_booking_id 
ON public.safety_flags(booking_id);

CREATE INDEX IF NOT EXISTS idx_safety_flags_status 
ON public.safety_flags(status);

CREATE INDEX IF NOT EXISTS idx_safety_flags_category 
ON public.safety_flags(category);

CREATE INDEX IF NOT EXISTS idx_safety_flags_severity 
ON public.safety_flags(severity);

CREATE INDEX IF NOT EXISTS idx_safety_flags_created_at 
ON public.safety_flags(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. CREATE moderation_actions TABLE
-- Audit log of human admin interventions (dismiss, warn, escalate)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID NOT NULL REFERENCES public.safety_flags(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('dismiss', 'warn', 'escalate')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for Moderation Actions
CREATE INDEX IF NOT EXISTS idx_moderation_actions_flag_id 
ON public.moderation_actions(flag_id);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin_id 
ON public.moderation_actions(admin_id);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at 
ON public.moderation_actions(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- Strict access control: Only verified database Admins or service_role can access
-- ------------------------------------------------------------------------------
ALTER TABLE public.safety_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- Safety Flags: Only admins can read
DROP POLICY IF EXISTS "Admins can view safety flags" ON public.safety_flags;
CREATE POLICY "Admins can view safety flags"
ON public.safety_flags
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
);

-- Safety Flags: Only admins can update status/reviewed_at
DROP POLICY IF EXISTS "Admins can update safety flags" ON public.safety_flags;
CREATE POLICY "Admins can update safety flags"
ON public.safety_flags
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
);

-- Moderation Actions: Only admins can read
DROP POLICY IF EXISTS "Admins can view moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can view moderation actions"
ON public.moderation_actions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
);

-- Moderation Actions: Only admins can insert actions
DROP POLICY IF EXISTS "Admins can insert moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can insert moderation actions"
ON public.moderation_actions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
);

COMMIT;

