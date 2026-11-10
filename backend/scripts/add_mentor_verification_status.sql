-- ==============================================================================
-- SkillSwap Migration: Mentor Verification Status & Rejection Workflow
-- Idempotent, Safe for Repeated Execution, Zero Data Loss
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/jgjsbvxrqmbdzjcjtfej/sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. IDEMPOTENT COLUMN ADDITION & CONTROLLED BACKFILL
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Check if verification_status column already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'mentor_profiles' 
      AND column_name = 'verification_status'
  ) THEN
    -- Column is new: Add column initially without constraints to allow controlled backfill
    ALTER TABLE public.mentor_profiles
      ADD COLUMN verification_status text;

    -- Backfill initial legacy records based on legacy verified boolean
    -- This backfill runs ONLY when verification_status is introduced for the first time
    UPDATE public.mentor_profiles
    SET verification_status = CASE
      WHEN verified = true THEN 'approved'
      ELSE 'pending'
    END
    WHERE verification_status IS NULL;

    -- Set default to 'pending'
    ALTER TABLE public.mentor_profiles
      ALTER COLUMN verification_status SET DEFAULT 'pending';

    -- Enforce NOT NULL
    ALTER TABLE public.mentor_profiles
      ALTER COLUMN verification_status SET NOT NULL;

    -- Enforce valid state domain
    ALTER TABLE public.mentor_profiles
      ADD CONSTRAINT chk_mentor_profiles_verification_status
      CHECK (verification_status IN ('pending', 'approved', 'rejected'));

  ELSE
    -- Column already exists (repeated execution or recovery from partial application)
    -- Never overwrite existing 'approved', 'rejected', or 'pending' records!
    -- Only backfill rows where verification_status IS NULL (if any exist from a partial run)
    UPDATE public.mentor_profiles
    SET verification_status = CASE
      WHEN verified = true THEN 'approved'
      ELSE 'pending'
    END
    WHERE verification_status IS NULL;

    -- Ensure default is configured
    ALTER TABLE public.mentor_profiles
      ALTER COLUMN verification_status SET DEFAULT 'pending';

    -- Ensure NOT NULL is enforced
    ALTER TABLE public.mentor_profiles
      ALTER COLUMN verification_status SET NOT NULL;

    -- Ensure constraint exists if missing from a partial run
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.mentor_profiles'::regclass
        AND conname = 'chk_mentor_profiles_verification_status'
    ) THEN
      ALTER TABLE public.mentor_profiles
        ADD CONSTRAINT chk_mentor_profiles_verification_status
        CHECK (verification_status IN ('pending', 'approved', 'rejected'));
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. PERFORMANCE INDEX (Blocks concurrent writes during creation; allows concurrent reads)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_verification_status
  ON public.mentor_profiles (verification_status);

-- ------------------------------------------------------------------------------
-- 3. AUTHORITATIVE SYNCHRONIZATION TRIGGER (Unidirectional)
-- verification_status is the sole source of truth; verified is strictly derived
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_mentor_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Default to 'pending' if null
  IF NEW.verification_status IS NULL THEN
    NEW.verification_status := 'pending';
  END IF;

  -- Derive verified strictly and deterministically from verification_status
  IF NEW.verification_status = 'approved' THEN
    NEW.verified := true;
  ELSE
    NEW.verified := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mentor_verification_status ON public.mentor_profiles;
CREATE TRIGGER trg_sync_mentor_verification_status
  BEFORE INSERT OR UPDATE ON public.mentor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mentor_verification_status();

-- ------------------------------------------------------------------------------
-- 4. HARDENED REGISTRATION TRIGGER (Preserves 100% of V2.1 security invariants)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assigned_role text;
  incoming_role text;
BEGIN
  -- Extract incoming role safely from raw_user_meta_data
  incoming_role := lower(trim(COALESCE(new.raw_user_meta_data->>'role', 'student')));

  -- Whitelist enforcement: ONLY 'mentor' is granted mentor; all others default to 'student'
  -- Untrusted client metadata or OAuth claims can NEVER provision an 'admin' role
  IF incoming_role = 'mentor' THEN
    assigned_role := 'mentor';
  ELSE
    assigned_role := 'student';
  END IF;

  -- 1. Insert into public.users if not already present
  -- ON CONFLICT (id) DO NOTHING guarantees existing legitimate users (including Admins)
  -- are NEVER overwritten, modified, or downgraded.
  INSERT INTO public.users (id, name, email, role, org, dept, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''),
    new.email,
    assigned_role,
    COALESCE(new.raw_user_meta_data->>'org', ''),
    COALESCE(new.raw_user_meta_data->>'dept', ''),
    COALESCE(new.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Provision matching profile record
  -- Integer cast protection: Strictly limit to 1-4 digits (0-9999)
  -- This prevents 32-bit signed integer overflow (< 2,147,483,647) while
  -- safely preserving legitimate semesters (1-12) and years of experience (0-100).
  -- Any non-digit string, empty string, or value exceeding 4 digits evaluates to NULL.
  IF assigned_role = 'student' THEN
    INSERT INTO public.student_profiles (user_id, semester)
    VALUES (
      new.id,
      CASE
        WHEN trim(COALESCE(new.raw_user_meta_data->>'semester', '')) ~ '^[0-9]{1,4}$'
        THEN trim(new.raw_user_meta_data->>'semester')::integer
        ELSE NULL
      END
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF assigned_role = 'mentor' THEN
    INSERT INTO public.mentor_profiles (user_id, mentor_type, experience, org, verified, verification_status)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'mentor_type', 'PEER'),
      CASE
        WHEN trim(COALESCE(new.raw_user_meta_data->>'experience', '')) ~ '^[0-9]{1,4}$'
        THEN trim(new.raw_user_meta_data->>'experience')::integer
        ELSE NULL
      END,
      COALESCE(new.raw_user_meta_data->>'organization', ''),
      false,
      'pending'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Secure function permissions: Must include supabase_auth_admin for GoTrue signups
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_admin, supabase_auth_admin;

COMMIT;

