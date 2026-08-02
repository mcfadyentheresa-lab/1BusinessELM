-- Fix the handle_new_user trigger function: it has SET search_path TO ''
-- which prevents it from resolving the 'profiles' table (it needs the
-- 'public' schema prefix or a non-empty search_path).
-- This is a pre-existing bug that prevented direct auth.users INSERTs
-- from working (e.g. via SQL). Fixing the search_path so 'profiles'
-- resolves correctly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
