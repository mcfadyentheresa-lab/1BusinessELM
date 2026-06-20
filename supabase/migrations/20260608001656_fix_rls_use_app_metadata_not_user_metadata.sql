/*
  # Fix RLS policy using user_metadata (user-editable)

  ## Problem
  The "Admins can view all profiles" policy now uses:
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'

  user_metadata maps to auth.users.raw_user_meta_data, which authenticated users
  can overwrite via supabase.auth.updateUser({ data: { role: 'admin' } }).
  This means any signed-in user can escalate themselves to admin by updating
  their own user_metadata.

  ## Solution
  Use app_metadata instead. app_metadata maps to auth.users.raw_app_meta_data
  and is NOT writable by authenticated users — only service-role API calls or
  SECURITY DEFINER database functions can modify it.

  We need to:
  1. Create a SECURITY DEFINER trigger function that syncs profiles.role into
     auth.users.raw_app_meta_data whenever a profile is inserted or updated.
  2. Backfill existing profiles so all current users' JWTs will carry the
     correct app_metadata.role on next refresh.
  3. Replace the policy to use (auth.jwt() -> 'app_metadata' ->> 'role').
*/

-- 1. Trigger function: sync profile role → auth.users.raw_app_meta_data
--    Must be SECURITY DEFINER to write to the auth schema.
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Only the database itself should invoke this trigger function.
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_app_metadata() FROM anon, authenticated;

-- 2. Trigger: fire after every insert or role update on profiles.
DROP TRIGGER IF EXISTS trg_sync_role_app_metadata ON public.profiles;
CREATE TRIGGER trg_sync_role_app_metadata
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_app_metadata();

-- 3. Backfill: sync current profile roles into raw_app_meta_data for all
--    existing users so the next JWT refresh picks up the correct value.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, role FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', rec.role)
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 4. Replace the vulnerable policy with one that reads from app_metadata,
--    which authenticated users cannot modify.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
