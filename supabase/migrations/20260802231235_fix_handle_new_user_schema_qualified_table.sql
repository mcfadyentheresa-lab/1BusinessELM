-- Fix: handle_new_user has SET search_path TO '' (correct security hardening
-- against search-path hijacking) but its body uses an unqualified table
-- reference: INSERT INTO profiles. With an empty search_path, PostgreSQL
-- cannot resolve 'profiles' and the trigger raises an error, which breaks
-- ALL new user signups via GoTrue.
--
-- The fix: qualify the table reference as public.profiles. This is the
-- standard PostgreSQL pattern for SECURITY DEFINER functions with locked-
-- down search paths. The security hardening (SET search_path TO '') is
-- preserved exactly as-is. The other two SECURITY DEFINER functions
-- (get_my_role, sync_profile_role_to_app_metadata) already use
-- schema-qualified references correctly — this was an isolated omission
-- in handle_new_user only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'crew')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
