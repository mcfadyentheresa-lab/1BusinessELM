-- Revert: restore handle_new_user to its original security-hardened state.
-- The empty search_path ('') on this SECURITY DEFINER function is a deliberate
-- security pattern that prevents search-path hijacking attacks. The previous
-- migration (fix_handle_new_user_search_path) incorrectly changed this to
-- 'public' to work around a test-method limitation. The correct user-creation
-- path (GoTrue signup REST API) does not require this change.
-- This restores the function to exactly what migration 20260802222439 established.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO profiles (id, email, name, role)
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
