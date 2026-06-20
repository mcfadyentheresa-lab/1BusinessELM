-- Restore EXECUTE on get_my_role() for authenticated.
-- The function is SECURITY DEFINER to break RLS recursion on profiles;
-- authenticated users need EXECUTE so RLS policies on all tables can call it.
-- The function is safe to expose: it only ever returns auth.uid()'s own role.
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
