-- ==============================================================================
-- SkillSwap Database Migration (v2.1 Hardened): Admin Role Protection
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/jgjsbvxrqmbdzjcjtfej/sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SECURE USER PROVISIONING TRIGGER (auth.users -> public.users & profiles)
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
    INSERT INTO public.mentor_profiles (user_id, mentor_type, experience, org, verified)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'mentor_type', 'PEER'),
      CASE
        WHEN trim(COALESCE(new.raw_user_meta_data->>'experience', '')) ~ '^[0-9]{1,4}$'
        THEN trim(new.raw_user_meta_data->>'experience')::integer
        ELSE NULL
      END,
      COALESCE(new.raw_user_meta_data->>'organization', ''),
      false
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Secure function permissions: Must include supabase_auth_admin for GoTrue signups
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_admin, supabase_auth_admin;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 2. ROLE PROTECTION TRIGGER ON public.users (COVERS BOTH INSERT & UPDATE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_user_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_caller_trusted boolean;
BEGIN
  -- Determine whether caller is a trusted database role or a verified Admin
  is_caller_trusted := (
    current_user IN ('service_role', 'postgres', 'supabase_admin')
    OR (
      current_user = 'authenticated'
      AND COALESCE(auth.role(), '') = 'authenticated'
      AND COALESCE(public.is_admin(), false) = true
    )
  );

  -- 1. Check INSERT: Non-trusted callers cannot insert role other than 'student' or 'mentor'
  IF TG_OP = 'INSERT' THEN
    IF NOT is_caller_trusted AND lower(trim(COALESCE(NEW.role, 'student'))) NOT IN ('student', 'mentor') THEN
      RAISE EXCEPTION 'Direct assignment of role "%" on INSERT is not permitted.', NEW.role;
    END IF;
  END IF;

  -- 2. Check UPDATE: Non-trusted callers cannot modify the role column
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_caller_trusted THEN
      RAISE EXCEPTION 'Direct modification of user role is not permitted.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Secure function permissions
REVOKE ALL ON FUNCTION public.prevent_user_role_escalation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_user_role_escalation() TO postgres, supabase_admin, service_role, authenticated, anon;

-- Attach trigger to public.users for BOTH INSERT AND UPDATE
DROP TRIGGER IF EXISTS trg_prevent_user_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_user_role_escalation
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_role_escalation();

COMMIT;
