/*
  # Fix get_my_role REST exposure

  The function public.get_my_role() is SECURITY DEFINER and currently grants
  EXECUTE to the `authenticated` role, which exposes it via PostgREST's
  /rest/v1/rpc/get_my_role endpoint.

  RLS policies that call get_my_role() are evaluated server-side by Postgres.
  Because the function is SECURITY DEFINER, the policy check runs under the
  function owner's privileges — it does NOT require the calling user to hold
  an explicit EXECUTE grant. Revoking EXECUTE from `authenticated` prevents
  direct REST calls while leaving all RLS policy checks intact.
*/

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM authenticated;
