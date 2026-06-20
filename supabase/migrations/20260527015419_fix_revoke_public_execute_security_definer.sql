/*
  # Revoke PUBLIC Execute on SECURITY DEFINER Functions

  The previous migration revoked from named roles but the grant was on PUBLIC.
  This migration revokes EXECUTE from PUBLIC on both functions, then grants
  only to the roles that legitimately need them.

  1. Changes
    - Revoke EXECUTE on get_my_role() from PUBLIC
    - Revoke EXECUTE on handle_new_user() from PUBLIC
    - Grant EXECUTE on get_my_role() back to postgres and service_role only
      (used internally by RLS policies via the definer context)
    - handle_new_user() is a trigger function; no explicit RPC grant needed
*/

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Restore access for internal/service use only
GRANT EXECUTE ON FUNCTION public.get_my_role() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
