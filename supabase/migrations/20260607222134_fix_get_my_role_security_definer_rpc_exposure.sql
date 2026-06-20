/*
  # Fix get_my_role SECURITY DEFINER RPC exposure

  ## Problem
  public.get_my_role() is SECURITY DEFINER and executable by the `authenticated`
  role via /rest/v1/rpc/get_my_role. A SECURITY DEFINER function runs with the
  privileges of its owner (postgres), so any authenticated user can invoke it
  through the REST API with elevated database privileges.

  ## Root cause of previous failed attempts
  Switching to SECURITY INVOKER caused infinite recursion:
    1. Any table query triggers RLS → calls get_my_role()
    2. get_my_role() (SECURITY INVOKER) queries profiles
    3. Querying profiles triggers "Admins can view all profiles" policy → calls get_my_role()
    4. goto 2 → stack overflow

  ## Solution
  Replace the recursive profiles policy with one that reads the role directly
  from the JWT claims (auth.jwt() → user_metadata → role). Supabase sets
  user_metadata.role at signup from raw_user_meta_data, so this is always
  available without a DB round-trip and cannot cause recursion.

  Once the recursive dependency on get_my_role() inside the profiles table is
  removed, the function can safely be SECURITY INVOKER — it still reads from
  profiles but no longer triggers a recursive policy call when doing so.
*/

-- Step 1: Replace the recursive profiles admin policy with a JWT-based check.
-- auth.jwt() -> 'user_metadata' ->> 'role' reads directly from the session token;
-- no DB query, no RLS trigger, no recursion possible.
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Step 2: Switch get_my_role() to SECURITY INVOKER.
-- The function still queries profiles, but now runs as the calling user.
-- The "Users can view own profile" policy (auth.uid() = id) lets authenticated
-- users read their own row without touching get_my_role(), so no recursion.
-- The SECURITY DEFINER risk (elevated-privilege RPC) is eliminated.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Step 3: Revoke direct RPC access from anon (belt-and-suspenders).
-- Authenticated users retain EXECUTE so RLS policies on all other tables
-- can call the function, but it now runs under their own privileges only.
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
