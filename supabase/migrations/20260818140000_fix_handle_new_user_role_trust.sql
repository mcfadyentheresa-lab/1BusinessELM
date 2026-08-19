/*
  # Fix handle_new_user() trusting client-writable signup metadata for role

  ## Problem
  handle_new_user() set profiles.role directly from
  NEW.raw_user_meta_data->>'role', which is client-writable at signup time:
  any call to supabase.auth.signUp({ options: { data: { role: 'admin' } } })
  gets it written straight into the database. The public anon key ships in
  every page load by design, so Supabase's signup endpoint is directly
  callable by anyone, entirely bypassing this app's UI/routing (the app's
  own signUp() call, in AcceptInvite.tsx, is invite-gated, but nothing
  stopped a direct API call from claiming any role it wants). With email
  confirmation disabled on this project, such an account is immediately
  active. The resulting profiles.role also syncs into app_metadata.role via
  sync_profile_role_to_app_metadata, making the escalation "legitimate"
  everywhere else in the app (RLS, storage ownership checks, etc.).

  Confirmed live via a local trigger-reproduction harness before this fix:
  a direct signup with self-declared role: 'admin' and no invite at all
  resulted in a real profiles.role = 'admin' row.

  ## Solution
  Never trust the self-declared role. Instead, look up whether a matching
  PENDING, non-expired invite exists in client_invites (by token, which
  AcceptInvite.tsx now passes through signup metadata as invite_token) and
  use that invite's role - the invite record itself is the proof of
  legitimate admin-issued access, not the caller's own claim. client_invites
  INSERT is admin-only (RLS), so only an existing admin can issue a role,
  including a new admin. No matching pending invite -> default to 'crew',
  the same lowest-privilege default as before.

  Verified via the same harness after this fix: the original attack now
  falls back to 'crew'; a fabricated invite_token grants nothing; expired
  and already-accepted invite tokens grant nothing (can't be replayed); and
  critically, legitimate invited signups for both 'crew' and 'admin' roles
  still work exactly as before.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_invited_role text;
BEGIN
  SELECT role INTO v_invited_role
  FROM public.client_invites
  WHERE token = (NEW.raw_user_meta_data->>'invite_token')
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(v_invited_role, 'crew')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
