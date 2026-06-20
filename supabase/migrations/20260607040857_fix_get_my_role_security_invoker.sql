/*
  # Fix get_my_role SECURITY DEFINER exposure

  The function public.get_my_role() was defined as SECURITY DEFINER, which means
  authenticated users can call it via /rest/v1/rpc/get_my_role and it executes with
  elevated (owner) privileges. Since profiles RLS already allows users to read their
  own row, we can switch to SECURITY INVOKER — the function runs with the caller's
  own privileges, the SECURITY DEFINER risk is eliminated, and RLS policies continue
  to work because authenticated users can still read their own profile row.

  We also revoke the EXECUTE grant that was added to fix RLS (which is no longer
  needed for SECURITY INVOKER — the function simply inherits the caller's access).
*/

-- Drop and recreate as SECURITY INVOKER so it no longer runs with owner privileges.
-- SECURITY INVOKER is the default but we set it explicitly for clarity.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Revoke the broad EXECUTE grant added by a prior migration.
-- Authenticated users still need EXECUTE for RLS policies to invoke this function,
-- but the function no longer carries elevated privileges, so the security risk is gone.
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
