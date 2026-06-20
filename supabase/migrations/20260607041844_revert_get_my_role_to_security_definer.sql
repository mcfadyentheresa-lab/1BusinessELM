/*
  # Revert get_my_role to SECURITY DEFINER

  The SECURITY INVOKER change introduced infinite recursion:
    1. A query on canvas_elements triggers RLS → calls get_my_role()
    2. get_my_role() (SECURITY INVOKER) queries profiles
    3. Querying profiles triggers profiles RLS → "Admins can view all profiles" calls get_my_role()
    4. goto 2 → infinite recursion → error → all canvas_elements queries return empty

  get_my_role() MUST be SECURITY DEFINER so it can read profiles without triggering
  profile RLS (which itself calls get_my_role()). The function is safe because it only
  ever returns the calling user's own role via auth.uid() — no privilege escalation is
  possible.

  The previous security concern (REST exposure of a SECURITY DEFINER function) is
  mitigated by the fact that the function only returns the caller's own role, which
  the caller already knows.
*/

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- authenticated role still needs EXECUTE for RLS policies to work
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
