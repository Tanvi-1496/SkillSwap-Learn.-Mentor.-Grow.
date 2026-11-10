-- ==============================================================================
-- SkillSwap Database Rollback Script: Admin Role Protection
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/jgjsbvxrqmbdzjcjtfej/sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. REMOVE ROLE ESCALATION TRIGGER & FUNCTION ON public.users
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_user_role_escalation ON public.users;
DROP FUNCTION IF EXISTS public.prevent_user_role_escalation();

-- ------------------------------------------------------------------------------
-- 2. RESTORE EXACT ORIGINAL handle_new_user() DEFINITION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text;
  incoming_role text;
BEGIN
  incoming_role := lower(trim(COALESCE(new.raw_user_meta_data->>'role', 'student')));

  -- Whitelist check: only 'mentor' is granted mentor; all others default to 'student'
  IF incoming_role = 'mentor' THEN
    assigned_role := 'mentor';
  ELSE
    assigned_role := 'student';
  END IF;

  INSERT INTO public.users (id, name, email, role, org, dept, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    new.email,
    assigned_role,
    COALESCE(new.raw_user_meta_data->>'org', ''),
    COALESCE(new.raw_user_meta_data->>'dept', ''),
    COALESCE(new.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF assigned_role = 'student' THEN
    INSERT INTO public.student_profiles (user_id, semester)
    VALUES (
      new.id,
      CASE
        WHEN (new.raw_user_meta_data->>'semester') ~ '^[0-9]+$'
        THEN (new.raw_user_meta_data->>'semester')::integer
        ELSE NULL
      END
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF assigned_role = 'mentor' THEN
    INSERT INTO public.mentor_profiles (user_id, mentor_type, experience, org)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'mentor_type', ''),
      COALESCE(new.raw_user_meta_data->>'experience', ''),
      COALESCE(new.raw_user_meta_data->>'organization', '')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RESTORE ORIGINAL FUNCTION OWNER AND GRANTS
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, postgres;

-- ------------------------------------------------------------------------------
-- 4. ENSURE SIGNUP TRIGGER REMAINS ACTIVE ON auth.users
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
