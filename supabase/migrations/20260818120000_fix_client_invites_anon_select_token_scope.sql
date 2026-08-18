/*
  # Fix client_invites anonymous SELECT policy — no token predicate

  ## Problem
  "Anyone can read invite by token for accept flow" allowed any
  unauthenticated request to read EVERY pending, non-expired invite in the
  system (first_name, last_name, email, phone, project_id) — the policy
  checked only status/expiry, never the token the caller supplied. The
  application's own query (AcceptInvite.tsx) always adds .eq("token", ...),
  which is why this wasn't visible through normal use of the app, but that
  filter is enforced only by the client, not by RLS. Anyone with the public
  anon key (which ships in the client bundle by design) could call the
  Supabase REST API directly with no token filter and get the full list.

  Confirmed live via a local RLS test harness (real Postgres RLS semantics,
  exact policy text, before this fix): an anonymous, unscoped SELECT
  returned every other pending invite in the table, not just one.

  ## Solution
  RLS policies can't reference an out-of-band request parameter (there's no
  "the value the client filtered by" available inside a USING clause), so
  this moves anon access to a token-scoped SECURITY DEFINER RPC instead of
  a direct table policy — the same pattern already used correctly by
  get_public_presentation() (see 20260803031243_create_get_public_presentation_rpc.sql.sql).

  Every failure case (wrong token, expired token, already-accepted invite,
  no token) collapses to the same NULL result, so the function can't be
  used to distinguish which failure mode occurred.
*/

DROP POLICY IF EXISTS "Anyone can read invite by token for accept flow" ON client_invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'first_name', ci.first_name,
    'last_name',  ci.last_name,
    'email',      ci.email,
    'role',       ci.role,
    'status',     ci.status,
    'project_id', ci.project_id
  )
  FROM public.client_invites ci
  WHERE ci.token = p_token
    AND ci.status = 'pending'
    AND ci.expires_at > now()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;
